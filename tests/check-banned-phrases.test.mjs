import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBannedPhrases, isCopyFile } from "../scripts/check-banned-phrases.mjs";

test("flags Chinese filler openers and empty verbs", () => {
  const w = checkBannedPhrases(
    ["在当今这个快节奏的时代，我们需要更好的产品。", "我们赋能每一位创作者。"].join("\n")
  );
  assert.equal(w.length, 2);
  assert.equal(w[0].line, 1);
  assert.match(w[1].phrase, /赋能/);
});

test("flags English AI tells", () => {
  const w = checkBannedPhrases(
    ["Unlock your full potential today.", "This is a game-changer for teams."].join("\n")
  );
  assert.equal(w.length, 2);
});

test("passes concrete copy with no filler", () => {
  const clean = [
    "28 天用完一支，回购率 43%。",
    "Ships in 2 days. Free returns for 90 days.",
    "成分表写在盒子背面，不用扫码。",
  ].join("\n");
  assert.deepEqual(checkBannedPhrases(clean), []);
});

test("skips fenced blocks, headings and quoted examples", () => {
  const content = [
    "## 在当今时代的标题不该被判",
    "> 引用：我们赋能客户",
    "```",
    "在当今这个快节奏的时代",
    "```",
    "正文干净。",
  ].join("\n");
  assert.deepEqual(checkBannedPhrases(content), []);
});

test("reports at most one warning per line", () => {
  const w = checkBannedPhrases("在当今时代，我们赋能并助力每一位用户。");
  assert.equal(w.length, 1);
});

test("isCopyFile scopes the lint to copy-type outputs", () => {
  assert.equal(isCopyFile("copy.md"), true);
  assert.equal(isCopyFile("aigc.md"), true);
  assert.equal(isCopyFile("content/小红书.md"), true);
  assert.equal(isCopyFile("strategy.md"), false);
  assert.equal(isCopyFile("brand.md"), false);
  assert.equal(isCopyFile("review.md"), false);
});
