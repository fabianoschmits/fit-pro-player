import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Structural deployment guard only; behavioral authorization is exercised by SQL fixtures.
const sql = readFileSync(new URL('../supabase/migrations/202610090016_professional_program_metadata.sql', import.meta.url), 'utf8')
const contracts = [
  ['update_program_metadata', 'uuid,text,text,text'],
  ['publish_program_version_with_titles', 'uuid,jsonb,jsonb'],
  ['duplicate_professional_program', 'uuid,uuid,text'],
  ['professional_student_note', 'uuid'],
  ['save_professional_student_note', 'uuid,text'],
]

test('native metadata migration exposes explicit authenticated RPCs with fixed search paths', () => {
  for (const [name, signature] of contracts) {
    const declaration = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$`, 'i')
    const body = sql.match(declaration)?.[0]
    assert.ok(body, `${name} exists`)
    assert.match(body, /security definer\s+set search_path\s*=\s*public,\s*pg_temp/i)
    const escapedSignature = signature.replaceAll(',', ',\\s*')
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\(${escapedSignature}\\) from public,\\s*anon,\\s*authenticated`, 'i'))
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(${escapedSignature}\\) to authenticated`, 'i'))
  }
})

test('native metadata schema keeps private notes behind RPCs and historical prescriptions intact', () => {
  assert.match(sql, /alter table public\.programs add column objective text/i)
  assert.match(sql, /alter table public\.program_versions add column workout_titles jsonb/i)
  assert.match(sql, /primary key \(professional_id, student_id\)/i)
  assert.match(sql, /alter table public\.professional_student_notes enable row level security/i)
  assert.match(sql, /revoke all on table public\.professional_student_notes from public, anon, authenticated/i)
  assert.doesNotMatch(sql, /grant\s+(?:all|select|insert|update|delete).*professional_student_notes/i)
  assert.doesNotMatch(sql, /drop table|truncate|delete from public\.(?:programs|program_versions|workout_executions)|update public\.workout_executions/i)
  assert.match(sql, /public\.publish_program_version\(p_program_id, p_weekly_plan\)/)
})
