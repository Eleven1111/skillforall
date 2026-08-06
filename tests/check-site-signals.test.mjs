import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRobots,
  countTags,
  extractTitle,
  tokenSet,
  jaccardSimilarity,
} from "../scripts/check-site-signals.mjs";
import { isBlockedIp, assertPublicHost, safeFetch } from "../scripts/lib.mjs";

// ── parseRobots ──────────────────────────────────────────────────────────────

test("parseRobots detects blanket disallow for User-agent: *", () => {
  const { disallowAllForStar } = parseRobots("User-agent: *\nDisallow: /\n");
  assert.equal(disallowAllForStar, true);
});

test("parseRobots does not flag a scoped disallow", () => {
  const { disallowAllForStar } = parseRobots("User-agent: *\nDisallow: /admin/\n");
  assert.equal(disallowAllForStar, false);
});

test("parseRobots ignores disallow-all under a non-wildcard agent", () => {
  const { disallowAllForStar } = parseRobots("User-agent: BadBot\nDisallow: /\n");
  assert.equal(disallowAllForStar, false);
});

test("parseRobots extracts one or more Sitemap: directives", () => {
  const { sitemaps } = parseRobots(
    "User-agent: *\nDisallow:\nSitemap: https://example.com/sitemap.xml\nSitemap: https://example.com/sitemap-news.xml\n"
  );
  assert.deepEqual(sitemaps, [
    "https://example.com/sitemap.xml",
    "https://example.com/sitemap-news.xml",
  ]);
});

test("parseRobots ignores comments and blank lines", () => {
  const { disallowAllForStar, sitemaps } = parseRobots(
    "# comment\n\nUser-agent: *  # wildcard\nDisallow: / # blocks everything\n"
  );
  assert.equal(disallowAllForStar, true);
  assert.deepEqual(sitemaps, []);
});

// ── countTags / sitemap shape ────────────────────────────────────────────────

test("countTags counts <url> entries in a regular sitemap", () => {
  const xml = "<urlset><url><loc>a</loc></url><url><loc>b</loc></url></urlset>";
  assert.equal(countTags(xml, "url"), 2);
});

test("countTags counts <sitemap> entries in a sitemap index", () => {
  const xml = "<sitemapindex><sitemap><loc>a</loc></sitemap></sitemapindex>";
  assert.equal(countTags(xml, "sitemap"), 1);
});

// ── extractTitle / tokenSet / jaccardSimilarity ──────────────────────────────

test("extractTitle pulls the <title> text", () => {
  assert.equal(extractTitle("<html><head><title>  My Site  </title></head></html>"), "My Site");
});

test("extractTitle returns null when there is no title tag", () => {
  assert.equal(extractTitle("<html><body>no title here</body></html>"), null);
});

test("jaccardSimilarity is 1 for identical token sets", () => {
  const a = tokenSet("<h1>Welcome to Acme</h1>");
  const b = tokenSet("<h1>Welcome to Acme</h1>");
  assert.equal(jaccardSimilarity(a, b), 1);
});

test("jaccardSimilarity is low for unrelated content", () => {
  const a = tokenSet("Welcome to Acme skincare shop");
  const b = tokenSet("404 page not found error");
  const sim = jaccardSimilarity(a, b);
  assert.ok(sim < 0.2, `expected low similarity, got ${sim}`);
});

test("jaccardSimilarity returns null when either set is empty", () => {
  assert.equal(jaccardSimilarity(tokenSet(""), tokenSet("hello world")), null);
});

// ── SSRF guard (no network required — private/loopback IPs resolve locally) ──

test("isBlockedIp refuses RFC1918 and loopback IPv4 addresses", () => {
  assert.equal(isBlockedIp("10.0.0.5"), true);
  assert.equal(isBlockedIp("172.16.0.1"), true);
  assert.equal(isBlockedIp("192.168.1.1"), true);
  assert.equal(isBlockedIp("127.0.0.1"), true);
  assert.equal(isBlockedIp("169.254.1.1"), true);
});

test("isBlockedIp allows an ordinary public IPv4 address", () => {
  assert.equal(isBlockedIp("8.8.8.8"), false);
});

test("isBlockedIp refuses IPv6 loopback and unique-local addresses", () => {
  assert.equal(isBlockedIp("::1"), true);
  assert.equal(isBlockedIp("fd00::1"), true);
});

test("assertPublicHost throws for localhost", async () => {
  await assert.rejects(() => assertPublicHost("localhost"), /private\/reserved/);
});

test("safeFetch refuses a literal private IP without making a request", async () => {
  const res = await safeFetch("http://127.0.0.1/robots.txt", { timeoutMs: 2000 });
  assert.equal(res.ok, false);
  assert.match(res.error, /private\/reserved/);
});

test("safeFetch refuses non-http(s) protocols", async () => {
  const res = await safeFetch("file:///etc/passwd");
  assert.equal(res.ok, false);
  assert.match(res.error, /Unsupported protocol/);
});

test("safeFetch reports a clean error for an invalid URL instead of throwing", async () => {
  const res = await safeFetch("not a url");
  assert.equal(res.ok, false);
  assert.match(res.error, /Invalid URL/);
});
