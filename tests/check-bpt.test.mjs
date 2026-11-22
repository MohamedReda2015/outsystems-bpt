import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
function check(pending, closesInOnReady=false) {
  const data=JSON.parse(readFileSync(join(root,'scripts/example_inventory.json'),'utf8'));
  const human=data.processes.flatMap(p=>p.activities).find(a=>a.type==='human');
  assert.ok(human);
  human.closedBy='entityEvent';
  human.pendingProgressHandled=pending;
  human.closesInOnReady=closesInOnReady;
  const dir=mkdtempSync(join(tmpdir(),'os-bpt-test-'));
  try {
    const file=join(dir,'inventory.json'); writeFileSync(file,JSON.stringify(data));
    const result=spawnSync(process.execPath,[join(root,'scripts/check-bpt.mjs'),file,'--json'],{encoding:'utf8'});
    assert.ok(result.status===0||result.status===1,result.stderr);
    return JSON.parse(result.stdout).findings.filter(f=>f.rule==='PHA-10');
  } finally {
    const target=resolve(dir);
    assert.equal(dirname(target),resolve(tmpdir()));
    assert.ok(basename(target).startsWith('os-bpt-test-'));
    rmSync(target,{recursive:true,force:true});
  }
}
test('event closure without a pending UI is flagged',()=>assert.ok(check(false).length));
test('documented pending progression permits event closure',()=>assert.equal(check(true).length,0));
test('closing in own On Ready remains invalid',()=>assert.ok(check(true,true).length));
