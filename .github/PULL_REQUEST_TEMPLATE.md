## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## Checklist

- [ ] The PR title is a [Conventional Commit](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` …); it becomes the squash commit and drives the release notes.
- [ ] `node scripts/check-manifests.mjs` passes, and no `version` field was edited by hand.
- [ ] The plugin's tests pass (`npx playwright test` in its folder).
- [ ] Visual changes: before and after screenshots are attached, and `node scripts/render-media.mjs` was re-run if the README images changed.
