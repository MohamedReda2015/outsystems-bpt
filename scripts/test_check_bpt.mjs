#!/usr/bin/env node
// Regression test for check-bpt.mjs (Node.js 16+). Run: node scripts/test_check_bpt.mjs
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const run = (f) => {
  try {
    return { code: 0, out: JSON.parse(execFileSync(process.execPath, [join(dir, "check-bpt.mjs"), join(dir, f), "--json"], { encoding: "utf8" })) };
  } catch (e) {
    return { code: e.status, out: JSON.parse(e.stdout) };
  }
};

let failed = 0;
const expect = (cond, msg) => { if (!cond) { failed++; console.log(`FAIL ${msg}`); } else console.log(`ok   ${msg}`); };

const good = run("example_inventory.json");
expect(good.code === 0, "good inventory exits 0");
expect(good.out.findings.length === 0, `good inventory has no findings (got ${good.out.findings.length})`);

const bad = run("example_inventory_bad.json");
expect(bad.code === 1, "bad inventory exits 1");
const rules = new Set(bad.out.findings.map((f) => f.rule));
for (const r of ["PAR-01", "PAR-02", "PAR-04", "PAR-09", "PHA-10", "PAA-06", "PLT-01", "PDS-01", "PDS-02", "PDS-03", "PDS-04", "PDS-05", "PHA-02", "PHA-08", "PAA-02", "PAA-05", "PNM-01", "PNM-02", "PNM-03", "PNM-05"])
  expect(rules.has(r), `bad inventory triggers ${r}`);

console.log(failed ? `FAILED: ${failed}` : "OK");
process.exit(failed ? 1 : 0);
