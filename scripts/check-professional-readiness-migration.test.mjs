import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync, spawn } from 'node:child_process'
import net from 'node:net'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '')
const executable = name => bin ? path.join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name
const available = spawnSync(executable('initdb'), ['--version'], { windowsHide: true }).status === 0
  && (process.platform !== 'win32' || fs.existsSync(path.resolve(bin, '../share/postgres.bki')))
const freePort = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)) }) })

test('authenticated professional database boundaries and concurrent mutation retries', { skip: !available && process.env.READINESS_REQUIRE_DB !== '1' && 'Set PG_BIN to complete disposable PostgreSQL binaries; no remote database is used' }, async () => {
  assert.ok(available, 'A complete local PostgreSQL runtime is required (PG_BIN)')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpp-readiness-'))
  const data = path.join(dir, 'cluster')
  const serverLog = path.join(dir, 'server.log')
  const port = await freePort()
  const run = (name, args, input) => {
    const result = spawnSync(executable(name), args, { input, encoding: 'utf8', windowsHide: true, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe', maxBuffer: 8 * 1024 * 1024 })
    const serverDetail = name === 'pg_ctl' && result.status !== 0 && fs.existsSync(serverLog)
      ? '\n' + fs.readFileSync(serverLog, 'utf8') : ''
    assert.equal(result.status, 0, `${name}: ${result.stderr || result.stdout || result.error || `exit ${result.status}`}${serverDetail}`)
    return result.stdout
  }
  run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'])
  // All clients use TCP; avoid the system socket directory owned by postgres on Linux.
  fs.appendFileSync(path.join(data, 'postgresql.conf'), "\nunix_socket_directories = ''\n")
  run('pg_ctl', ['-D', data, '-l', serverLog, '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'])
  const args = ['-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
  const sql = input => run('psql', args, input)
  const asyncSql = input => new Promise((resolve, reject) => {
    const child = spawn(executable('psql'), args, { windowsHide: true })
    let out = '', err = ''
    child.stdout.on('data', chunk => { out += chunk })
    child.stderr.on('data', chunk => { err += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(err)))
    child.stdin.end(input)
  })
  try {
    // Minimal auth boundary for isolated PostgreSQL; app tables, RLS and RPCs are real migrations.
    sql(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
    for (const file of fs.readdirSync(path.join(root, 'supabase/migrations')).sort()) {
      if (process.env.READINESS_BASELINE === '1' && file.startsWith('202610020014')) continue
      sql(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'))
    }
    sql(fs.readFileSync(path.join(root, 'supabase/tests/202610020014_professional_readiness.sql'), 'utf8'))
    sql(`insert into auth.users(id) values ('00000000-0000-0000-0000-000000000009');`)
    const firstSave = `begin; set local role authenticated; set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000009'; select status from public.save_own_account_snapshot(0,1,'{}'); select pg_sleep(0.2); commit;`
    const writes = await Promise.all([asyncSql(firstSave), asyncSql(firstSave)])
    assert.equal(writes.filter(value => value.includes('APPLIED')).length, 1)
    assert.equal(writes.filter(value => value.includes('CONFLICT')).length, 1)
    assert.equal(sql(`select revision from public.account_snapshots where user_id='00000000-0000-0000-0000-000000000009';`).trim(), '1')
    sql(`insert into auth.users(id) values ('00000000-0000-0000-0000-000000000005'),('00000000-0000-0000-0000-000000000006'),('00000000-0000-0000-0000-000000000007');
      insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-000000000005','professional'),('00000000-0000-0000-0000-000000000006','professional');
      insert into public.professional_student_relationships(id,professional_user_id,student_user_id) values
      ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000007'),
      ('10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007');
      insert into public.programs(id,professional_user_id,title) values ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000005','Five'),('20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000006','Six');`)
    const asUser = (user, command) => `begin; set local role authenticated; set local request.jwt.claim.sub='${user}'; ${command}; select pg_sleep(0.1); commit;`
    const publish = `select public.publish_program_version('20000000-0000-0000-0000-000000000005','{"monday":[{"exerciseId":"x","sets":3,"reps":10}]}')`
    await Promise.all([asyncSql(asUser('00000000-0000-0000-0000-000000000005', publish)), asyncSql(asUser('00000000-0000-0000-0000-000000000005', publish))])
    assert.equal(sql(`select string_agg(version_number::text,',' order by version_number) from public.program_versions where program_id='20000000-0000-0000-0000-000000000005';`).trim(), '1,2')
    sql(asUser('00000000-0000-0000-0000-000000000006', `select public.publish_program_version('20000000-0000-0000-0000-000000000006','{"monday":[{"exerciseId":"x","sets":3,"reps":10}]}')`))
    const assign = digit => asUser(`00000000-0000-0000-0000-00000000000${digit}`, `select public.assign_program_version('20000000-0000-0000-0000-00000000000${digit}',(select id from public.program_versions where program_id='20000000-0000-0000-0000-00000000000${digit}' and version_number=1),'00000000-0000-0000-0000-000000000007')`)
    await Promise.all([asyncSql(assign(5)), asyncSql(assign(6))])
    assert.equal(sql(`select count(*) from public.program_assignments where student_user_id='00000000-0000-0000-0000-000000000007' and status='active';`).trim(), '1')
    const start = asUser('00000000-0000-0000-0000-000000000007', `select public.start_workout_execution('40000000-0000-0000-0000-000000000007',(select id from public.program_assignments where status='active'),'monday')`)
    await Promise.all([asyncSql(start), asyncSql(start)])
    assert.equal(sql(`select count(*) from public.workout_executions;`).trim(), '1')
    const terminals = await Promise.allSettled([
      asyncSql(asUser('00000000-0000-0000-0000-000000000007', `select public.complete_workout_execution('40000000-0000-0000-0000-000000000007')`)),
      asyncSql(asUser('00000000-0000-0000-0000-000000000007', `select public.abandon_workout_execution('40000000-0000-0000-0000-000000000007')`)),
    ])
    assert.equal(terminals.filter(value => value.status === 'fulfilled').length, 1)
    const rejected = terminals.find(value => value.status === 'rejected')
    assert.match(rejected.reason.message, /execution already finalized/)
    const revoke = asUser('00000000-0000-0000-0000-000000000007', `select public.revoke_professional_relationship('10000000-0000-0000-0000-000000000005')`)
    const revocationRace = await Promise.allSettled([asyncSql(assign(5)), asyncSql(revoke)])
    const failedAssignment = revocationRace[0]
    if (failedAssignment.status === 'rejected') assert.match(failedAssignment.reason.message, /active student relationship required/)
    assert.equal(revocationRace[1].status, 'fulfilled')
    assert.equal(sql(`select count(*) from public.program_assignments where professional_user_id='00000000-0000-0000-0000-000000000005' and status='active';`).trim(), '0')
  } finally {
    run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
    // Retain only this isolated test cluster/log for debugging; never touch existing databases.
  }
})
