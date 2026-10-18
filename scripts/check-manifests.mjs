#!/usr/bin/env node
// Keeps every plugin's Claude and Codex manifests, its skills and its release
// config in lockstep. Codex caches plugins by version and Claude Code
// compares versions to offer updates, so any drift silently strands users.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_DESCRIPTION_LENGTH = 1024;
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

process.chdir(resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..")));
const errors = [];
const fail = (message) => errors.push(message);
const isDirectory = (path) => statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;

function readJson(path) {
  if (!existsSync(path)) {
    fail(`${path}: file not found`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${path}: invalid JSON (${error.message})`);
    return null;
  }
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!field) continue;
    const quoted = field[2].match(/^(["'])([\s\S]*)\1\s*$/);
    fields[field[1]] = quoted ? quoted[2] : field[2].trim();
  }
  return fields;
}

function checkSkill(skillFile, folderName) {
  const frontmatter = parseFrontmatter(readFileSync(skillFile, "utf8"));
  if (!frontmatter) {
    fail(`${skillFile}: missing YAML frontmatter`);
    return;
  }
  expectEqual(`${skillFile} frontmatter name`, frontmatter.name, folderName);
  if (!frontmatter.description) {
    fail(`${skillFile}: frontmatter description is missing or empty`);
  } else if (frontmatter.description.length > MAX_DESCRIPTION_LENGTH) {
    fail(
      `${skillFile}: description is ${frontmatter.description.length} chars, ` +
        `limit is ${MAX_DESCRIPTION_LENGTH}`,
    );
  }
}

function checkReleaseConfig(project, manifestFiles) {
  const releasePackage = releaseConfig?.packages?.[project];
  if (!releasePackage) {
    fail(`release-please-config.json: no package "${project}"`);
    return;
  }
  const bumped = new Set((releasePackage["extra-files"] ?? []).map((file) => file.path));
  for (const file of manifestFiles) {
    if (!bumped.has(file)) fail(`release-please-config.json "${project}" extra-files: ${file} is never bumped`);
  }
}

function checkPlugin(name, source, codexSource) {
  if (typeof source !== "string" || !source.startsWith("./") || !isDirectory(source)) {
    fail(`.claude-plugin/marketplace.json ${name} source: ${JSON.stringify(source)} is not an existing ./ folder`);
    return;
  }
  expectEqual(`.agents/plugins/marketplace.json ${name} source`, codexSource, source);

  // The marketplace source is what installs; the release package is the top-level folder around it.
  const dir = source.slice(2);
  const project = dir.split("/")[0];
  if (existsSync(join(dir, "package.json"))) {
    fail(`${dir}/package.json: Claude Code runs npm install for a plugin folder with a package.json; keep dev tooling outside ${dir}`);
  }
  const [claudeFile, codexFile] = [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"].map((file) => `${dir}/${file}`);
  const claudePlugin = readJson(claudeFile);
  const codexPlugin = readJson(codexFile);
  checkReleaseConfig(project, [claudeFile, codexFile].map((file) => relative(project, file)));

  for (const [file, plugin] of [[claudeFile, claudePlugin], [codexFile, codexPlugin]]) {
    if (!plugin) continue;
    expectEqual(`${file} name`, plugin.name, name);
    if (typeof plugin.version !== "string" || !SEMVER.test(plugin.version)) {
      fail(`${file} version: ${JSON.stringify(plugin.version)} is not valid semver`);
    }
  }

  const versions = [
    [claudeFile, claudePlugin?.version],
    [codexFile, codexPlugin?.version],
    [`.release-please-manifest.json "${project}"`, releaseManifest?.[project]],
  ];
  if (new Set(versions.map(([, v]) => v)).size !== 1) {
    fail(`${name} versions differ: ${versions.map(([file, v]) => `${file} is ${v}`).join(", ")}`);
  }

  if (!codexPlugin) return;
  const skillsDir = join(dir, String(codexPlugin.skills));
  if (typeof codexPlugin.skills !== "string" || !isDirectory(skillsDir)) {
    fail(`${codexFile} skills: ${JSON.stringify(codexPlugin.skills)} is not an existing directory`);
    return;
  }
  const skills = readdirSync(skillsDir).filter((folder) => existsSync(join(skillsDir, folder, "SKILL.md")));
  if (skills.length === 0) fail(`${skillsDir}: no skill folders with a SKILL.md`);
  for (const folder of skills) checkSkill(join(skillsDir, folder, "SKILL.md"), folder);
  return claudePlugin?.version;
}

const claudeMarketplace = readJson(".claude-plugin/marketplace.json");
const codexMarketplace = readJson(".agents/plugins/marketplace.json");
const releaseManifest = readJson(".release-please-manifest.json");
const releaseConfig = readJson("release-please-config.json");

const claudeEntries = claudeMarketplace?.plugins ?? [];
const codexSources = new Map((codexMarketplace?.plugins ?? []).map((p) => [p.name, p.source?.path]));
if (claudeMarketplace && codexMarketplace) {
  expectEqual(".agents/plugins/marketplace.json name", codexMarketplace.name, claudeMarketplace.name);
  for (const name of codexSources.keys()) {
    if (!claudeEntries.some((entry) => entry.name === name)) {
      fail(`.agents/plugins/marketplace.json: ${name} is missing from .claude-plugin/marketplace.json`);
    }
  }
}
if (claudeMarketplace && claudeEntries.length === 0) fail(".claude-plugin/marketplace.json: no plugins");

const checked = claudeEntries.map(({ name, source }) => [
  name,
  checkPlugin(name, source, codexSources.get(name)),
]);

if (errors.length > 0) {
  console.error(`Manifest check failed (${errors.length}):`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(`Manifests OK: ${checked.map(([name, version]) => `${name} ${version}`).join(", ")}`);
