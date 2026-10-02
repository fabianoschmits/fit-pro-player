import { test } from 'node:test'
import assert from 'node:assert/strict'
import { databaseTestInput, databaseTestPassed } from './database-test-tap.mjs'
test('self-contained pgTAP suites retain their one plan and transaction',()=>{
  const source='begin; select plan(1); select ok(true); select * from finish(); rollback;'
  const input=databaseTestInput(source)
  assert.equal((input.match(/\bplan\(/g)||[]).length,1)
  assert.ok(!input.includes('no_plan()'))
  assert.equal((input.match(/\bbegin;/g)||[]).length,1)
})
test('unplanned assertions receive an isolated no_plan transaction',()=>{
  assert.match(databaseTestInput('select ok(true);'),/begin;.*select no_plan\(\);/s)
  assert.match(databaseTestInput("select policy_cmd_is('public', 'programs', 'owner_read', 'SELECT', 'owner can read');"),/begin;.*select no_plan\(\);/s)
  assert.match(databaseTestInput('select ok(true);'),/finish\(\); rollback;/)
  assert.equal(databaseTestInput('do $$ begin null; end $$;'),'do $$ begin null; end $$;')
})
test('failed assertions and mismatched plans fail despite psql exit zero',()=>{
  for(const stdout of ['not ok 1 - assertion','# Looks like you planned 3 tests but ran 2','# No tests run!','Bail out! error']) assert.equal(databaseTestPassed({status:0,stdout}),false)
  assert.equal(databaseTestPassed({status:0,stdout:'1..1\nok 1 - works'}),true)
})
