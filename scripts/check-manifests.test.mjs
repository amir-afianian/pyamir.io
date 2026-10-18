import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("check-manifests.mjs", import.meta.url));
const repo = resolve(dirname(script), "..");
const repoFiles = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: repo, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

function checkCopy(t, mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "check-manifests-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const file of repoFiles) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    cpSync(join(repo, file), join(dir, file));
  }
  mutate(dir);
  return spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
}

function editJson(file, change) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  change(json);
  writeFileSync(file, JSON.stringify(json, null, 2));
}

test("the repo's own manifests pass", (t) => {
  const result = checkCopy(t);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Manifests OK: liquid-glass-card \d+\.\d+\.\d+/);
});

test("a plugin version that drifts from the release manifest fails", (t) => {
  const result = checkCopy(t, (dir) =>
    editJson(join(dir, "liquid-glass-card/.codex-plugin/plugin.json"), (p) => { p.version = "9.9.9"; }),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /liquid-glass-card versions differ/);
});

test("a Codex marketplace pointing at a different folder fails", (t) => {
  const result = checkCopy(t, (dir) =>
    editJson(join(dir, ".agents/plugins/marketplace.json"), (m) => { m.plugins[0].source.path = "./"; }),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\.agents\/plugins\/marketplace\.json liquid-glass-card source/);
});

test("a marketplace source that is not an existing folder fails", (t) => {
  const result = checkCopy(t, (dir) =>
    editJson(join(dir, ".claude-plugin/marketplace.json"), (m) => { m.plugins[0].source = "./missing"; }),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /source: "\.\/missing" is not an existing \.\/ folder/);
});

test("a plugin missing from the release-please config fails", (t) => {
  const result = checkCopy(t, (dir) =>
    editJson(join(dir, "release-please-config.json"), (c) => { delete c.packages["liquid-glass-card"]; }),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release-please-config\.json: no package "liquid-glass-card"/);
});

test("a skill whose frontmatter name differs from its folder fails", (t) => {
  const result = checkCopy(t, (dir) => {
    const skill = join(dir, "liquid-glass-card/skills/liquid-glass-card/SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replace(/^name: .*$/m, "name: other-name"));
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SKILL\.md frontmatter name: expected "liquid-glass-card"/);
});
