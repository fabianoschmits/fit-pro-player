import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '')
const executable = name => bin ? path.join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name
const available = spawnSync(executable('initdb'), ['--version'], { windowsHide: true }).status === 0
  && (process.platform !== 'win32' || fs.existsSync(path.resolve(bin, '../share/postgres.bki')))
const freePort = () => new Promise(resolve => {
  const server = net.createServer()
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)) })
})

test('professional photos enforce owner storage writes and expose photos only through scoped reads', {
  skip: !available && process.env.PHOTOS_REQUIRE_DB !== '1' && 'Set PG_BIN to a complete disposable PostgreSQL runtime; no remote database is used',
}, async () => {
  assert.ok(available, 'A complete local PostgreSQL runtime is required (PG_BIN)')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpp-professional-photos-'))
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
    // First application above proves compatibility with the existing minimal auth/public harness.
    // Storage service is absent locally: reproduce its table boundary and execute real PostgreSQL RLS.
    sql(`create schema storage;
      create table storage.buckets(id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, metadata jsonb, unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      grant select on storage.objects to anon;`)
    const photoMigration = path.join(root, 'supabase/migrations/202610100018_professional_photos.sql')
    if (fs.existsSync(photoMigration)) sql(fs.readFileSync(photoMigration, 'utf8'))
    sql(fs.readFileSync(path.join(root, 'supabase/tests/202610100018_professional_photos.sql'), 'utf8'))
    for (const file of ['202610050015_student_professional_management.sql', '202610090016_professional_program_metadata.sql', '202610090017_professional_workspace_reads.sql', '202610100018_professional_invite_flow.sql']) {
      sql(fs.readFileSync(path.join(root, 'supabase/tests', file), 'utf8'))
    }
  } finally {
    run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
  }
})
