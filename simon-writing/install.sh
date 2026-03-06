#!/bin/bash
set -e

SKILL_DIR="$HOME/.openclaw/workspace/skills/simon-writing"

echo "Installing simon-writing skill..."

mkdir -p "$SKILL_DIR/references/analysis"
mkdir -p "$SKILL_DIR/references/posts"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cp "$SCRIPT_DIR/SKILL.md" "$SKILL_DIR/SKILL.md"
cp "$SCRIPT_DIR"/references/analysis/*.md "$SKILL_DIR/references/analysis/"
cp "$SCRIPT_DIR"/references/posts/*.md "$SKILL_DIR/references/posts/"

echo "Installed to $SKILL_DIR"
echo ""
echo "Restart the gateway:"
echo "  openclaw gateway restart"
