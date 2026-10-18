#!/bin/sh
# Publishes the site to https://pyamir.io: uploads the build and deploy/pyamir.io.caddy to the host, then reloads its Caddy,
# which imports every sites/*.caddy under the edge folder. Host details live in the git-ignored deploy/deploy.env.
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
if [ -f "$repo_root/deploy/deploy.env" ]; then . "$repo_root/deploy/deploy.env"; fi
host=${PYAMIR_HOST:?set it in deploy/deploy.env, see deploy/deploy.env.example}
caddy=${PYAMIR_CADDY_CONTAINER:?set it in deploy/deploy.env, see deploy/deploy.env.example}
edge=${PYAMIR_EDGE_DIR:?set it in deploy/deploy.env, see deploy/deploy.env.example}
domain=pyamir.io

node "$repo_root/scripts/build-pages.mjs"
ssh "$host" "mkdir -p $edge/sites $edge/www/$domain"
rsync -az --delete "$repo_root/_site/" "$host:$edge/www/$domain/"
rsync -az "$repo_root/deploy/$domain.caddy" "$host:$edge/sites/$domain.caddy"
ssh "$host" "sudo docker exec $caddy caddy reload --config /etc/caddy/Caddyfile"
curl -fsS -o /dev/null --retry 5 --retry-delay 3 --retry-all-errors -w "https://$domain/liquid-glass-card/ answered %{http_code}\n" "https://$domain/liquid-glass-card/"
