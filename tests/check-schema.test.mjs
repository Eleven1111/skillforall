import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSchema, REQUIRED_FIELDS } from "../scripts/check-schema.mjs";

function ldScript(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

test("fails when the page has no JSON-LD at all", () => {
  const result = checkSchema("<html><body>no schema here</body></html>");
  assert.equal(result.status, "fail");
  assert.equal(result.schemas.length, 0);
});

test("fails on malformed JSON-LD", () => {
  const html = `<script type="application/ld+json">{ not: valid json }</script>`;
  const result = checkSchema(html);
  assert.equal(result.status, "fail");
  assert.ok(result.parse_errors.length > 0);
});

test("passes a complete WebSite schema", () => {
  const html = ldScript({ "@context": "https://schema.org", "@type": "WebSite", name: "Acme", url: "https://acme.com" });
  const result = checkSchema(html);
  assert.equal(result.status, "pass");
  assert.equal(result.schemas[0].matched_type, "WebSite");
});

test("fails a Product missing a required field", () => {
  const html = ldScript({ "@type": "Product", name: "Serum", image: "https://acme.com/a.jpg" });
  const result = checkSchema(html);
  assert.equal(result.status, "fail");
  assert.deepEqual(result.schemas[0].fields_missing, ["offers"]);
});

test("flags Product.offers missing nested price fields even when offers exists", () => {
  const html = ldScript({
    "@type": "Product",
    name: "Serum",
    image: "https://acme.com/a.jpg",
    offers: { "@type": "Offer" },
  });
  const result = checkSchema(html);
  assert.equal(result.status, "fail");
  assert.ok(result.schemas[0].nested_issues.includes("offers.price missing"));
  assert.ok(result.schemas[0].nested_issues.includes("offers.priceCurrency missing"));
});

test("warns (not fails) when only a recommended field is missing", () => {
  const html = ldScript({
    "@type": "Product",
    name: "Serum",
    image: "https://acme.com/a.jpg",
    offers: { "@type": "Offer", price: "29.00", priceCurrency: "USD" },
  });
  const result = checkSchema(html);
  assert.equal(result.status, "warn");
  assert.ok(result.schemas[0].recommended_missing.includes("aggregateRating"));
});

test("handles @graph arrays with multiple nodes", () => {
  const html = ldScript({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Acme", url: "https://acme.com" },
      { "@type": "Organization", name: "Acme Inc" }, // missing url + logo
    ],
  });
  const result = checkSchema(html);
  assert.equal(result.schemas.length, 2);
  assert.equal(result.schemas[0].status, "pass");
  assert.equal(result.schemas[1].status, "fail");
  assert.deepEqual(result.schemas[1].fields_missing, ["url", "logo"]);
});

test("an unrecognized @type is reported as info, not a failure", () => {
  const html = ldScript({ "@type": "LocalBusiness", name: "Acme Cafe" });
  const result = checkSchema(html);
  assert.equal(result.schemas[0].status, "info");
  assert.equal(result.status, "pass"); // no fail/warn schemas present
});

test("REQUIRED_FIELDS matches the table documented in mc-seo/SKILL.md", () => {
  assert.deepEqual(Object.keys(REQUIRED_FIELDS).sort(), [
    "Article",
    "BreadcrumbList",
    "FAQPage",
    "Organization",
    "Product",
    "WebSite",
  ]);
});
