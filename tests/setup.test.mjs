import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SLUG = "test-review-loop-fixture";
const dir = join(ROOT, "campaigns", SLUG);

function cleanup() {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

test("setup.mjs initializes review_loop with defaults", () => {
  cleanup();
  execFileSync("node", ["scripts/setup.mjs", "--slug", SLUG, "--skill", "mc-brand", "--step", "1"], { cwd: ROOT });
  const status = JSON.parse(readFileSync(join(dir, ".status.json"), "utf-8"));
  assert.deepEqual(status.review_loop, { iteration: 0, max: 3, last_verdict: null, blocked_files: [] });
  cleanup();
});

test("setup.mjs preserves existing review_loop on re-run", () => {
  cleanup();
  execFileSync("node", ["scripts/setup.mjs", "--slug", SLUG, "--skill", "mc-brand", "--step", "1"], { cwd: ROOT });
  const p = join(dir, ".status.json");
  const s = JSON.parse(readFileSync(p, "utf-8"));
  s.review_loop.iteration = 2;
  writeFileSync(p, JSON.stringify(s, null, 2));
  execFileSync("node", ["scripts/setup.mjs", "--slug", SLUG, "--skill", "mc-review", "--step", "18"], { cwd: ROOT });
  const after = JSON.parse(readFileSync(p, "utf-8"));
  assert.equal(after.review_loop.iteration, 2);
  cleanup();
});

test("setup.mjs persists --tier for resume detection", () => {
  cleanup();
  execFileSync("node", ["scripts/setup.mjs", "--slug", SLUG, "--skill", "mc-brand", "--step", "1", "--tier", "B"], { cwd: ROOT });
  const status = JSON.parse(readFileSync(join(dir, ".status.json"), "utf-8"));
  assert.equal(status.tier, "B");
  cleanup();
});

test("setup.mjs preserves tier on re-run when --tier omitted", () => {
  cleanup();
  execFileSync("node", ["scripts/setup.mjs", "--slug", SLUG, "--skill", "mc-brand", "--step", "1", "--tier", "C"], { cwd: ROOT });
  execFileSync("node", ["scripts/setup.mjs", "--slug", SLUG, "--skill", "mc-storyteller", "--step", "3"], { cwd: ROOT });
  const status = JSON.parse(readFileSync(join(dir, ".status.json"), "utf-8"));
  assert.equal(status.tier, "C");
  cleanup();
});
