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

test('personal invite codes are unique, personal, and backed by edit and repeated acceptance RPCs', () => {
  assert.match(migration, /is_personal boolean not null default false/i)
  assert.match(migration, /is_custom boolean not null default false/i)
  assert.match(migration, /save_professional_personal_invite/i)
  assert.match(migration, /ensure_professional_personal_invite/i)
  assert.match(migration, /pg_advisory_xact_lock/i)
  assert.match(migration, /if not invite\.is_personal then[\s\S]*?update public\.professional_invites set status = 'active'/i)
  assert.match(migration, /and not is_personal[\s\S]*?revoke/i)
})

test('professional model deletion is owner-scoped and keeps referenced history', () => {
  assert.match(migration, /create or replace function public\.delete_professional_program\(p_program_id uuid\)/i)
  assert.match(migration, /security definer\s+set search_path = public, pg_temp[\s\S]*?delete from public\.programs/i)
  assert.match(migration, /professional capability required[\s\S]*?program ownership required/i)
  assert.match(migration, /for update[\s\S]*?from public\.program_assignments where program_id=owned_program\.id/i)
  assert.match(migration, /raise exception 'program_in_use' using errcode='P0001'/i)
  assert.match(migration, /exception when foreign_key_violation[\s\S]*?raise exception 'program_in_use'/i)
  assert.match(migration, /grant execute on function public\.delete_professional_program\(uuid\) to authenticated/i)
})
