#!/usr/bin/env node
/**
 * check-banned-phrases.mjs — AI-slop / filler-phrase lint (warning-only)
 *
 * Scans copy-type output for phrases that signal machine-generated filler:
 * hollow openers, stock parallelisms, and marketing verbs that carry no
 * information. These weaken copy without being *wrong*, so a human reviewer
 * routinely misses them — which is exactly what a lint is for.
 *
 * Scope is deliberately narrow (copy.md / content/*.md / aigc.md). Strategy and
 * brand documents legitimately use vocabulary that would be filler in ad copy
 * (e.g. 心智, 定位, 赋能 in a positioning rationale), so linting them would be
 * pure noise.
 *
 * NOT an ad-law check. 绝对化用语（最/第一/唯一/国家级）and other regulatory
 * risks belong to mc-review, which owns compliance across 6 jurisdictions —
 * duplicating those rules here would create two sources of truth.
 *
 * Used by finalize.mjs (warnings → stderr, never blocks delivery).
 * CLI: node scripts/check-banned-phrases.mjs <file.md>
 */

import { readFileSync } from "fs";

// Only these outputs get linted — see scope note above.
const COPY_FILE_PATTERN = /(?:^|\/)(?:copy|aigc)\.md$|(?:^|\/)content\//;

export function isCopyFile(file) {
  return COPY_FILE_PATTERN.test(String(file ?? ""));
}

/**
 * Each rule: { pattern, hint }. Patterns stay high-precision — a noisy lint
 * gets muted, and a muted lint protects nothing.
 */
const BANNED = [
  // ── 中文：空洞开场 ──
  { pattern: /在当今[这个]*[^，。\n]{0,8}(?:时代|社会|世界|市场)/, hint: "空洞开场，删掉后句子通常更有力" },
  { pattern: /随着[^，。\n]{0,12}的(?:不断)?(?:发展|提升|进步|普及)/, hint: "教科书式开场，与用户无关" },
  { pattern: /众所周知/, hint: "既然众所周知就不必写" },
  { pattern: /值得一提的是/, hint: "填充语，删掉不影响信息" },
  // ── 中文：万能动词 ──
  { pattern: /赋能|助力/, hint: "行业黑话，用具体动作替代（帮谁做成了什么）" },
  { pattern: /匠心(?:独运|精神)?|倾力打造/, hint: "陈词，读者已免疫" },
  { pattern: /一站式解决方案|无缝(?:衔接|对接)/, hint: "B端套话，说不出具体好处" },
  { pattern: /开启[^，。\n]{0,6}新篇章|探索无限可能|引领[^，。\n]{0,6}新(?:潮流|风尚)/, hint: "空口号，无信息量" },
  // ── 中文：套式排比 ──
  { pattern: /不仅仅?是[^，。\n]{1,20}[，,]\s*更是/, hint: "AI 高频句式，改成具体对比更可信" },
  { pattern: /让我们一起/, hint: "生硬号召，改成对读者说话" },
  // ── English: stock openers & verbs ──
  { pattern: /in today's\s+(?:fast[- ]paced|digital|competitive|modern)/i, hint: "stock opener — cut it" },
  { pattern: /unlock\s+(?:your|the|its)?\s*(?:full\s+)?potential/i, hint: "empty promise — say what changes" },
  { pattern: /game[- ]chang(?:er|ing)/i, hint: "overclaim with no evidence" },
  { pattern: /revolutioniz(?:e|ing|es)/i, hint: "overclaim — describe the actual change" },
  { pattern: /take\s+(?:it|your\s+\w+)\s+to\s+the\s+next\s+level/i, hint: "says nothing concrete" },
  { pattern: /seamless(?:ly)?\s+(?:integrat|experienc|connect)/i, hint: "vendor filler" },
  { pattern: /(?:delve|dive)\s+into/i, hint: "AI tell — use a plain verb" },
  { pattern: /elevate\s+your/i, hint: "vague uplift verb" },
  { pattern: /cutting[- ]edge|state[- ]of[- ]the[- ]art/i, hint: "unfalsifiable — name the actual capability" },
  { pattern: /it's\s+not\s+just\s+[^,.\n]{1,24},\s*it's/i, hint: "stock parallelism" },
  { pattern: /a\s+testament\s+to/i, hint: "AI tell" },
];

// Lines that are structural, not copy.
const SKIP_PATTERNS = [
  /^\s*\|[\s:-]+\|/, // table separator
  /^\s*#{1,6}\s/, // headings
  /^\s*>/, // quoted / example blocks
  /^\s*[-*]\s*\[\s*[x ]\s*\]/i, // checklists
];

export function checkBannedPhrases(content) {
  const warnings = [];
  let inFence = false;

  content.split("\n").forEach((line, idx) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (SKIP_PATTERNS.some((p) => p.test(line))) return;

    for (const rule of BANNED) {
      const m = line.match(rule.pattern);
      if (m) {
        warnings.push({ line: idx + 1, phrase: m[0], hint: rule.hint });
        break; // one warning per line keeps output readable
      }
    }
  });

  return warnings;
}

export function formatWarnings(warnings, label = "") {
  if (warnings.length === 0) return "";
  const head = `[phrases] ⚠ ${label}${warnings.length} 处疑似 AI 味/填充语：\n`;
  const lines = warnings
    .slice(0, 10)
    .map((w) => `  L${w.line}: 「${w.phrase}」— ${w.hint}`)
    .join("\n");
  const more = warnings.length > 10 ? `\n  ... 及另外 ${warnings.length - 10} 处` : "";
  return head + lines + more + "\n";
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write("Usage: check-banned-phrases.mjs <file.md>\n");
    process.exit(1);
  }
  const warnings = checkBannedPhrases(readFileSync(file, "utf-8"));
  process.stderr.write(formatWarnings(warnings, `${file}: `) || `[phrases] ✓ ${file}\n`);
  process.exit(0);
}
