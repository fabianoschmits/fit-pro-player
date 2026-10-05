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

test('portable migration and operational provisioning are separate deployable artifacts', () => {
  const migration = path.join(root, 'supabase/migrations/202610040015_notifications.sql')
  const operations = path.join(root, 'supabase/operations/notifications.sql')
  assert.ok(fs.existsSync(migration), 'notification schema migration must exist')
  assert.ok(fs.existsSync(operations), 'scheduler provisioning must exist separately')
  assert.doesNotMatch(fs.readFileSync(migration, 'utf8'), /create\s+extension.*(?:pg_cron|pg_net|supabase_vault)/i, 'portable PostgreSQL migration cannot require hosted extensions')
})

test('notification RPCs enforce ownership, cancellation, claims and local calendar behavior', { skip: !available && process.env.NOTIFICATIONS_REQUIRE_DB !== '1' && 'Set PG_BIN to disposable PostgreSQL binaries' }, async () => {
  assert.ok(available, 'A complete disposable PostgreSQL runtime is required')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpp-notifications-'))
  const data = path.join(dir, 'cluster'), serverLog = path.join(dir, 'server.log'), port = await freePort()
  const run = (name, args, input) => {
    const result = spawnSync(executable(name), args, { input, encoding: 'utf8', windowsHide: true, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe', maxBuffer: 8 * 1024 * 1024 })
    assert.equal(result.status, 0, `${name}: ${result.stderr || result.stdout || result.error || `exit ${result.status}`}\n${name === 'pg_ctl' && result.status && fs.existsSync(serverLog) ? fs.readFileSync(serverLog, 'utf8') : ''}`)
    return result.stdout
  }
  run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'])
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
    for (const file of fs.readdirSync(path.join(root, 'supabase/migrations')).sort()) sql(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'))
    sql(fs.readFileSync(path.join(root, 'supabase/tests/202610040015_notifications.sql'), 'utf8'))
    // Concurrent registration/refills remain idempotent; workers claim due reminders once.
    sql(`insert into auth.users(id) values ('00000000-0000-0000-0000-000000000009');`)
    const register = `set request.jwt.claim.sub='00000000-0000-0000-0000-000000000009'; select public.register_notification_device('90000000-0000-0000-0000-000000000009',jsonb_build_object('endpoint','https://fcm.googleapis.com/concurrent','keys',jsonb_build_object('p256dh','B'||repeat('A',86),'auth',repeat('A',22))),'{"weightReminder":true}','UTC','en','{}');`
    await Promise.all([asyncSql(`begin; set local role authenticated; ${register} commit;`), asyncSql(`begin; set local role authenticated; ${register} commit;`)])
    assert.equal(sql(`select count(*) from public.notification_devices;`).trim(), '1')
    const queueFixture = key => sql(`insert into public.notification_jobs(device_id,owner_id,subscription_revision,event_key,kind,href,local_date,due_at,expires_at) select id,owner_id,subscription_revision,'${key}','weight_reminder','/#/body-progress',current_date,now(),now()+interval '1 hour' from public.notification_devices where device_key='90000000-0000-0000-0000-000000000009';`)
    queueFixture('concurrent-claim')
    const claim = `begin; set local role service_role; select jsonb_array_length(public.claim_notification_jobs(25)); select pg_sleep(0.1); commit;`
    const claims = await Promise.all([asyncSql(claim), asyncSql(claim)])
    assert.equal(claims.filter(out => /^1$/m.test(out)).length, 1, 'one dispatcher claims the current job')
    assert.equal(claims.filter(out => /^0$/m.test(out)).length, 1, 'the other dispatcher sees no duplicate claim')
    assert.equal(sql(`select bool_and(relrowsecurity) from pg_class where relname in ('notification_settings','notification_devices','notification_jobs','notification_events');`).trim(), 't')
    assert.equal(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('claim_notification_jobs','notification_job_is_current','confirm_notification_job') and has_function_privilege('authenticated',p.oid,'execute');`).trim(), '0')
    const claimed = JSON.parse(sql(`select jsonb_build_object('id',id,'token',claim_token) from public.notification_jobs where status='claimed';`).trim())
    let deviceLocked
    const locked = new Promise(resolve => { deviceLocked = resolve })
    const cancel = asyncSql(`begin; select id from public.notification_devices where device_key='90000000-0000-0000-0000-000000000009' for update;
      select 'notification-device-locked'; select pg_sleep(0.5); set local role authenticated; set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000009';
      select public.disable_notification_device('90000000-0000-0000-0000-000000000009'); commit;`, out => { if (out.includes('notification-device-locked')) deviceLocked() })
    await locked
    const acknowledgement = asyncSql(`begin; set local role service_role; select public.confirm_notification_job('${claimed.id}','${claimed.token}','invalid',410); commit;`)
    const cancelRace = await Promise.allSettled([cancel, acknowledgement])
    assert.ok(cancelRace.every(value => value.status === 'fulfilled'), `cancel/ack must not deadlock: ${cancelRace.filter(value => value.status === 'rejected').map(value => value.reason.message).join('; ')}`)
    assert.match(cancelRace[1].value, /^f$/m, 'cancellation wins over late acknowledgement')
    sql(register)
    queueFixture('expiry-one'); queueFixture('expiry-two')
    const pair = JSON.parse(sql(`select public.claim_notification_jobs(25);`).trim())
    assert.equal(pair.length, 2)
    const expiredAcks = await Promise.allSettled(pair.map(job => asyncSql(`begin; set local role service_role; select public.confirm_notification_job('${job.id}','${job.claimToken}','invalid',410); commit;`)))
    assert.ok(expiredAcks.every(value => value.status === 'fulfilled'), 'two simultaneous expiry acknowledgements cannot deadlock')
    assert.equal(expiredAcks.filter(value => /^t$/m.test(value.value)).length, 1, 'one subscription invalidation applies')
    sql(register)
    // Revocation cancels existing jobs and then emits its counterpart event. It
    // must acquire device locks before those job locks, just like confirmation.
    sql(`insert into auth.users(id) values ('00000000-0000-0000-0000-000000000008');
      insert into public.professional_profiles(user_id,professional_name) values ('00000000-0000-0000-0000-000000000008','Concurrency fixture');
      set request.jwt.claim.sub='00000000-0000-0000-0000-000000000008';
      insert into public.professional_student_relationships(id,professional_user_id,student_user_id) values
        ('10000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000009');`)
    const relationshipJob = JSON.parse(sql(`select public.claim_notification_jobs(25);`).trim()).find(job => job.kind === 'relationship_accepted')
    assert.ok(relationshipJob, 'fixture relationship produces an important claimed event')
    let relationshipDeviceLocked
    const relationshipLocked = new Promise(resolve => { relationshipDeviceLocked = resolve })
    const relationshipAck = asyncSql(`begin; select id from public.notification_devices where device_key='90000000-0000-0000-0000-000000000009' for update;
      select 'relationship-device-locked'; select pg_sleep(0.5); set local role service_role;
      select public.confirm_notification_job('${relationshipJob.id}','${relationshipJob.claimToken}','sent',201); commit;`,
      out => { if (out.includes('relationship-device-locked')) relationshipDeviceLocked() })
    await relationshipLocked
    const relationshipRevoke = asyncSql(`begin; set local role authenticated;
      set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000008';
      select public.revoke_professional_relationship('10000000-0000-0000-0000-000000000008'); commit;`)
    const relationshipRace = await Promise.allSettled([relationshipAck, relationshipRevoke])
    assert.ok(relationshipRace.every(value => value.status === 'fulfilled'),
      `relationship revocation/ack must not deadlock: ${relationshipRace.filter(value => value.status === 'rejected').map(value => value.reason.message).join('; ')}`)
    assert.equal(sql(`select status from public.professional_student_relationships where id='10000000-0000-0000-0000-000000000008';`).trim(), 'revoked')
    assert.equal(sql(`select count(*) from public.notification_jobs where kind='relationship_ended' and status='pending';`).trim(), '1', 'revocation still queues exactly one counterpart update')
    // Refills retain each device lock until commit. Insert the larger UUID first
    // so a heap scan would invert the ascending order used by event emission.
    sql(`update public.notification_devices set expanded_local_date=(now() at time zone timezone)::date;
      insert into auth.users(id) values ('00000000-0000-0000-0000-000000000007');
      insert into public.professional_profiles(user_id,professional_name) values ('00000000-0000-0000-0000-000000000007','Refill fixture');
      insert into public.notification_devices(id,device_key,owner_id,endpoint,transport,subscription,preferences,timezone,lang,schedule,expanded_local_date)
      select fixture.id::uuid,fixture.device_key::uuid,'00000000-0000-0000-0000-000000000007',
        'https://fcm.googleapis.com/'||fixture.device_key,'webpush',
        jsonb_build_object('endpoint','https://fcm.googleapis.com/'||fixture.device_key,'keys',jsonb_build_object('p256dh','B'||repeat('A',86),'auth',repeat('A',22))),
        public.notification_preferences('{}'),'UTC','en',public.notification_schedule('{}'),current_date-1
      from (values ('b0000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000007'),
        ('a0000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000007')) fixture(id,device_key);`)
    let refillDeviceLocked
    const refillLocked = new Promise(resolve => { refillDeviceLocked = resolve })
    const verificationEvent = asyncSql(`begin; select id from public.notification_devices where id='a0000000-0000-0000-0000-000000000007' for update;
      select 'refill-device-locked'; select pg_sleep(0.5); set local role service_role; set local request.jwt.claim.sub='';
      update public.professional_profiles set verification_status='verified' where user_id='00000000-0000-0000-0000-000000000007'; commit;`,
      out => { if (out.includes('refill-device-locked')) refillDeviceLocked() })
    await refillLocked
    const refill = asyncSql(`begin; set local enable_indexscan=off; set local enable_bitmapscan=off;
      select public.notification_maintenance(); commit;`)
    const refillRace = await Promise.allSettled([verificationEvent, refill])
    assert.ok(refillRace.every(value => value.status === 'fulfilled'),
      `refill/event emission must not deadlock: ${refillRace.filter(value => value.status === 'rejected').map(value => value.reason.message).join('; ')}`)
    assert.equal(sql(`select count(*) from public.notification_jobs where owner_id='00000000-0000-0000-0000-000000000007' and kind='verification_changed' and status='pending';`).trim(), '2', 'verification still reaches both registered devices')
    assert.equal(sql(`select bool_and(expanded_local_date=(now() at time zone timezone)::date) from public.notification_devices where owner_id='00000000-0000-0000-0000-000000000007';`).trim(), 't', 'maintenance refills both devices')
    // A provider invalidation locks its selected job before cancelling sibling
    // jobs. Expiry cleanup must skip those locks rather than acquire siblings in
    // reverse order and block the acknowledgement.
    sql(`insert into public.notification_jobs(id,device_id,owner_id,subscription_revision,event_key,kind,href,local_date,due_at,expires_at,status,attempts,claim_token,claimed_until)
      select fixture.id::uuid,d.id,d.owner_id,d.subscription_revision,fixture.event_key,'weight_reminder','/#/body-progress',
        current_date,now()-interval '1 minute',now()-interval '1 second','claimed',1,fixture.claim_token::uuid,now()+interval '120 seconds'
      from public.notification_devices d cross join (values
        ('b2000000-0000-0000-0000-000000000009','cleanup-first','b3000000-0000-0000-0000-000000000009'),
        ('a2000000-0000-0000-0000-000000000009','ack-first','a3000000-0000-0000-0000-000000000009')) fixture(id,event_key,claim_token)
      where d.device_key='90000000-0000-0000-0000-000000000009';`)
    let expiredJobLocked
    const expiredLocked = new Promise(resolve => { expiredJobLocked = resolve })
    const invalidAck = asyncSql(`begin; select id from public.notification_devices where device_key='90000000-0000-0000-0000-000000000009' for update;
      select id from public.notification_jobs where id='a2000000-0000-0000-0000-000000000009' for update;
      select 'expired-job-locked'; select pg_sleep(0.5); set local role service_role;
      select public.confirm_notification_job('a2000000-0000-0000-0000-000000000009','a3000000-0000-0000-0000-000000000009','invalid',410); commit;`,
      out => { if (out.includes('expired-job-locked')) expiredJobLocked() })
    await expiredLocked
    const cleanup = asyncSql(`begin; set local enable_indexscan=off; set local enable_bitmapscan=off;
      select public.notification_maintenance(); commit;`)
    const expiryRace = await Promise.allSettled([invalidAck, cleanup])
    assert.ok(expiryRace.every(value => value.status === 'fulfilled'),
      `expiry cleanup/invalid ack must not deadlock: ${expiryRace.filter(value => value.status === 'rejected').map(value => value.reason.message).join('; ')}`)
    assert.equal(sql(`select enabled from public.notification_devices where device_key='90000000-0000-0000-0000-000000000009';`).trim(), 'f', 'current provider invalidation still disables the device')
    sql(register)
    // Transaction timestamps can straddle lease expiry: the old worker still
    // holds a valid claim in its transaction while a new worker reaps siblings.
    sql(`insert into public.notification_jobs(id,device_id,owner_id,subscription_revision,event_key,kind,href,local_date,due_at,expires_at,status,attempts,claim_token,claimed_until)
      select fixture.id::uuid,d.id,d.owner_id,d.subscription_revision,fixture.event_key,'weight_reminder','/#/body-progress',
        current_date,now()-interval '1 minute',now()+interval '1 hour','claimed',1,fixture.claim_token::uuid,now()+interval '1 second'
      from public.notification_devices d cross join (values
        ('b4000000-0000-0000-0000-000000000009','reap-first','b5000000-0000-0000-0000-000000000009'),
        ('a4000000-0000-0000-0000-000000000009','lease-ack-first','a5000000-0000-0000-0000-000000000009')) fixture(id,event_key,claim_token)
      where d.device_key='90000000-0000-0000-0000-000000000009';`)
    let leaseJobLocked
    const leaseLocked = new Promise(resolve => { leaseJobLocked = resolve })
    const leaseAck = asyncSql(`begin; select id from public.notification_devices where device_key='90000000-0000-0000-0000-000000000009' for update;
      select id from public.notification_jobs where id='a4000000-0000-0000-0000-000000000009' for update;
      select 'lease-job-locked'; select pg_sleep(1.5); set local role service_role;
      select public.confirm_notification_job('a4000000-0000-0000-0000-000000000009','a5000000-0000-0000-0000-000000000009','invalid',410); commit;`,
      out => { if (out.includes('lease-job-locked')) leaseJobLocked() })
    await leaseLocked
    const leaseReap = asyncSql(`select pg_sleep(1.1); begin; set local enable_indexscan=off; set local enable_bitmapscan=off;
      set local role service_role; select public.claim_notification_jobs(25); commit;`)
    const leaseRace = await Promise.allSettled([leaseAck, leaseReap])
    assert.ok(leaseRace.every(value => value.status === 'fulfilled'),
      `lease recovery/invalid ack must not deadlock: ${leaseRace.filter(value => value.status === 'rejected').map(value => value.reason.message).join('; ')}`)
    assert.equal(sql(`select enabled from public.notification_devices where device_key='90000000-0000-0000-0000-000000000009';`).trim(), 'f', 'lease-boundary invalidation still applies to its original claim')
    sql(register)
    // Retention must not cascade back into a claimed job that expiry just skipped.
    sql(`insert into public.notification_events(id,device_id,owner_id,event_key,kind,href,expires_at)
      select fixture.id::uuid,d.id,d.owner_id,fixture.event_key,'verification_changed','/#/professional/profile',now()-interval '8 days'
      from public.notification_devices d cross join (values
        ('a6000000-0000-0000-0000-000000000009','retained-claimed-event'),
        ('b6000000-0000-0000-0000-000000000009','unreferenced-old-event')) fixture(id,event_key)
      where d.device_key='90000000-0000-0000-0000-000000000009';
      insert into public.notification_jobs(id,device_id,owner_id,subscription_revision,event_id,event_key,kind,href,local_date,due_at,expires_at,status,attempts,claim_token,claimed_until)
      select fixture.id::uuid,d.id,d.owner_id,d.subscription_revision,fixture.event_id::uuid,fixture.event_key,'weight_reminder','/#/body-progress',
        current_date,now()-interval '8 days',now()-interval '8 days','claimed',1,fixture.claim_token::uuid,now()+interval '120 seconds'
      from public.notification_devices d cross join (values
        ('b7000000-0000-0000-0000-000000000009',null,'retention-sibling','b8000000-0000-0000-0000-000000000009'),
        ('a7000000-0000-0000-0000-000000000009','a6000000-0000-0000-0000-000000000009','retention-ack','a8000000-0000-0000-0000-000000000009')) fixture(id,event_id,event_key,claim_token)
      where d.device_key='90000000-0000-0000-0000-000000000009';`)
    let retainedJobLocked
    const retainedLocked = new Promise(resolve => { retainedJobLocked = resolve })
    const retentionAck = asyncSql(`begin; select id from public.notification_devices where device_key='90000000-0000-0000-0000-000000000009' for update;
      select id from public.notification_jobs where id='a7000000-0000-0000-0000-000000000009' for update;
      select 'retained-job-locked'; select pg_sleep(0.5); set local role service_role;
      select public.confirm_notification_job('a7000000-0000-0000-0000-000000000009','a8000000-0000-0000-0000-000000000009','invalid',410); commit;`,
      out => { if (out.includes('retained-job-locked')) retainedJobLocked() })
    await retainedLocked
    const retention = asyncSql(`begin; set local enable_indexscan=off; set local enable_bitmapscan=off;
      select public.notification_maintenance(); commit;`)
    const retentionRace = await Promise.allSettled([retentionAck, retention])
    assert.ok(retentionRace.every(value => value.status === 'fulfilled'),
      `event retention/invalid ack must not deadlock: ${retentionRace.filter(value => value.status === 'rejected').map(value => value.reason.message).join('; ')}`)
    assert.equal(sql(`select count(*) from public.notification_events where event_key='retained-claimed-event';`).trim(), '1', 'referenced event waits for job retention')
    assert.equal(sql(`select count(*) from public.notification_events where event_key='unreferenced-old-event';`).trim(), '0', 'unreferenced old events are still removed')
    sql(register)
    // Only the outbound HTTP transport is a double; execute the real operations SQL,
    // its readiness transaction, leases, indexed work probe and maintenance commands.
    sql(`create schema net; create table net.calls(id bigint generated always as identity primary key,url text,headers jsonb);
      create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$declare request_id bigint; begin insert into net.calls(url,headers) values($1,$2) returning id into request_id; return request_id; end$$;
      create schema vault; create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text,description text);
      create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
      create function vault.create_secret(p_secret text,p_name text,p_description text) returns uuid language plpgsql as $$declare secret_id uuid; begin insert into vault.secrets(name,secret,description) values(p_name,p_secret,p_description) returning id into secret_id; return secret_id; end$$;
      create function vault.update_secret(p_id uuid,p_secret text,p_name text,p_description text) returns void language sql as $$update vault.secrets set name=p_name,secret=p_secret,description=p_description where id=p_id$$;
      create schema cron; create table cron.job(jobid bigint generated always as identity primary key,jobname text,schedule text,command text);
      create table cron.job_run_details(jobid bigint,end_time timestamptz);
      create function cron.schedule(p_name text,p_schedule text,p_command text) returns bigint language plpgsql as $$declare job_id bigint; begin insert into cron.job(jobname,schedule,command) values(p_name,p_schedule,p_command) returning jobid into job_id; return job_id; end$$;
      create function cron.unschedule(p_job_id bigint) returns boolean language plpgsql as $$begin delete from cron.job where jobid=p_job_id; return found; end$$;
      update public.notification_jobs set status='cancelled',claim_token=null,claimed_until=null;`)
    const operations = `\\set push_dispatch_secret ${'A'.repeat(64)}\n\\set push_project_url https://localfixture.supabase.co\n\\set push_vapid_public_key B${'A'.repeat(86)}\n${fs.readFileSync(path.join(root, 'supabase/operations/notifications.sql'), 'utf8')}`
    sql(operations)
    assert.equal(sql(`select public.notification_dispatch_tick(); select count(*) from net.calls;`).trim(), '0', 'idle tick does not call HTTP')
    queueFixture('operational-due')
    assert.equal(sql(`select public.notification_dispatch_tick(); select public.notification_dispatch_tick(); select count(*) from net.calls;`).trim().split('\n').at(-1), '1', 'one due request, second concurrent tick is leased')
    sql(`update public.notification_settings set dispatcher_until=null; update public.notification_devices set foreground_until=now()+interval '65 seconds';`)
    assert.equal(sql(`select public.notification_dispatch_tick(); select count(*) from net.calls;`).trim(), '1', 'visible device avoids HTTP invocation')
    sql(`update public.notification_settings set dispatcher_until=null,ready=false; update public.notification_devices set foreground_until=null;`)
    assert.equal(sql(`select public.notification_dispatch_tick(); select count(*) from net.calls;`).trim(), '1', 'unready deployment never invokes')
    sql(`insert into cron.job_run_details(jobid,end_time) select jobid,now()-interval '4 days' from cron.job; insert into cron.job_run_details(jobid,end_time) values(999,now()-interval '4 days');`)
    sql(operations)
    assert.deepEqual(sql(`select count(*) from vault.secrets; select count(*) from cron.job;`).trim().split(/\r?\n/), ['2', '2'], 'reprovisioning updates dedicated secrets and scheduler jobs')
    sql(sql(`select command from cron.job where jobname='fitpp-notifications-maintenance';`).trim())
    assert.equal(sql(`select count(*) from cron.job_run_details where jobid<>999;`).trim(), '0', 'retention includes historical notification scheduler IDs')
    assert.equal(sql(`select count(*) from cron.job_run_details where jobid=999;`).trim(), '1', 'unrelated scheduler logs remain intact')
    sql(`update public.notification_jobs set status='cancelled',claim_token=null,claimed_until=null;
      update public.notification_settings set native_ready=true,dispatcher_until=null;
      set request.jwt.claim.sub='00000000-0000-0000-0000-000000000009';
      select public.register_notification_device('91000000-0000-0000-0000-000000000009',jsonb_build_object('type','fcm','token',repeat('A',40),'installationProof',repeat('A',43)),'{"weightReminder":true}','UTC','en','{}');
      update public.notification_jobs set status='cancelled',claim_token=null,claimed_until=null;
      insert into public.notification_jobs(device_id,owner_id,subscription_revision,event_key,kind,href,local_date,due_at,expires_at) select id,owner_id,subscription_revision,'native-only','weight_reminder','/#/body-progress',current_date,now(),now()+interval '1 hour' from public.notification_devices where transport='fcm';
      update public.notification_settings set native_ready=false,dispatcher_until=null;`)
    assert.equal(sql(`select public.notification_dispatch_tick(); select count(*) from net.calls;`).trim(), '1', 'unconfigured FCM-only queue does not invoke an Edge Function')
    sql(`update public.notification_settings set native_ready=true;`)
    sql(operations)
    assert.equal(sql(`select native_ready from public.notification_settings;`).trim(), 't', 'web provisioning preserves explicit native provisioning capability')
  } finally { run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']) }
})
