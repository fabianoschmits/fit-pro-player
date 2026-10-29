import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const migrationPath = new URL('../supabase/migrations/202610290003_professional_profile_invites_and_model_delete.sql', import.meta.url)
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''

test('professional profile editing is an authenticated fixed-search-path RPC', () => {
  assert.match(migration, /create or replace function public\.save_professional_profile\s*\(/i)
  assert.match(migration, /security definer\s+set search_path = public, pg_temp[\s\S]*?update public\.professional_profiles/i)
  assert.match(migration, /revoke insert, update on table public\.professional_profiles from authenticated/i)
  assert.match(migration, /grant select on table public\.professional_profiles to authenticated/i)
  assert.match(migration, /p_user_id is distinct from caller/i)
  assert.match(migration, /professional capability required/i)
})
