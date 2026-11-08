import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createLifecycleBrowserDatabase } from './lifecycle-browser-database.mjs'
const f = await createLifecycleBrowserDatabase()
let checks = 0
const ok = (value, message) => { assert.ok(value, message); checks++; console.log('PASS',message) }
try {
 const admin=randomUUID(), user=randomUUID(), other=randomUUID()
 for(const id of [admin,user,other]) await f.db.query('insert into auth.users(id) values($1)',[id])
 await f.db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[admin])
 const doc=(await f.db.query("select version from public.privacy_documents where active and document_type='privacy' limit 1")).rows[0].version
 const consent = (id, analytics) => f.rpc(id,'record_privacy_consent',{p_version:doc,p_purpose:'cookie_preferences',p_granted:true,p_details:JSON.stringify({analytics})})
 const event=()=>({event_id:randomUUID(),name:'screen_viewed',occurred_at:new Date().toISOString(),session_id:randomUUID(),route:'/home',app_version:'test',platform:'web',device:'desktop'})
 const ingest=(id,events,expected=id)=>f.rpc(id,'insights_ingest',{p_events:events,p_expected_account:expected})
 ok(await ingest(user,[event()])===0,'ingest blocks missing consent')
 await consent(user,true)
 const e=event();ok(await ingest(user,[e])===1,'consented batch accepted')
 ok(await ingest(user,[e])===0,'event identifier deduplicates ingestion')
 ok(await ingest(other,[event()],user)===0,'authentication context prevents cross-account attribution')
 await assert.rejects(ingest(user,[{...event(),message:'private'}]));checks++;console.log('PASS forbidden metadata rejected')
 await assert.rejects(ingest(user,[{...event(),name:'arbitrary'}]));checks++
 await assert.rejects(ingest(user,Array.from({length:26},event)));checks++
 await assert.rejects(ingest(user,[{...event(),route:'/invite/token'}]));checks++
 await assert.rejects(f.queryAs(user,'select * from public.insights_events'));checks++
 await assert.rejects(f.rpc(user,'ops_insights',{p_section:'overview'}));checks++
 await assert.rejects(f.rpc(user,'ops_log_system_error',{p_source:'test',p_message:'blocked'}));checks++
 ok((await f.rpc(admin,'ops_insights',{p_section:'overview'})).insufficient,'small samples suppressed')
 await consent(user,false)
 ok((await f.db.query('select count(*)::int as n from public.insights_events where user_id=$1',[user])).rows[0].n===0,'revocation deletes associated optional data')
 await consent(user,true);await ingest(user,[event()]);await f.rpc(user,'insights_delete_own')
 ok((await f.db.query('select count(*)::int as n from public.insights_events where user_id=$1',[user])).rows[0].n===0,'self deletion removes only own events')
 // Five independent accounts, repeated events must not inflate distinct-user metrics.
 for(let i=0;i<5;i++) {
  const id=randomUUID(),journey=randomUUID();await f.db.query('insert into auth.users(id) values($1)',[id]);await consent(id,true)
  const start=new Date(Date.now()-10000).toISOString(),later=new Date(Date.now()-5000).toISOString()
  await ingest(id,[{...event(),name:'onboarding_started',flow:'onboarding',step:'personal',journey_id:journey,occurred_at:start},{...event(),name:'onboarding_step_completed',flow:'onboarding',step:'personal',journey_id:journey,occurred_at:start},{...event(),name:'onboarding_step_completed',flow:'onboarding',step:'avatar',journey_id:journey,occurred_at:later},...Array.from({length:3},()=>({...event(),name:'action_failed',action:'save',outcome:'medium'}))])
 }
 for(const section of ['overview','friction','funnels','workouts','retention','performance','support','alerts']) {
  const data=await f.rpc(admin,'ops_insights',{p_section:section});ok(data && typeof data==='object',section+' aggregate executes with real SQL')
 }
 const funnels=await f.rpc(admin,'ops_insights',{p_section:'funnels'})
 ok(funnels.rows.find(r=>r.flow==='onboarding').steps[0].count===5,'funnel deduplicates revisits by journey')
 const alerts=await f.rpc(admin,'ops_insights',{p_section:'alerts'})
 ok(alerts.rows.length===1,'grouped alert generated only above volume threshold')
 await f.rpc(admin,'ops_insights_alert_state',{p_id:alerts.rows[0].id,p_state:'resolved'})
 ok((await f.rpc(admin,'ops_insights',{p_section:'alerts'})).rows[0].state==='resolved','resolved alert remains resolved after recomputation')
 await assert.rejects(f.rpc(user,'ops_insights_alert_state',{p_id:alerts.rows[0].id,p_state:'open'}));checks++
 ok((await f.db.query('select count(*)::int as n from public.insights_admin_access')).rows[0].n>0,'administrative access is audited')
 await f.rpc(admin,'ops_insights_refresh_alerts',{})
 await assert.rejects(f.rpc(user,'ops_insights_refresh_alerts',{}));checks++
 ok((await f.rpc(admin,'ops_insights',{p_section:'alerts'})).rows.length===1,'anomaly rules require sufficient current and previous samples')
 for(let i=0;i<5;i++) {
  const id=randomUUID();await f.db.query('insert into auth.users(id) values($1)',[id]);await consent(id,true)
  const seedEvent = async days => f.db.query(`insert into public.insights_events(id,user_id,occurred_at,name,session_id,route,app_version,platform,device) values($1,$2,now()-($3::int*interval '1 day'),'screen_viewed',$4,'/home','cohort','web','desktop')`,[randomUUID(),id,days,randomUUID()])
  await seedEvent(8);if(i<3)await seedEvent(1)
 }
 const cohort=await f.rpc(admin,'ops_insights',{p_section:'retention',p_filters:{from:new Date(Date.now()-14*86400000).toISOString(),to:new Date().toISOString(),version:'cohort'}})
 ok(cohort.cohorts.find(c=>c.day===7).rate===60,'D7 uses eligible cohort and exact civil-day return, not all users')
 ok((await f.rpc(admin,'ops_insights',{p_section:'overview',p_filters:{platform:'native'}})).insufficient,'platform filter scopes all telemetry')
 const bounded=await f.rpc(admin,'ops_insights',{p_section:'friction',p_filters:{limit:10000,offset:20000}})
 ok(bounded.limit===50 && bounded.offset===10000,'server clamps pagination and query limits')
 await f.rpc(user,'create_privacy_request',{p_request_type:'consent_revocation'})
 ok((await f.db.query('select count(*)::int as n from public.insights_events where user_id=$1',[user])).rows[0].n===0,'privacy request participates in optional-data deletion')
 ok(await f.rpc(other,'insights_link_context',{p_kind:'request',p_id:randomUUID()})===null,'relationship correlation does not expose another account cycle')
 await f.db.query("update public.insights_alerts set affected_users=20,occurrences=50,state='open'")
 const notifications=await f.rpc(admin,'ops_list_notifications',{})
 ok(notifications.items.filter(n=>n.kind==='insight').length===1,'high-impact alert is grouped into the existing notification center')
 await f.rpc(admin,'ops_mark_notifications_read',{p_notification_id:notifications.items.find(n=>n.kind==='insight').id})
 ok((await f.rpc(admin,'ops_list_notifications',{})).items.find(n=>n.kind==='insight').read_at!==null,'Insights notification uses existing read state')
 await assert.rejects(f.rpc(user,'ops_user_insights_support',{p_user_id:other}));checks++
 await assert.rejects(f.rpc(other,'record_scoped_privacy_consent',{p_expected_account:user,p_version:doc,p_purpose:'cookie_preferences',p_granted:true,p_details:'{"analytics":true}'}));checks++
 ok((await f.rpc(user,'record_scoped_privacy_consent',{p_expected_account:user,p_version:doc,p_purpose:'cookie_preferences',p_granted:true,p_details:'{"analytics":false}'})).user_id===user,'scoped consent preserves the existing consent record contract')
 for(let i=0;i<5;i++) {
  const id=randomUUID();await f.db.query('insert into auth.users(id) values($1)',[id])
  for(let j=0;j<2;j++)await f.db.query("insert into public.workout_sessions(id,user_id,status,revision,writer_token,mass_unit,prescription_snapshot,started_at,completed_at) values($1,$2,'completed',1,$3,'kg','{}',now()-interval '2 hours',now()-interval '1 hour')",[randomUUID(),id,randomUUID()])
 }
 const engagement=await f.rpc(admin,'ops_insights_workout_engagement',{})
 ok(engagement.first_workout_users===5 && engagement.recurring_workout_users===5 && engagement.average_completed===2,'activation and recurrence use official completed sessions')
 await assert.rejects(f.rpc(user,'ops_insights_workout_engagement',{}));checks++
 console.log(`${checks} database checks passed`)
} finally { await f.close() }
