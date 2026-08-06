#!/usr/bin/env node
/**
 * check-schema.mjs — JSON-LD structured-data validator (mc-seo 模块 3)
 *
 * Extracts <script type="application/ld+json"> blocks and checks required
 * fields per @type against the table in mc-seo/SKILL.md — keep the two in
 * sync if the required-fields table there changes.
 *
 * Usage:
 *   node scripts/check-schema.mjs <url> [--timeout <ms>]
 *   node scripts/check-schema.mjs --file <path-to-html>
 *
 * URL mode goes through lib.mjs's safeFetch (SSRF-guarded). --file mode reads
 * a local file and never makes a network request.
 *
 * Dependencies: none (Node built-in fetch/fs only).
 */

import { readFileSync } from "fs";
import { safeFetch } from "./lib.mjs";

// Mirrors the required-fields table in skills/mc-seo/SKILL.md § 结构化数据.
export const REQUIRED_FIELDS = {
  WebSite: ["name", "url"],
  Organization: ["name", "url", "logo"],
  Product: ["name", "image", "offers"],
  Article: ["headline", "author", "datePublished"],
  FAQPage: ["mainEntity"],
  BreadcrumbList: ["itemListElement"],
};

const RECOMMENDED_FIELDS = {
  Product: ["aggregateRating", "review"],
  Article: ["dateModified", "image"],
};

function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

function normalizeToNodes(parsed) {
  // A JSON-LD document can be a single object, an array, or use @graph.
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed["@graph"])) return parsed["@graph"];
  return [parsed];
}

function typesOf(node) {
  const t = node?.["@type"];
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
}

function checkNode(node) {
  const types = typesOf(node);
  const knownType = types.find((t) => REQUIRED_FIELDS[t]);

  if (!knownType) {
    return {
      types,
      status: "info",
      detail: types.length ? `@type ${types.join(", ")} — no required-fields rule defined for this type.` : "Missing @type.",
      fields_missing: [],
      recommended_missing: [],
    };
  }

  const required = REQUIRED_FIELDS[knownType];
  const recommended = RECOMMENDED_FIELDS[knownType] ?? [];
  const missing = required.filter((f) => node[f] === undefined || node[f] === null || node[f] === "");
  const recommendedMissing = recommended.filter((f) => node[f] === undefined || node[f] === null);

  // A minimal presence check for the one nested shape called out in the
  // SKILL.md table: Product.offers must at least carry price/priceCurrency.
  const nestedIssues = [];
  if (knownType === "Product" && node.offers && !missing.includes("offers")) {
    const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    if (!offers?.price) nestedIssues.push("offers.price missing");
    if (!offers?.priceCurrency) nestedIssues.push("offers.priceCurrency missing");
  }
  if (knownType === "Article" && !missing.includes("author")) {
    if (!node.author?.name && typeof node.author !== "string") {
      nestedIssues.push("author present but has no name");
    }
  }

  let status = "pass";
  if (missing.length > 0 || nestedIssues.length > 0) status = "fail";
  else if (recommendedMissing.length > 0) status = "warn";

  return {
    types,
    matched_type: knownType,
    status,
    fields_missing: missing,
    recommended_missing: recommendedMissing,
    nested_issues: nestedIssues,
    detail:
      status === "fail"
        ? `${knownType}: missing required field(s) ${[...missing, ...nestedIssues].join(", ")}`
        : status === "warn"
          ? `${knownType}: missing recommended field(s) ${recommendedMissing.join(", ")}`
          : `${knownType}: required fields present.`,
  };
}

export function checkSchema(html) {
  const blocks = extractJsonLdBlocks(html ?? "");
  if (blocks.length === 0) {
    return { status: "fail", detail: "No JSON-LD (<script type=\"application/ld+json\">) found on the page.", schemas: [] };
  }

  const schemas = [];
  const parseErrors = [];

  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(block);
    } catch (err) {
      parseErrors.push(err.message);
      continue;
    }
    for (const node of normalizeToNodes(parsed)) {
      schemas.push(checkNode(node));
    }
  }

  if (parseErrors.length > 0 && schemas.length === 0) {
    return { status: "fail", detail: `JSON-LD present but unparseable: ${parseErrors.join("; ")}`, schemas: [], parse_errors: parseErrors };
  }

  const anyFail = schemas.some((s) => s.status === "fail") || parseErrors.length > 0;
  const anyWarn = schemas.some((s) => s.status === "warn");
  const status = anyFail ? "fail" : anyWarn ? "warn" : "pass";

  return {
    status,
    detail: `${schemas.length} schema node(s) found across ${blocks.length} JSON-LD block(s).`,
    schemas,
    parse_errors: parseErrors,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function getArg(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const filePath = getArg(args, "--file");
  const timeoutMs = Number(getArg(args, "--timeout") ?? "10000");
  const url = filePath ? null : args[0];

  if (!filePath && !url) {
    process.stderr.write("Usage: check-schema.mjs <url> | --file <path>\n");
    process.exit(1);
  }

  let html;
  if (filePath) {
    html = readFileSync(filePath, "utf-8");
  } else {
    const res = await safeFetch(url, { timeoutMs });
    if (res.error) {
      process.stderr.write(`[check-schema] fetch failed: ${res.error}\n`);
      process.exit(1);
    }
    html = res.text;
  }

  const result = checkSchema(html);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
