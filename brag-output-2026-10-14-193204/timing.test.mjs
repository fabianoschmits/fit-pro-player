import test from 'node:test';
import assert from 'node:assert/strict';
let helpers = {};
try { helpers = await import('./timing.mjs'); } catch {}

test('speech slots fill the scene without overlaps or long silent tails', () => {
  const slots = helpers.schedule?.([{id:'a',duration:2},{id:'b',duration:3}], 10, 20) ?? [];
  assert.equal(slots.length, 2, 'the two spoken phrases must be scheduled');
  assert.equal(slots[0].start, 10.12);
  assert.ok(Math.abs(slots[1].start - slots[0].end - 0.09) < 0.001);
  assert.ok(Math.abs(slots[1].end - 19.88) < 0.001);
  assert.ok(slots.every(s => s.duration > 0 && s.rate > 0));
});
test('invalid speech and reversed windows are rejected', () => {
  assert.throws(() => helpers.schedule?.([{id:'bad',duration:0}], 0, 5), /positive/);
  assert.throws(() => helpers.schedule?.([{id:'a',duration:2}], 5, 4), /window/);
});
test('SRT carries actual cue boundaries and Brazilian text, not guessed words', () => {
  const srt = helpers.toSrt?.([{start:0.12,end:2.345,text:'Cargas e repetições.'},{start:2.435,end:4.2,text:'Veja a próxima série.'}]) ?? '';
  assert.equal(srt, '1\n00:00:00,120 --> 00:00:02,345\nCargas e repetições.\n\n2\n00:00:02,435 --> 00:00:04,200\nVeja a próxima série.\n');
});
test('caption line breaking preserves words and uses at most two lines', () => {
  const text='Organize os exercícios e prepare a semana.';
  const lines=helpers.wrapCaption?.(text, 24) ?? [];
  assert.equal(lines.join(' '),text);
  assert.equal(lines.length,2);
  assert.ok(lines.every(l=>l.length<=24));
});
