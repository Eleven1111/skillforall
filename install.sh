#!/usr/bin/env bash
# MarketerClaw installer  v2.1
# Usage:
#   ./install.sh               → installs to ~/.openclaw/skills/ + ~/.openclaw/scripts/
#   ./install.sh --claude      → installs to ~/.claude/skills/   (Claude Code)
#   ./install.sh --hermes      → installs to ~/.hermes/skills/   (Hermes Agent)
#   ./install.sh /path/to/ws   → installs to /path/to/ws/skills/ + /path/to/ws/scripts/
#   ./install.sh --local       → installs to ./skills/ + ./scripts/ (current workspace)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SRC="$REPO_DIR/skills"
SCRIPTS_SRC="$REPO_DIR/scripts"

# Resolve target
case "${1:-}" in
  --local)  BASE_DIR="$(pwd)" ;;
  --claude) BASE_DIR="$HOME/.claude" ;;
  --hermes) BASE_DIR="$HOME/.hermes" ;;
  "")       BASE_DIR="$HOME/.openclaw" ;;
  *)        BASE_DIR="${1}" ;;
esac

TARGET_DIR="$BASE_DIR/skills"
SCRIPTS_DST="$BASE_DIR/scripts"

# Skills to install (all mc-* by default, or pass skill names as extra args)
if [[ $# -gt 1 ]]; then
  SKILLS=("${@:2}")
else
  SKILLS=($(ls "$SKILLS_SRC"))
fi

echo ""
echo "  MarketerClaw Installer v2.0"
echo "  ─────────────────────────────────────"
echo "  Source skills  : $SKILLS_SRC"
echo "  Source scripts : $SCRIPTS_SRC"
echo "  Target skills  : $TARGET_DIR"
echo "  Target scripts : $SCRIPTS_DST"
echo "  Skills         : ${SKILLS[*]}"
echo "  ─────────────────────────────────────"
echo ""

mkdir -p "$TARGET_DIR"

installed=0
for skill in "${SKILLS[@]}"; do
  src="$SKILLS_SRC/$skill"
  dst="$TARGET_DIR/$skill"

  if [[ ! -d "$src" ]]; then
    echo "  ⚠  Skipping '$skill' (not found in $SKILLS_SRC)"
    continue
  fi

  rm -rf "$dst"
  cp -R "$src" "$dst"
  echo "  ✅ $skill → $dst"
  installed=$((installed + 1))
done

# Install scripts/ alongside skills/ so mc-cmo can find them
if [[ -d "$SCRIPTS_SRC" ]]; then
  mkdir -p "$SCRIPTS_DST"
  cp -R "$SCRIPTS_SRC/." "$SCRIPTS_DST/"
  echo "  ✅ scripts → $SCRIPTS_DST"
else
  echo "  ⚠  scripts/ not found in repo — skipping (mc-cmo may not work)"
fi

# ── Fingerprint watermarking ────────────────────────────────────────────────
# Embed invisible installation ID into all SKILL.md files for traceability

FINGERPRINT="$SCRIPTS_DST/fingerprint.mjs"
if [[ -f "$FINGERPRINT" ]] && command -v node &>/dev/null; then
  echo "  🔏 Embedding installation fingerprint..."
  FP_RESULT=$(node "$FINGERPRINT" --embed "$TARGET_DIR" 2>/dev/null || echo '{"error":true}')
  FP_ID=$(echo "$FP_RESULT" | grep -o '"installationId":"[^"]*"' | cut -d'"' -f4)
  if [[ -n "$FP_ID" ]]; then
    echo "  ✅ Fingerprint: $FP_ID"
  else
    echo "  ⚠  Fingerprint embedding skipped (non-fatal)"
  fi
else
  echo "  ⚠  Node.js not found or fingerprint.mjs missing — skipping watermark"
fi

echo ""
echo "  Installed $installed skill(s) to $TARGET_DIR"
echo "  Scripts installed to $SCRIPTS_DST"
echo ""
echo "  Usage in OpenClaw:"
echo "    新品上市，产品是轻养零糖茶，目标人群 25-35 岁都市白领..."
echo "    We're launching a DTC skincare brand in the US market..."
echo ""
