import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202609210004_account_snapshots.sql'), 'utf8')

test('account snapshot migration uses an additive owner-scoped CAS contract', () => {
  assert.match(migration, /create table public\.account_snapshots/i)
  assert.match(migration, /references auth\.users \(id\) on delete cascade/i)
  assert.match(migration, /jsonb_typeof\(payload\) = 'object'/i)
  assert.match(migration, /create or replace function public\.save_own_account_snapshot/i)
  assert.match(migration, /caller uuid := auth\.uid\(\)/i)
  assert.match(migration, /for update/i)
  assert.match(migration, /'CONFLICT'/i)
  assert.match(migration, /'APPLIED'/i)
  assert.match(migration, /revoke all on function public\.save_own_account_snapshot[^;]+from public, anon/i)
  assert.doesNotMatch(migration, /drop table|truncate|delete from public\.account_snapshots/i)
})
