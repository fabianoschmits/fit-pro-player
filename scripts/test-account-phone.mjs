import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLifecycleBrowserDatabase } from './lifecycle-browser-database.mjs'
test('private contacts persist and are visible only to owners and active counterparts', async () => {
 const f = await createLifecycleBrowserDatabase()
 const pro='10000000-0000-4000-8000-000000000001', student='10000000-0000-4000-8000-000000000002', other='10000000-0000-4000-8000-000000000003'
 try {
  await f.db.query(`insert into auth.users(id,raw_user_meta_data) values ($1,'{"phone_e164":"+5511912345678"}'),($2,'{}'),($3,'{}')`,[pro,student,other])
  assert.equal(await f.rpc(pro,'account_contact_phone',{p_user_id:pro}),'+5511912345678')
  assert.equal(await f.rpc(other,'account_contact_phone',{p_user_id:pro}),null)
  await assert.rejects(f.queryAs(other,'select * from public.account_phone_contacts'))
  await assert.rejects(f.db.exec(`set role anon; select public.account_contact_phone('${pro}')`))
  await f.db.exec('reset role')
  await f.db.query(`insert into public.professional_student_relationships(professional_user_id,student_user_id,status) values ($1,$2,'active')`,[pro,student])
  assert.equal(await f.rpc(student,'account_contact_phone',{p_user_id:pro}),'+5511912345678')
  await f.rpc(student,'save_account_phone',{p_phone:'+12025550123'})
  assert.equal(await f.rpc(pro,'account_contact_phone',{p_user_id:student}),'+12025550123')
  await assert.rejects(f.rpc(student,'save_account_phone',{p_phone:'11912'}))
  await f.db.query(`update public.professional_student_relationships set status='revoked'`)
  assert.equal(await f.rpc(pro,'account_contact_phone',{p_user_id:student}),null)
  await f.rpc(student,'save_account_phone',{p_phone:null})
  assert.equal(await f.rpc(student,'account_contact_phone',{p_user_id:student}),null)
  await f.db.query(`update auth.users set raw_user_meta_data='{"phone_e164":"+5511912345678"}' where id=$1`,[other])
  assert.equal(await f.rpc(other,'account_contact_phone',{p_user_id:other}),'+5511912345678')
  await f.rpc(other,'save_account_phone',{p_phone:null})
  await f.db.query(`update auth.users set raw_user_meta_data=raw_user_meta_data || '{"display_name":"Updated"}' where id=$1`,[other])
  assert.equal(await f.rpc(other,'account_contact_phone',{p_user_id:other}),null)
  const columns=await f.db.query(`select column_name from information_schema.columns where table_schema='public' and table_name in ('profiles','professional_profiles') and column_name like '%phone%'`)
  assert.equal(columns.rows.length,0)
 } finally { await f.close() }
})
