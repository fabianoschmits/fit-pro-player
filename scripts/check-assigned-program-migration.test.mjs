import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/202609240011_assigned_program_read_acl.sql'), 'utf8')
test('assigned program read ACL is limited to active student assignments', () => {
  assert.match(sql, /create policy programs_assigned_student_read/i)
  assert.match(sql, /create policy versions_assigned_student_read/i)
  assert.match(sql, /student_user_id = auth\.uid\(\)/i)
  assert.match(sql, /status = 'active'/i)
})
