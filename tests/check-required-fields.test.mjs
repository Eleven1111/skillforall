import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkRequiredFields,
  schemaFor,
  REQUIRED_FIELDS,
} from "../scripts/check-required-fields.mjs";

test("reports every missing section for strategy.md", () => {
  const w = checkRequiredFields("# 策略\n\n## 核心传播主张\n轻养不苦。\n", "strategy.md");
  const missing = w.map((x) => x.field);
  assert.deepEqual(missing, ["信息屋", "竞品差异化", "阶段节奏", "预算分配"]);
});

test("passes a complete strategy.md", () => {
  const complete = REQUIRED_FIELDS["strategy.md"].fields
    .map((f) => `## ${f}\n内容\n`)
    .join("\n");
  assert.deepEqual(checkRequiredFields(complete, "strategy.md"), []);
});

test("a template inside a fenced block does not satisfy the check", () => {
  const content = ["# 策略", "", "```markdown", "## 核心传播主张", "## 信息屋", "```", ""].join("\n");
  const missing = checkRequiredFields(content, "strategy.md").map((x) => x.field);
  assert.ok(missing.includes("核心传播主张"), "fenced template must not count as present");
  assert.equal(missing.length, REQUIRED_FIELDS["strategy.md"].fields.length);
});

test("brief.md uses its own field list", () => {
  const w = checkRequiredFields("## 基本信息\n## 人群\n", "brief.md");
  assert.deepEqual(w.map((x) => x.field), ["品牌", "阵地", "竞品", "风险边界", "交付要求"]);
});

test("files with no declared schema are skipped", () => {
  assert.deepEqual(checkRequiredFields("任意内容", "seo.md"), []);
  assert.equal(schemaFor("seo.md"), null);
});

test("schema resolves by basename, not full path", () => {
  assert.notEqual(schemaFor("campaigns/foo/strategy.md"), null);
});
