import assert from 'node:assert/strict'

const pro='11030300-0000-4000-8000-000000000001', student='11030300-0000-4000-8000-000000000002'
export async function seedRelationshipUpgrade(sql) {
 await sql(`insert into auth.users(id) values('${pro}'),('${student}'); insert into public.user_roles(user_id,role) values('${pro}','professional'); insert into public.professional_student_relationships(professional_user_id,student_user_id,status,accepted_at) values('${pro}','${student}','active',now());`)
 await sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${pro}'; select public.save_student_plan_draft('${student}','Existing delivery','{"routines":[{"id":"a","name":"Existing","ex":[{"id":"0043","sets":3,"reps":10}]}],"week":{"1":"a"}}',0); select public.send_student_plan('${student}',1); commit;`)
}
export async function verifyRelationshipUpgrade(sql) {
 assert.equal((await sql(`select count(*) from public.program_assignments a join public.professional_student_relationships r on r.id=a.relationship_id where a.professional_user_id='${pro}' and a.student_user_id='${student}' and r.status='active'`)).trim(),'1')
 assert.equal((await sql(`select count(*) from public.professional_plan_drafts d join public.professional_student_relationships r on r.id=d.relationship_id where d.professional_id='${pro}' and d.student_id='${student}' and d.revision=d.sent_revision`)).trim(),'1')
 for(const id of [pro,student]) await sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${id}'; select public.delete_my_account(); commit;`)
 console.log('PASS populated legacy database upgrade (deferred triggers, assignment and draft cycle backfill)')
}
