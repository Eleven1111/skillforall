#!/usr/bin/env node
/**
 * check-site-signals.mjs — Site-level SEO signal checks (mc-seo 模块 3)
 *
 * Fetches robots.txt and sitemap.xml, and probes common staging/test
 * subdomain prefixes. Outputs structured JSON so the agent can fill mc-seo's
 * audit tables from real data instead of inferring from search results.
 *
 * All outbound requests go through lib.mjs's safeFetch, which resolves the
 * hostname first and refuses private/loopback/reserved targets — this script
 * fetches whatever URL a user supplies, so that guard is not optional.
 *
 * Usage:
 *   node scripts/check-site-signals.mjs <origin-url> [--timeout <ms>]
 *
 * Dependencies: none (Node built-in fetch/dns/net only).
 */

import { safeFetch } from "./lib.mjs";

const STAGING_PREFIXES = ["test", "staging", "dev", "preview", "beta", "uat"];

// ── robots.txt ────────────────────────────────────────────────────────────────

export function parseRobots(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let currentAgents = [];
  let disallowAllForStar = false;
  const sitemaps = [];

  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      currentAgents = [value];
    } else if (key === "disallow") {
      if (currentAgents.includes("*") && value === "/") disallowAllForStar = true;
    } else if (key === "sitemap") {
      sitemaps.push(value);
    }
  }

  return { disallowAllForStar, sitemaps };
}

async function checkRobots(origin, timeoutMs) {
  const url = new URL("/robots.txt", origin).toString();
  const res = await safeFetch(url, { timeoutMs });

  if (res.error) {
    return { status: "error", http_status: null, detail: res.error, sitemap_directive: null };
  }
  if (res.status === 404) {
    return { status: "warn", http_status: 404, detail: "robots.txt not found — not required, but its absence means no explicit sitemap discovery hint for crawlers.", sitemap_directive: null };
  }
  if (!res.ok) {
    return { status: "warn", http_status: res.status, detail: `robots.txt returned HTTP ${res.status}`, sitemap_directive: null };
  }

  const { disallowAllForStar, sitemaps } = parseRobots(res.text);
  if (disallowAllForStar) {
    return {
      status: "fail",
      http_status: res.status,
      detail: "User-agent: * has Disallow: / — the entire site is blocked from crawling.",
      sitemap_directive: sitemaps[0] ?? null,
    };
  }
  return {
    status: "pass",
    http_status: res.status,
    detail: sitemaps.length
      ? `robots.txt found, no blanket disallow, declares ${sitemaps.length} sitemap(s).`
      : "robots.txt found, no blanket disallow, but no Sitemap: directive declared.",
    sitemap_directive: sitemaps[0] ?? null,
  };
}

// ── sitemap.xml (lightweight, dependency-free XML scan) ─────────────────────

export function countTags(xml, tag) {
  const re = new RegExp(`<${tag}\\b`, "gi");
  return (xml.match(re) ?? []).length;
}

async function checkSitemap(origin, sitemapDirective, timeoutMs) {
  const url = sitemapDirective || new URL("/sitemap.xml", origin).toString();
  const res = await safeFetch(url, { timeoutMs });

  if (res.error) {
    return { status: "error", http_status: null, url, detail: res.error, url_count: null, is_index: false };
  }
  if (!res.ok) {
    return { status: "fail", http_status: res.status, url, detail: `sitemap not reachable (HTTP ${res.status ?? "?"})`, url_count: null, is_index: false };
  }

  const isIndex = /<sitemapindex\b/i.test(res.text);
  const urlCount = isIndex ? countTags(res.text, "sitemap") : countTags(res.text, "url");

  return {
    status: "pass",
    http_status: res.status,
    url,
    detail: isIndex
      ? `Sitemap index with ${urlCount} child sitemap(s).`
      : `Sitemap with ${urlCount} URL(s).`,
    url_count: urlCount,
    is_index: isIndex,
  };
}

// ── staging / test subdomain exposure ────────────────────────────────────────

