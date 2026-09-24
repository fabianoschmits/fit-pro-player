import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202609240013_revoke_professional_invite.sql'), 'utf8')

test('invite revocation is pending-only and owner-scoped', () => {
  assert.match(migration, /create or replace function public\.revoke_professional_invite/i)
  assert.match(migration, /security definer/i)
  assert.match(migration, /set search_path = public, pg_temp/i)
  assert.match(migration, /professional_user_id = auth\.uid\(\)/i)
  assert.match(migration, /status = 'pending'/i)
  assert.match(migration, /revoke all on function/i)
  assert.match(migration, /grant execute on function .*authenticated/i)
  assert.doesNotMatch(migration, /delete from/i)
})
