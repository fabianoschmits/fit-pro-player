import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const j=JSON.parse(await readFile(new URL('qc/check.json',import.meta.url),'utf8'));
assert.equal(j.browserSkipped,false,'The real browser must run');
assert.equal(j.runtime.findings.filter(f=>/GSAP target/.test(f.message)).length,0,'No tween may target an empty collection');
assert.equal(j.layout.findings.filter(f=>f.code==='container_overflow'&&f.selector.startsWith('#measure-compare')).length,0,'The complete comparison panel must fit');
assert.equal(j.ok,true);
console.log('PASS: real-browser regression checks for animation targets and the complete comparison panel.');
