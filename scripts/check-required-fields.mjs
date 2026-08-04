#!/usr/bin/env node
/**
 * check-required-fields.mjs — Required-section presence lint (warning-only)
 *
 * mc-campaign's SKILL.md states, per step, what each output "必须包含". Nothing
 * checked it: an incomplete strategy.md would flow into content generation and
 * only surface at the 双审 gate several steps later, after the incomplete
 * premise had already been built on.
 *
 * This checks *presence*, not quality — a section that exists but is thin still
 * passes. Presence is the part a machine can judge; whether 核心传播主张 is any
 * good is what mc-review and the user are for.
 *
 * Deliberately warning-only: outputs are markdown written for humans, and a
 * hard schema gate would fight that. A warning that reaches the operator before
 * the next step starts is enough.
 *
 * Used by finalize.mjs (warnings → stderr, never blocks delivery).
 * CLI: node scripts/check-required-fields.mjs <file.md> [--as brief.md]
 */

import { readFileSync } from "fs";
import { basename } from "path";

/**
 * Fields are lifted verbatim from mc-campaign/SKILL.md — 第一步 brief.md
 * template and 第二步「必须包含」list. Keep them in sync: if the skill's
 * required list changes, this table must change with it.
 */
export const REQUIRED_FIELDS = {
  "brief.md": {
    source: "mc-campaign 第一步 · 产出：brief.md",
    fields: ["基本信息", "人群", "品牌", "阵地", "竞品", "风险边界", "交付要求"],
  },
  "strategy.md": {
    source: "mc-campaign 第二步 · 必须包含",
    fields: ["核心传播主张", "信息屋", "竞品差异化", "阶段节奏", "预算分配"],
  },
};

export function schemaFor(file) {
  return REQUIRED_FIELDS[basename(String(file ?? ""))] ?? null;
}

export function checkRequiredFields(content, file) {
  const schema = schemaFor(file);
  if (!schema) return [];

  // Strip fenced blocks so a template shown as an example inside ``` does not
  // satisfy the check for a document that never actually filled it in.
  const body = content.replace(/^\s*(?:```|~~~)[\s\S]*?(?:```|~~~)\s*$/gm, "");

  return schema.fields
    .filter((field) => !body.includes(field))
    .map((field) => ({ field, source: schema.source }));
}

export function formatWarnings(warnings, label = "") {
  if (warnings.length === 0) return "";
  const head = `[fields] ⚠ ${label}缺少 ${warnings.length} 个必须包含的部分（依据 ${warnings[0].source}）：\n`;
  const lines = warnings.map((w) => `  · ${w.field}`).join("\n");
  return head + lines + "\n";
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args[0];
  const asIdx = args.indexOf("--as");
  const asName = asIdx >= 0 ? args[asIdx + 1] : file;

  if (!file) {
    process.stderr.write("Usage: check-required-fields.mjs <file.md> [--as brief.md]\n");
    process.exit(1);
  }
  const warnings = checkRequiredFields(readFileSync(file, "utf-8"), asName);
  process.stderr.write(formatWarnings(warnings, `${file}: `) || `[fields] ✓ ${file}\n`);
  process.exit(0);
}
