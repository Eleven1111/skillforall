#!/usr/bin/env node
/**
 * setup.mjs — Campaign initializer
 *
 * Usage:
 *   node scripts/setup.mjs --slug <slug> [--skill <skill>] [--step <step>] [--tier <A|B|C>]
 *
 * --tier persists mc-orchestrate's chosen execution depth (A/B/C) into
 * .status.json so a resumed session can re-derive which dependency table
 * applies without asking the user to pick again.
 *
 * Creates campaigns/{slug}/ and writes an initial .status.json.
 * Outputs the campaign directory path to stdout.
 *
 * campaigns/ resolution: MC_WORKSPACE env → cwd → script-relative (see lib.mjs).
 */

import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sanitizeSlug, resolveCampaignsDir, mutateStatus } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAMPAIGNS_DIR = resolveCampaignsDir(__dirname);

// ── Arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] ?? null : null;
};

let slug = get("--slug");
const skill = get("--skill");
const step = get("--step");
const tier = get("--tier");

if (!slug) {
  // Auto-generate slug from timestamp + skill
  const ts = new Date().toISOString().slice(0, 10);
  slug = `${skill ?? "campaign"}-${ts}`;
  process.stderr.write(`[setup] No --slug provided, using: ${slug}\n`);
}

slug = sanitizeSlug(slug);
if (!slug) {
  process.stderr.write("[setup] Error: slug is empty after sanitization\n");
  process.exit(1);
}

// ── Create campaign directory ─────────────────────────────────────────────────

const campaignDir = join(CAMPAIGNS_DIR, slug);
mkdirSync(campaignDir, { recursive: true });
mkdirSync(join(campaignDir, "content"), { recursive: true });

// ── Init / update .status.json (transactional) ───────────────────────────────

const now = new Date().toISOString();

await mutateStatus(campaignDir, (prev) => {
  const status = {
    ...prev,
    campaignSlug: slug,
    currentSkill: skill ?? prev.currentSkill ?? null,
    currentStep: step ?? prev.currentStep ?? null,
    tier: tier ?? prev.tier ?? null,
    status: "running",
    startedAt: prev.startedAt ?? now,
    updatedAt: now,
    steps: prev.steps ?? {},
    log: prev.log ?? [],
    review_loop: prev.review_loop ?? { iteration: 0, max: 3, last_verdict: null, blocked_files: [] },
  };

  if (step && !status.steps[step]) {
    status.steps[step] = { status: "running", startedAt: now };
  }

  status.log.push({
    time: now,
    level: "info",
    message: `▶ ${skill ?? "campaign"} · ${step ?? "init"}`,
  });

  // Keep log bounded
  if (status.log.length > 200) {
    status.log = status.log.slice(-200);
  }

  return status;
});

// ── Output ────────────────────────────────────────────────────────────────────

process.stdout.write(`campaigns/${slug}\n`);
