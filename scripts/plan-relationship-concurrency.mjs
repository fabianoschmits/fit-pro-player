import assert from 'node:assert/strict'

/** Two independent psql sessions against a disposable database, never an in-memory mock. */
export async function testPlanRelationshipConcurrency({ sql, asyncSql }) {
 const pro = '11030200-0000-4000-8000-000000000001', student = '11030200-0000-4000-8000-000000000002', other = '11030200-0000-4000-8000-000000000003'
 const actor = (id, source) => `begin; set local role authenticated; set local request.jwt.claim.sub='${id}'; ${source}; commit;`
 const uuid = text => text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
 sql(`insert into auth.users(id) values('${pro}'),('${student}'),('${other}'); insert into public.user_roles(user_id,role) values('${pro}','professional'),('${other}','professional'); insert into public.professional_profiles(user_id,professional_name) values('${pro}','Concorrencia');`)
 try {
 const request = uuid(sql(actor(student, `select (public.request_professional_link('CONCORRENCIA')).id`)))
 await assert.rejects(asyncSql(actor(student, `select public.accept_professional_link_request('${request}')`)), /request recipient required/)
 await assert.rejects(asyncSql(actor(other, `select public.reject_professional_link_request('${request}')`)), /request recipient required/)
 const accepted = await Promise.all([asyncSql(actor(pro, `select (public.accept_professional_link_request('${request}')).id`)), asyncSql(actor(pro, `select (public.accept_professional_link_request('${request}')).id`))])
 assert.ok(uuid(accepted[0])); assert.equal(uuid(accepted[0]), uuid(accepted[1]), 'parallel accepts must return the same cycle')
 assert.equal(sql(`select count(*) from public.professional_student_relationships where professional_user_id='${pro}' and student_user_id='${student}' and status='active'`).trim(), '1')
 console.log('PASS parallel request acceptance (two sessions, one new cycle), unauthorized decisions')
 sql(actor(student, `select public.save_athlete_plan(0,'weekly','{"week":{"2":"11030200-0000-4000-8000-000000000010"},"dayPlan":{}}','[{"id":"11030200-0000-4000-8000-000000000010","title":"Personal survives race","prescription":{"ex":[]}}]')`))
 const personalPlan = uuid(sql(actor(student, "select public.save_personal_library_plan('Personal race baseline')")))
 sql(actor(student, `select public.apply_library_plan('${personalPlan}')`))
 let cycle = uuid(accepted[0])
 const cycles = new Set([cycle])
 for (let iteration = 0; iteration < 4; iteration++) {
  if (iteration) {
   const next = uuid(sql(actor(student, `select (public.request_professional_link('CONCORRENCIA')).id`)))
   cycle = uuid(sql(actor(pro, `select (public.accept_professional_link_request('${next}')).id`)))
   assert.ok(!cycles.has(cycle)); cycles.add(cycle)
  }
  sql(actor(pro, `select public.save_student_plan_draft('${student}','Race ${iteration}','{"routines":[{"id":"a","name":"Professional","ex":[{"id":"0043","sets":3,"reps":10}]}],"week":{"1":"a"}}',0); select public.send_student_plan('${student}',1)`))
  const target = uuid(sql(`select l.id from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id where a.relationship_id='${cycle}'`))
  const version = uuid(sql(`select a.version_id from public.program_assignments a join public.athlete_plan_library l on l.assignment_id=a.id where l.id='${target}'`))
  sql(actor(student, `select public.mark_professional_plan_update_day_seen('${target}','${version}','monday')`))
  const rev = Number(sql(`select revision from public.athlete_schedules where user_id='${student}'`).trim())
  const race = await Promise.allSettled([
   asyncSql(actor(student, `select public.apply_library_plan('${target}',${rev})`)),
   asyncSql(actor(iteration % 2 ? student : pro, `select public.revoke_professional_relationship('${cycle}')`)),
  ])
  assert.equal(race[1].status, 'fulfilled', race[1].reason?.message)
  if (race[0].status === 'rejected') assert.match(race[0].reason.message, /delivery unavailable|relationship unavailable|plan revision conflict/)
  assert.equal(sql(`select l.source_type||':'||(s.schedule ? 'assignedProgram')::text from public.athlete_plan_selection sel join public.athlete_plan_library l on l.id=sel.plan_id join public.athlete_schedules s on s.user_id=sel.user_id where sel.user_id='${student}'`).trim(), 'self:false')
  assert.equal(sql(`select count(*) from public.program_assignments where relationship_id='${cycle}' and status='active'`).trim(), '0')
  assert.equal(sql(`select title from public.athlete_routines where id='11030200-0000-4000-8000-000000000010'`).trim(), 'Personal survives race')
  await assert.rejects(asyncSql(actor(student, `select public.apply_library_plan('${target}')`)), /delivery unavailable|relationship unavailable/)
 }
 assert.equal(cycles.size, 4)
 console.log('PASS apply versus revoke races (four cycles, student/professional closure, personal preservation, old-cycle rejection)')
 const finalRequest = uuid(sql(actor(student, `select (public.request_professional_link('CONCORRENCIA')).id`)))
 sql(actor(pro, `select public.accept_professional_link_request('${finalRequest}'); select public.save_student_plan_draft('${student}','Account closure','{"routines":[{"id":"a","name":"Professional","ex":[{"id":"0043","sets":3,"reps":10}]}],"week":{"1":"a"}}',0); select public.send_student_plan('${student}',1)`))
 const current = uuid(sql(`select l.id from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id where a.student_user_id='${student}' and a.status='active'`))
 sql(actor(student, `select public.apply_library_plan('${current}')`))
 const deletion = await Promise.allSettled([
  asyncSql(actor(pro, 'select public.delete_my_account()')),
  asyncSql(actor(student, `select public.apply_library_plan('${current}')`)),
 ])
 assert.equal(deletion[0].status, 'fulfilled', deletion[0].reason?.message)
 if (deletion[1].status === 'rejected') assert.match(deletion[1].reason.message, /delivery unavailable|relationship unavailable|plan unavailable|plan ownership required/)
 assert.equal(sql(`select l.source_type||':'||(s.schedule ? 'assignedProgram')::text from public.athlete_plan_selection sel join public.athlete_plan_library l on l.id=sel.plan_id join public.athlete_schedules s on s.user_id=sel.user_id where sel.user_id='${student}'`).trim(), 'self:false')
 assert.equal(sql(`select title from public.athlete_routines where id='11030200-0000-4000-8000-000000000010'`).trim(), 'Personal survives race')
 console.log('PASS professional account deletion versus application (read receipts, historical drafts, requests, personal fallback)')
 sql(`insert into public.professional_student_relationships(professional_user_id,student_user_id,status,accepted_at) values('${other}','${student}','active',now())`)
 sql(actor(other, `select public.save_student_plan_draft('${student}','First send','{"routines":[{"id":"a","name":"Professional","ex":[{"id":"0043","sets":3,"reps":10}]}],"week":{"1":"a"}}',0)`))
 const firstSend = await Promise.allSettled([
  asyncSql(actor(other, `select pg_advisory_xact_lock(hashtextextended('fitpp.student:${student}',0)); select pg_sleep(0.2); select public.send_student_plan('${student}',1)`)),
  asyncSql(actor(other, 'select pg_sleep(0.05); select public.delete_my_account()')),
 ])
 assert.equal(firstSend[0].status, 'fulfilled', firstSend[0].reason?.message)
 assert.equal(firstSend[1].status, 'fulfilled', firstSend[1].reason?.message)
 console.log('PASS first delivery versus account deletion (student lock precedes program and relationship locks)')
 } finally {
  // The runner is repeatable and also exercises the existing account-deletion boundary.
  for (const id of [pro, student, other]) if (sql(`select count(*) from auth.users where id='${id}'`).trim() === '1') sql(actor(id, 'select public.delete_my_account()'))
 }
}