export function extractTitle(html) {
  const m = html?.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

export function tokenSet(text) {
  return new Set(
    (text ?? "")
      .toLowerCase()
      .replace(/<[^>]+>/g, " ")
      .split(/[^a-z0-9一-龥]+/)
      .filter((t) => t.length > 1)
  );
}

export function jaccardSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return null;
  let intersection = 0;
  for (const tok of a) if (b.has(tok)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? null : intersection / union;
}

async function probeStagingHost(prefix, rootHost, timeoutMs, prodTokens) {
  const host = `${prefix}.${rootHost}`;
  const res = await safeFetch(`https://${host}`, { timeoutMs, redirect: "manual" });

  if (res.error) {
    // DNS failure / connection refused / blocked-private-target all read as
    // "this staging host isn't publicly reachable" — not a finding.
    return { host, reachable: false };
  }
  if (res.status !== 200) {
    return { host, reachable: false, http_status: res.status };
  }

  const noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(res.text ?? "");
  const title = extractTitle(res.text);
  const similarity = prodTokens ? jaccardSimilarity(tokenSet(res.text), prodTokens) : null;

  return { host, reachable: true, http_status: 200, noindex, title, similarity };
}

async function checkStagingSubdomains(origin, timeoutMs) {
  const rootHost = new URL(origin).hostname;
  const prodRes = await safeFetch(origin, { timeoutMs });
  const prodTokens = prodRes.ok ? tokenSet(prodRes.text) : null;

  const probes = await Promise.all(
    STAGING_PREFIXES.map((p) => probeStagingHost(p, rootHost, timeoutMs, prodTokens))
  );
  const publicHosts = probes.filter((p) => p.reachable);

  if (publicHosts.length === 0) {
    return { status: "pass", checked_hosts: STAGING_PREFIXES.map((p) => `${p}.${rootHost}`), public_hosts: [], detail: "No public staging/test subdomain detected." };
  }

  const protectedByNoindex = publicHosts.every((h) => h.noindex);
  if (protectedByNoindex) {
    return {
      status: "pass",
      checked_hosts: STAGING_PREFIXES.map((p) => `${p}.${rootHost}`),
      public_hosts: publicHosts.map((h) => h.host),
      detail: "Public staging host(s) found but all carry a noindex tag.",
    };
  }

  const highSimilarity = publicHosts.filter((h) => h.similarity !== null && h.similarity >= 0.6);
  const unknownSimilarity = publicHosts.filter((h) => h.similarity === null);

  if (highSimilarity.length > 0) {
    return {
      status: "fail",
      checked_hosts: STAGING_PREFIXES.map((p) => `${p}.${rootHost}`),
      public_hosts: publicHosts.map((h) => h.host),
      similar_hosts: highSimilarity.map((h) => h.host),
      detail: `${highSimilarity.map((h) => h.host).join(", ")} is publicly accessible, unprotected, and closely mirrors production content.`,
    };
  }

  return {
    status: "warn",
    checked_hosts: STAGING_PREFIXES.map((p) => `${p}.${rootHost}`),
    public_hosts: publicHosts.map((h) => h.host),
    detail: unknownSimilarity.length
      ? `${unknownSimilarity.map((h) => h.host).join(", ")} is publicly accessible; similarity to production could not be confirmed (production page fetch failed or returned no content).`
      : "Public staging host(s) found but content similarity to production is low — likely a genuinely separate site, confirm manually.",
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function getArg(args, flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
}

export async function runSiteSignals(origin, { timeoutMs = 10_000 } = {}) {
  const robots = await checkRobots(origin, timeoutMs);
  const sitemap = await checkSitemap(origin, robots.sitemap_directive, timeoutMs);
  const staging_subdomains = await checkStagingSubdomains(origin, timeoutMs);
  return { origin, robots, sitemap, staging_subdomains };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const origin = args[0];
  const timeoutMs = Number(getArg(args, "--timeout", "10000"));

  if (!origin) {
    process.stderr.write("Usage: check-site-signals.mjs <origin-url> [--timeout <ms>]\n");
    process.exit(1);
  }

  const result = await runSiteSignals(origin, { timeoutMs });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
