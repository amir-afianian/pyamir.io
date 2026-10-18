# Contributing

Thanks for helping out. The short version: write Conventional Commits, keep the tests and the manifest check green, and let the release PR do the versioning.

Each entry in `.claude-plugin/marketplace.json` is one plugin, living in the top-level folder its `source` names. The Codex marketplace lists the same folders, and each plugin is versioned and released on its own.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). Release automation reads them to pick the next version and write the changelog.

| Prefix | Use for | Version bump |
| --- | --- | --- |
| `feat:` | A new capability | minor |
| `fix:` | A bug fix | patch |
| `perf:` | A performance improvement | patch |
| `docs:` | Documentation only | none (listed in the changelog) |
| `chore:`, `ci:`, `test:`, `refactor:` | Maintenance | none (hidden from the changelog) |

A breaking change gets a `!` after the type (`feat!: ...`) or a `BREAKING CHANGE:` footer. In `liquid-glass-card`, renaming or removing an `LG_CONFIG` key is a breaking change, because people have that config in their own pages.

A commit counts toward a plugin's release when it touches files inside that plugin's folder. Commits that only touch root files (workflows, root scripts) land in no changelog.

Squash-merged PRs use the PR title as the commit message, so write the PR title as a Conventional Commit too.

## Checks

From the repo root:

```sh
node scripts/check-manifests.mjs     # manifest and version consistency, every plugin
node --test scripts/*.test.mjs       # tests for that check
```

From a plugin folder, for example `liquid-glass-card/`:

```sh
npm ci
npx playwright install chromium   # first time only
npx playwright test               # the test suite
```

`check-manifests` walks every plugin in `.claude-plugin/marketplace.json`. For each one it verifies that the Codex marketplace points at the same folder, the Claude and Codex plugin versions match each other and that plugin's entry in `.release-please-manifest.json`, `release-please-config.json` bumps both plugin manifests, and every skill's frontmatter is valid with a `name` equal to its folder. CI runs it together with Claude's own `plugin validate`.

Never edit the `version` fields by hand. Codex caches installed plugins by version and Claude Code compares versions to offer updates, so a drifted or unbumped version means users never receive fixes. The release PR bumps both manifests together.

## README images

The images under `media/` are rendered from the real template through the playground's own export path, so they never drift from what the skill produces. After changing the template or a preset, re-render them from the plugin folder (needs libwebp: `brew install webp`):

```sh
npm run render:media                  # everything
npm run render:media -- hero gallery  # or only some
```

## Deploying pyamir.io

`sh scripts/deploy-pages.sh` builds the site (the root page plus each plugin's demo) and publishes it to https://pyamir.io. The server's Caddy imports `deploy/pyamir.io.caddy` from a folder outside any other app's release, so a deploy only uploads files and reloads Caddy, with no downtime. The host, Caddy container and that folder come from `deploy/deploy.env`, which is git-ignored; copy `deploy/deploy.env.example` to create it.

## Releases

1. Merge Conventional Commits into `main`.
2. release-please opens (and keeps updating) one release PR covering every plugin with releasable changes. For each, it bumps `<plugin>/.claude-plugin/plugin.json`, `<plugin>/.codex-plugin/plugin.json` and the plugin's entry in `.release-please-manifest.json`, and writes `<plugin>/CHANGELOG.md`.
3. Merging the release PR cuts a tag named `<plugin>-vX.Y.Z` and its GitHub Release. For `liquid-glass-card`, a follow-up job builds `liquid-glass-card/dist/liquid-glass-card.zip` (the skill folder at the archive root, ready for claude.ai's skill upload) and attaches it to that release.

The default token cannot trigger CI on the release PR. Add a `RELEASE_PLEASE_TOKEN` repository secret (a PAT or app token with contents and pull-requests write) if you want checks to run on it. The repository setting "Allow GitHub Actions to create and approve pull requests" must be on.

Build the zip locally with `sh liquid-glass-card/scripts/build-skill-zip.sh`.

### The 1.0.0 launch

Development sits at `0.1.0` and the public launch must be exactly `1.0.0`. Cut it with an empty commit on `main` carrying a `Release-As` footer, then merge the release PR it produces:

```sh
git commit --allow-empty -m "chore: release 1.0.0" -m "Release-As: 1.0.0"
```

release-please applies an empty commit to every plugin in the repo. That is fine while `liquid-glass-card` is the only one; once there are others, put the footer on a commit that touches only the launching plugin's folder.

Do not put `release-as` in `release-please-config.json`; it would stick and pin every later release to 1.0.0.

## Trying it locally

Install the checkout as a plugin to dogfood your changes.

Claude Code:

```
/plugin marketplace add /path/to/pyamir.io
/plugin install liquid-glass-card@pyamir
```

Codex:

```sh
codex plugin marketplace add /path/to/pyamir.io
```

## Adding a plugin

1. Create a top-level folder named after the plugin, with `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and `skills/<skill-name>/SKILL.md`.
2. List it in `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json` with `"./<plugin>"` as its source.
3. Add it to `release-please-config.json` (copy the `liquid-glass-card` block and change the paths) and give it `"0.1.0"` in `.release-please-manifest.json`.
4. Run `node scripts/check-manifests.mjs`; it fails until all of the above agree.
5. If it has tests, a demo site or a release zip, add a test job to `.github/workflows/ci.yml`, build its site in `scripts/build-pages.mjs` (it is then served at `pyamir.io/<plugin>/`), and add its zip to `.github/workflows/release-please.yml`.
