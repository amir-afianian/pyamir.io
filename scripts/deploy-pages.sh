#!/bin/sh
# Publishes the skill playgrounds to https://pyamir.io/<skill>/ by uploading the build to the host's edge folder.
# The pyamir-site repo owns the domain's Caddy config (sites/pyamir.io.caddy) and serves these folders from here,
# so this script uploads files only. Host details live in the git-ignored deploy/deploy.env.
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
if [ -f "$repo_root/deploy/deploy.env" ]; then . "$repo_root/deploy/deploy.env"; fi
host=${PYAMIR_HOST:?set it in deploy/deploy.env, see deploy/deploy.env.example}
edge=${PYAMIR_EDGE_DIR:?set it in deploy/deploy.env, see deploy/deploy.env.example}
domain=pyamir.io

node "$repo_root/scripts/build-pages.mjs"
ssh "$host" "mkdir -p $edge/www/$domain"
rsync -az --delete "$repo_root/_site/" "$host:$edge/www/$domain/"
curl -fsS -o /dev/null --retry 5 --retry-delay 3 --retry-all-errors -w "https://$domain/liquid-glass-card/ answered %{http_code}\n" "https://$domain/liquid-glass-card/"
