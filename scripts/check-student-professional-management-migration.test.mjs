import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(root, 'supabase/migrations/202610050015_student_professional_management.sql')
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''

test('student professional RPC migration confines definer reads to authenticated active links', () => {
  for (const [name, signature] of [['student_professional_summaries', ''], ['student_professional_detail', 'uuid']]) {
    const body = migration.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, 'i'))?.[0]
    assert.ok(body, `${name} must exist`)
    assert.match(body, /security definer\s+set search_path\s*=\s*public,\s*pg_temp/i)
    assert.match(body, /if auth\.uid\(\) is null then[\s\S]*?errcode\s*=\s*'42501'/i)
    assert.match(body, /r\.student_user_id\s*=\s*auth\.uid\(\)/i)
    assert.match(body, /r\.status\s*=\s*'active'/i)
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\(${signature}\\) from public,\\s*anon,\\s*authenticated`, 'i'))
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\(${signature}\\) to authenticated`, 'i'))
  }
  assert.doesNotMatch(migration, /p_student_user_id|create policy|alter policy|grant (?:select|all) on (?:table )?public\.professional_profiles/i)
  assert.doesNotMatch(migration, /grant execute[^;]*to (?:public|anon)|insert into|update public|delete from|drop table/i)
})

test('detail scopes assigned published material and executions to the selected professional and caller', () => {
  const detail = migration.slice(migration.indexOf('create or replace function public.student_professional_detail'))
  assert.match(detail, /r\.professional_user_id\s*=\s*p_professional_user_id/i)
  assert.match(detail, /a\.professional_user_id\s*=\s*r\.professional_user_id/i)
  assert.match(detail, /a\.student_user_id\s*=\s*r\.student_user_id/i)
  assert.match(detail, /v\.published_at is not null/i)
  assert.match(detail, /e\.student_user_id\s*=\s*r\.student_user_id/i)
  assert.match(detail, /join public\.program_assignments a on a\.id\s*=\s*e\.assignment_id/i)
  assert.match(detail, /'weekly_plan',\s*v\.weekly_plan/i)
  assert.match(detail, /'status',\s*a\.status/i)
})

// Like the readiness suite, this creates its own cluster and never connects to an existing service.
const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '')
const executable = name => bin ? path.join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name
const available = spawnSync(executable('initdb'), ['--version'], { windowsHide: true }).status === 0
  && (process.platform !== 'win32' || fs.existsSync(path.resolve(bin, '../share/postgres.bki')))
const freePort = () => new Promise(resolve => {
  const server = net.createServer()
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)) })
})

test('disposable database proves student professional identity, material and execution isolation', {
  skip: !available && process.env.STUDENT_MANAGEMENT_REQUIRE_DB !== '1' && 'Set PG_BIN to complete disposable PostgreSQL binaries; SQL assertions did not run; no remote database is used',
}, async () => {
  assert.ok(available, 'A complete local PostgreSQL runtime is required (PG_BIN)')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpp-student-management-'))
  const data = path.join(directory, 'cluster')
  const serverLog = path.join(directory, 'server.log')
  const port = await freePort()
  const run = (name, args, input) => {
    const result = spawnSync(executable(name), args, { input, encoding: 'utf8', windowsHide: true, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe', maxBuffer: 8 * 1024 * 1024 })
    const detail = name === 'pg_ctl' && result.status !== 0 && fs.existsSync(serverLog) ? '\n' + fs.readFileSync(serverLog, 'utf8') : ''
    assert.equal(result.status, 0, `${name}: ${result.stderr || result.stdout || result.error || `exit ${result.status}`}${detail}`)
    return result.stdout
  }
  run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'])
  fs.appendFileSync(path.join(data, 'postgresql.conf'), "\nunix_socket_directories = ''\n")
  run('pg_ctl', ['-D', data, '-l', serverLog, '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'])
  const sql = input => run('psql', ['-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input)
  try {
    sql(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
    for (const file of fs.readdirSync(path.join(root, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort()) {
      sql(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'))
    }
    sql(fs.readFileSync(path.join(root, 'supabase/tests/202610050015_student_professional_management.sql'), 'utf8'))
  } finally {
    run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
    // Retain only this isolated cluster/log for debugging; never touch existing databases.
  }
})
