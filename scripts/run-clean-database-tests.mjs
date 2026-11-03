import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { databaseTestInput, databaseTestPassed } from './database-test-tap.mjs'
import { testPlanRelationshipConcurrency } from './plan-relationship-concurrency.mjs'
import { seedRelationshipUpgrade, verifyRelationshipUpgrade } from './plan-relationship-upgrade.mjs'
const root=process.cwd()
const bin=process.env.PG_BIN || (process.platform==='win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '')
const executable=name=>bin ? path.join(bin,name+(process.platform==='win32'?'.exe':'')) : name
const freePort=()=>new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})})
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpp-notifications-'))
  const data = path.join(dir, 'cluster'), serverLog = path.join(dir, 'server.log'), port = await freePort()
  const run = (name, args, input) => {
    const result = spawnSync(executable(name), args, { input, encoding: 'utf8', windowsHide: true, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe', maxBuffer: 8 * 1024 * 1024 })
    assert.equal(result.status, 0, `${name}: ${result.stderr || result.stdout || result.error || `exit ${result.status}`}\n${name === 'pg_ctl' && result.status && fs.existsSync(serverLog) ? fs.readFileSync(serverLog, 'utf8') : ''}`)
    return result.stdout
  }
  run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale-provider=builtin', '--builtin-locale=C.UTF-8'])
  fs.appendFileSync(path.join(data, 'postgresql.conf'), "\nunix_socket_directories = ''\n")
  run('pg_ctl', ['-D', data, '-l', serverLog, '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'])
  const args = ['-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
  const sql = input => run('psql', args, input)
  const asyncSql = (input, onOutput) => new Promise((resolve, reject) => {
    const child = spawn(executable('psql'), args, { windowsHide: true }); let out = '', err = ''
    child.stdout.on('data', chunk => { out += chunk; onOutput?.(out) }); child.stderr.on('data', chunk => { err += chunk })
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(out) : reject(new Error(err))); child.stdin.end(input)
  })
  try {
    sql(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
    sql(fs.readFileSync(path.join(root, 'scripts/local-database-bootstrap.sql'), 'utf8'))
    for (const file of fs.readdirSync(path.join(root, 'supabase/migrations')).sort()) {
      if(file==='202611030001_plan_relationship_lifecycle.sql') await seedRelationshipUpgrade(sql)
      sql(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'))
      if(file==='202611030001_plan_relationship_lifecycle.sql') await verifyRelationshipUpgrade(sql)
    }
    sql('create extension if not exists pgtap;')
    let failed=false
    for(const file of fs.readdirSync(path.join(root,'supabase/tests')).filter(name=>name.endsWith('.sql')).sort()) {
      const result=spawnSync(executable('psql'),args,{input:databaseTestInput(fs.readFileSync(path.join(root,'supabase/tests',file),'utf8')),encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024})
      const passed=databaseTestPassed(result)
      console.log(`${passed?'PASS':'FAIL'} ${file}`)
      if(!passed){failed=true;console.error(result.stderr,result.stdout)}
    }
    if(failed)process.exitCode=1
    await testPlanRelationshipConcurrency({ sql, asyncSql })
  } finally { run('pg_ctl',['-D',data,'-m','immediate','-w','stop']) }
