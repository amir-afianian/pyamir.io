#!/bin/sh
# Builds dist/liquid-glass-card.zip with the skill folder at the archive root,
# the layout claude.ai's skill upload expects.
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
skill=liquid-glass-card
out="$repo_root/dist/$skill.zip"

if [ ! -f "$repo_root/skills/$skill/SKILL.md" ]; then
  echo "build-skill-zip: skills/$skill/SKILL.md not found" >&2
  exit 1
fi

mkdir -p "$repo_root/dist"
rm -f "$out"
(cd "$repo_root/skills" && zip -qr -X "$out" "$skill" -x '*.DS_Store')
echo "Built $out"
