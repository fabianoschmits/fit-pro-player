import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(root, 'supabase/migrations/202609240007_account_lifecycle.sql')

test('account lifecycle migration is caller-scoped and authenticated-only', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8')
  assert.match(migration, /create or replace function public\.delete_my_account/i)
  assert.match(migration, /returns void/i)
  assert.match(migration, /security definer/i)
  assert.match(migration, /set search_path = public, auth, pg_temp/i)
  assert.match(migration, /auth\.uid\(\)/i)
  assert.match(migration, /caller uuid := auth\.uid\(\)/i)
  assert.match(migration, /delete from auth\.users where id = caller/i)
  assert.match(migration, /revoke all on function public\.delete_my_account\(\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.delete_my_account\(\) to authenticated/i)
})
