import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrations = readdirSync(join(root, 'supabase/migrations'))
const name = migrations.find(file => /professional_workspace_history_notes\.sql$/i.test(file))
assert.ok(name, 'professional workspace history/notes migration must be added')
const sql = readFileSync(join(root, 'supabase/migrations', name), 'utf8')

test('professional program page returns the latest published weekly plan without changing paging', () => {
  assert.match(sql, /create or replace function public\.professional_programs_page\s*\(/i)
  assert.match(sql, /weekly_plan/i)
  assert.match(sql, /not exists\s*\(\s*select 1 from public\.professional_plan_drafts/i)
  assert.match(sql, /jsonb_build_object\s*\(\s*'items'/i)
  assert.match(sql, /'total'/i)
  assert.match(sql, /'has_more'/i)
})

test('private note entries are append-only and inaccessible through direct table grants', () => {
  assert.match(sql, /create table if not exists public\.professional_student_note_entries/i)
  assert.match(sql, /created_at timestamptz not null/i)
  assert.match(sql, /body text not null/i)
  assert.match(sql, /char_length\(body\) between 1 and 2000/i)
  assert.match(sql, /foreign key\s*\(professional_id, student_id\)\s*references public\.professional_student_relationships/i)
  assert.match(sql, /revoke all on table public\.professional_student_note_entries from public, anon, authenticated/i)
  assert.doesNotMatch(sql, /grant\s+(?:select|insert|update|delete|all)\s+on\s+(?:table\s+)?public\.professional_student_note_entries\s+to\s+(?:anon|authenticated)/i)
})

test('note RPCs validate role and active relationship and use a fixed security-definer search path', () => {
  for (const fn of ['list_professional_student_notes', 'add_professional_student_note']) {
    const start = sql.search(new RegExp(`create or replace function public\\.${fn}\\s*\\(`, 'i'))
    assert.notEqual(start, -1, `missing RPC ${fn}`)
    const rest = sql.slice(start)
    assert.match(rest, /security definer set search_path\s*=\s*public,\s*pg_temp/i, `${fn} needs a fixed search path`)
    assert.match(rest, /role\s*=\s*'professional'/i, `${fn} must check professional role`)
    assert.match(rest, /status\s*=\s*'active'/i, `${fn} must check active relationship`)
  }
  assert.match(sql, /revoke all on function public\.list_professional_student_notes\(uuid\) from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.list_professional_student_notes\(uuid\) to authenticated/i)
  assert.match(sql, /revoke all on function public\.add_professional_student_note\(uuid,text\) from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.add_professional_student_note\(uuid,text\) to authenticated/i)
})

test('legacy note is copied with its original timestamp and cleared idempotently', () => {
  assert.match(sql, /insert into public\.professional_student_note_entries[\s\S]*?select\s+professional_id,\s*student_id,\s*body,\s*updated_at/i)
  assert.match(sql, /on conflict\s*\(professional_id,\s*student_id\)\s*where\s+legacy_note\s+do nothing/i)
  assert.match(sql, /update public\.professional_student_notes\s+set body\s*=\s*''/i)
})
