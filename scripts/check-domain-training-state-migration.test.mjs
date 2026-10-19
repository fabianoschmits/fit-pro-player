import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(root, 'supabase/migrations/202610190001_domain_training_state.sql')

test('training domain migration owns athlete records and concurrent workout writes', () => {
  assert.equal(fs.existsSync(migrationPath), true, 'domain training migration must exist')
  const migration = fs.readFileSync(migrationPath, 'utf8')

  for (const table of ['account_preferences', 'athlete_routines', 'athlete_schedules', 'bodyweight_entries', 'body_measurement_checkins', 'workout_sessions', 'workout_session_operations']) {
    assert.match(migration, new RegExp(`create table public\\.${table}`, 'i'))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }

  assert.match(migration, /mass_unit text not null default 'kg'/i)
  assert.match(migration, /check \(mass_unit = 'kg'\)/i)
  assert.match(migration, /display_unit text not null default 'kg'/i)
  assert.match(migration, /check \(display_unit in \('kg','lb'\)\)/i)
  assert.match(migration, /create unique index workout_sessions_one_active_user_idx[\s\S]+where status = 'active'/i)
  assert.match(migration, /unique \(session_id, operation_id\)/i)

  for (const fn of ['save_account_preferences', 'start_workout_session', 'append_workout_operation', 'take_over_workout_session', 'complete_workout_session']) {
    assert.match(migration, new RegExp(`create or replace function public\\.${fn}`, 'i'))
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}[^;]+from public, anon`, 'i'))
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}[^;]+to authenticated`, 'i'))
  }

  assert.match(migration, /p_expected_revision bigint/i)
  assert.match(migration, /p_writer_token uuid/i)
  assert.match(migration, /p_operation_id uuid/i)
  assert.match(migration, /auth\.uid\(\)/i)
  assert.match(migration, /set search_path = public, pg_temp/i)
  assert.match(migration, /for update/i)
  assert.match(migration, /stale workout writer/i)
  assert.match(migration, /workout revision conflict/i)
  assert.doesNotMatch(migration, /grant (insert|update|delete) on .* to authenticated/i)
})
