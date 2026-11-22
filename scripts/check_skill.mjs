#!/usr/bin/env node
// Consistency checks for the outsystems-bpt skill (Node.js 16+, no packages).
//   node scripts/check_skill.mjs
// Exit code: 0 = all checks pass, 1 = at least one error.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const errors = [];
const warnings = [];
const read = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(ROOT, full).split(sep).join("/"));
  }
  return out;
}
const files = walk(ROOT);

// 1. SKILL.md frontmatter
const skill = read("SKILL.md");
const fm = skill.match(/^---\n([\s\S]*?)\n---/);
if (!fm) errors.push("SKILL.md: missing YAML frontmatter");
else {
  const get = (k) => (fm[1].match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [])[1];
  const name = get("name"), desc = get("description");
  const version = (fm[1].match(/^\s+version:\s*(\S+)/m) || [])[1];
  if (!name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) errors.push(`SKILL.md: invalid name '${name}'`);
  if (!desc) errors.push("SKILL.md: missing description");
  else if (desc.length > 1024) errors.push(`SKILL.md: description is ${desc.length} chars (max 1024)`);
  if (!get("license")) warnings.push("SKILL.md: no license field");
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) errors.push(`SKILL.md: metadata.version '${version}' is not semver`);
  else if (!read("CHANGELOG.md").includes(`## ${version}`)) errors.push(`CHANGELOG.md: no entry for version ${version}`);
}
const skillLines = skill.split("\n").length;
if (skillLines > 500) errors.push(`SKILL.md: ${skillLines} lines (max 500)`);
else if (skillLines > 250) warnings.push(`SKILL.md: ${skillLines} lines (aim for < 250)`);

// 2. Referenced paths exist (paths owned by companion skills are written "(… there)" and skipped)
const pathRe = /`?((?:references|templates|scripts|adapters|evals)\/[A-Za-z0-9_./-]+\.(?:mdc|md|mjs|json))`?( there)?/g;
for (const f of files.filter((x) => x.endsWith(".md"))) {
  for (const m of read(f).matchAll(pathRe)) {
    if (m[2]) continue;
    if (!existsSync(join(ROOT, m[1]))) errors.push(`${f}: references missing file ${m[1]}`);
  }
}

// 3. Own rule IDs: defined once in the checklist (or lessons), every cited own ID defined
const checklist = read("references/review-checklist.md");
const defined = [...checklist.matchAll(/^\| ((?:PAR|PDS|PHA|PAA|PLT|PEX|PVR|POP|PSC|PNM)-\d+) \|/gm)].map((m) => m[1]);
const lessons = [...read("references/lessons-learned.md").matchAll(/\*\*(PLL-\d+)/g)].map((m) => m[1]);
const all = [...defined, ...lessons];
const dup = all.filter((id, i) => all.indexOf(id) !== i);
if (dup.length) errors.push(`duplicate rule IDs ${[...new Set(dup)].join(", ")}`);
const definedSet = new Set(all);
const idRe = /\b(PAR|PDS|PHA|PAA|PLT|PEX|PVR|POP|PSC|PNM|PLL)-(\d+)\b/g;
for (const f of files.filter((x) => /\.(md|mjs|json|mdc)$/.test(x) && !x.startsWith(".github/"))) {
  for (const m of read(f).matchAll(idRe)) {
    if (!definedSet.has(m[0])) errors.push(`${f}: cites undefined rule ${m[0]}`);
  }
}

// 4. Adapters: every core-rules block equals adapters/core-rules.md
const core = read("adapters/core-rules.md").trim();
for (const f of ["adapters/AGENTS.md", "adapters/copilot-instructions.md"]) {
  const m = read(f).match(/<!-- BEGIN core rules[^>]*-->\n([\s\S]*?)\n<!-- END core rules -->/);
  if (!m) errors.push(`${f}: missing BEGIN/END core rules markers`);
  else if (m[1].trim() !== core) errors.push(`${f}: core rules block differs from adapters/core-rules.md`);
}
if (!existsSync(join(ROOT, "adapters/cursor/outsystems-bpt.mdc"))) errors.push("adapters/cursor/outsystems-bpt.mdc missing");

// 4b. Community files expected for a public repository
for (const f of ["README.md", "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md"])
  if (!existsSync(join(ROOT, f))) errors.push(`${f} missing`);

// 4c. No client or private project names (keep the public repo neutral)
const banned = /\b(SSA|SFR|RBM|VIEW360|Nazaha|RCOC|UAEPASS|UAE PASS)\b|ssa\.gov/i;
for (const f of files.filter((x) => /\.(md|mjs|json|yml|mdc)$/.test(x) && x !== "scripts/check_skill.mjs")) {
  read(f).split("\n").forEach((line, i) => { if (banned.test(line)) errors.push(`${f}:${i + 1}: private project or client name`); });
}

// 5. Privacy / secret hygiene (generic patterns only)
const secretRes = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']?[A-Za-z0-9+/_-]{16,}/i, "credential-like assignment"],
  [/\b[A-Za-z0-9._%+-]+@(?!example\.(?:com|org)\b|noreply\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, "e-mail address"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/, "IP address"],
];
for (const f of files.filter((x) => /\.(md|mjs|json)$/.test(x) && x !== "scripts/check_skill.mjs")) {
  read(f).split("\n").forEach((line, i) => {
    for (const [re, what] of secretRes) if (re.test(line)) errors.push(`${f}:${i + 1}: possible ${what}`);
  });
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error:   ${e}`);
console.log(errors.length ? `FAILED: ${errors.length} error(s)` : `OK: ${files.length} files checked, ${defined.length} rules + ${lessons.length} lessons`);
process.exit(errors.length ? 1 : 0);
