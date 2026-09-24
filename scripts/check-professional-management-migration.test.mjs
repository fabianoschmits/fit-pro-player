import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202609240012_professional_management_rpc.sql'), 'utf8')

test('professional management migration exposes secure owner-scoped projections and mutations', () => {
  for (const fn of ['professional_client_summaries', 'professional_client_detail', 'publish_program_version', 'assign_program_version', 'student_program_overview']) assert.match(migration, new RegExp(`create or replace function public\\.${fn}`, 'i'))
  assert.match(migration, /security definer/i)
  assert.match(migration, /set search_path = public, pg_temp/i)
  assert.match(migration, /auth\.uid\(\)/i)
  assert.match(migration, /professional_student_relationships/i)
  assert.match(migration, /program_versions/i)
  assert.match(migration, /workout_executions/i)
  assert.match(migration, /revoke all on function/i)
  assert.match(migration, /grant execute on function/i)
  assert.match(migration, /for update/i)
  assert.doesNotMatch(migration, /drop table|truncate|delete from public\.(?:programs|program_versions|program_assignments|workout_executions)/i)
})
