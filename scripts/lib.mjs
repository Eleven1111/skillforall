/**
 * lib.mjs — Shared helpers for setup.mjs / finalize.mjs / check-*.mjs
 *
 * - sanitizeSlug:        single source of truth for slug normalization
 * - resolveCampaignsDir: workspace-anchored campaigns/ resolution
 * - mutateStatus:        transactional read-modify-write of .status.json
 *                        guarded by a lock directory (parallel batches in
 *                        mc-orchestrate run several finalize processes at once)
 * - safeFetch:           SSRF-guarded fetch for scripts that hit external
 *                        URLs (check-site-signals.mjs, check-schema.mjs)
 */

import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  rmdirSync,
  statSync,
  existsSync,
} from "fs";
import { resolve, join, dirname } from "path";
import { lookup as dnsLookup } from "dns/promises";
import { isIPv4, isIPv6 } from "net";

export function sanitizeSlug(slug) {
  return String(slug)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_一-鿿]/g, "");
}

/**
 * Resolution order:
 *   1. MC_WORKSPACE env var (explicit override)
 *   2. cwd, if it already contains a campaigns/ dir (normal workspace run)
 *   3. script-relative ../campaigns, if it exists (legacy local-repo layout)
 *   4. cwd (fresh workspace — campaigns/ will be created here)
 */
export function resolveCampaignsDir(scriptDir) {
  if (process.env.MC_WORKSPACE) {
    return resolve(process.env.MC_WORKSPACE, "campaigns");
  }
  const cwdCampaigns = resolve(process.cwd(), "campaigns");
  if (existsSync(cwdCampaigns)) return cwdCampaigns;

  const scriptCampaigns = resolve(scriptDir, "..", "campaigns");
  if (existsSync(scriptCampaigns)) return scriptCampaigns;

  return cwdCampaigns;
}

const LOCK_STALE_MS = 30_000;
const LOCK_TIMEOUT_MS = 10_000;
const LOCK_RETRY_MS = 50;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquireLock(lockPath) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      mkdirSync(lockPath);
      return;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
          rmdirSync(lockPath);
          continue;
        }
      } catch {
        continue; // lock vanished between checks — retry immediately
      }
      if (Date.now() > deadline) {
        throw new Error(`timed out waiting for status lock: ${lockPath}`);
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
}

function releaseLock(lockPath) {
  try {
    rmdirSync(lockPath);
  } catch {
    // Non-fatal: stale-lock reclaim will clean up
  }
}

/**
 * Transactionally mutate campaigns/{slug}/.status.json.
 * `mutator(status)` receives the freshly-read status object and must return
 * the object to persist. Write is atomic (temp file + rename).
 */
export async function mutateStatus(campaignDir, mutator) {
  const statusPath = join(campaignDir, ".status.json");
  const lockPath = statusPath + ".lock";

  await acquireLock(lockPath);
  try {
    let status = {};
    if (existsSync(statusPath)) {
      try {
        status = JSON.parse(readFileSync(statusPath, "utf-8"));
      } catch {
        // Corrupt status file — reset
      }
    }
    status = mutator(status) ?? status;
    const tmpPath = statusPath + `.tmp-${process.pid}`;
    mkdirSync(dirname(statusPath), { recursive: true });
    writeFileSync(tmpPath, JSON.stringify(status, null, 2), "utf-8");
    renameSync(tmpPath, statusPath);
    return status;
  } finally {
    releaseLock(lockPath);
  }
}

// ── SSRF-guarded fetch ───────────────────────────────────────────────────────
//
// mc-seo's site-signal scripts fetch user-supplied URLs (robots.txt, sitemap,
// staging subdomains, page HTML for schema checks). A URL that resolves to a
// private/loopback address must not be fetched — otherwise "audit this URL"
// becomes a way to probe the internal network the script runs on.

// A bare "compatible; XSEO/1.0" UA gets challenge-blocked by most bot
// protection (Cloudflare, IMDb, npmjs all returned 202/403 in testing before
// this change). A standard browser UA string, self-identified via the
// trailing token, is what real audit tools use and is what gets a normal
// server-rendered response instead of a challenge page.
const DEFAULT_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 MarketerClawSEO/1.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIPv4(ip) {
  const n = ipv4ToInt(ip);
  const inRange = (base, maskBits) => {
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  };
  return (
    inRange("10.0.0.0", 8) || // private
    inRange("172.16.0.0", 12) || // private
    inRange("192.168.0.0", 16) || // private
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local
    inRange("0.0.0.0", 8) // "this network"
  );
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local fe80::/10
  if (/^f[cd]/.test(lower)) return true; // unique local fc00::/7
  const v4mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateIPv4(v4mapped[1]);
  return false;
}

/** Exported for testing. Returns true if the given IP string must be blocked. */
export function isBlockedIp(ip) {
  if (isIPv4(ip)) return isPrivateIPv4(ip);
  if (isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unrecognized format — refuse rather than guess
}

/**
 * Resolve `hostname` and refuse if it lands on a private/loopback/reserved
 * address. Throws on refusal; callers report this as a blocked fetch, not a
 * generic network error, so it is never silently swallowed into "not found".
 */
export async function assertPublicHost(hostname) {
  let address;
  try {
    ({ address } = await dnsLookup(hostname));
  } catch (err) {
    throw new Error(`DNS lookup failed for ${hostname}: ${err.message}`);
  }
  if (isBlockedIp(address)) {
    throw new Error(`Blocked: ${hostname} resolves to a private/reserved address (${address})`);
  }
  return address;
}

/**
 * SSRF-guarded fetch with a timeout. Resolves the hostname first and refuses
 * private/loopback/reserved targets before making the request.
 * Returns { ok, status, text, error } — never throws for ordinary network
 * failures (timeout, DNS, connection refused); those come back as
 * `{ ok: false, error }` so callers can render a "warn/error" row instead of
 * crashing the whole audit run.
 */
export async function safeFetch(url, { timeoutMs = 10_000, redirect = "follow" } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, status: null, text: null, error: `Invalid URL: ${url}` };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, status: null, text: null, error: `Unsupported protocol: ${parsed.protocol}` };
  }

  try {
    await assertPublicHost(parsed.hostname);
  } catch (err) {
    return { ok: false, status: null, text: null, error: err.message };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(parsed.toString(), {
      headers: DEFAULT_FETCH_HEADERS,
      redirect,
      signal: controller.signal,
    });
    const text = await resp.text();
    return { ok: resp.ok, status: resp.status, text, error: null, headers: resp.headers };
  } catch (err) {
    const message = err.name === "AbortError" ? `Timed out after ${timeoutMs}ms` : err.message;
    return { ok: false, status: null, text: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}
