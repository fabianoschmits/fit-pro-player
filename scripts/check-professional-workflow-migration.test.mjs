import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const file = join(root, 'supabase/migrations/202609240008_professional_workflow.sql')
const sql = readFileSync(file, 'utf8')

test('professional workflow migration is additive and owner-scoped', () => {
  for (const table of ['professional_student_relationships', 'professional_invites', 'programs', 'program_versions', 'program_assignments', 'workout_executions']) assert.match(sql, new RegExp(`create table public\\.${table}`, 'i'))
  for (const fn of ['create_professional_invite', 'preview_professional_invite', 'accept_professional_invite', 'revoke_professional_relationship']) assert.match(sql, new RegExp(`create or replace function public\\.${fn}`, 'i'))
  assert.match(sql, /alter table public\.professional_student_relationships enable row level security/i)
  assert.match(sql, /professional_user_id = auth\.uid\(\)/i)
  assert.match(sql, /student_user_id = auth\.uid\(\)/i)
  assert.match(sql, /revoke all on function public\.accept_professional_invite\(text\) from public, anon/i)
  assert.doesNotMatch(sql, /drop table|truncate|delete from public\.(?:programs|program_versions|program_assignments|workout_executions)/i)
})
