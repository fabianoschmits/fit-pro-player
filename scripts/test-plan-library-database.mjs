// Disposable PostgreSQL/WASM. Apply real migrations in chronological order;
// historical assertions run only at their owning schema checkpoints.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { seedRelationshipUpgrade, verifyRelationshipUpgrade } from './plan-relationship-upgrade.mjs'

const checkpoints = {
  '202610280001_library_updates.sql': ['20261027120000_plan_library.sql', 'historical/202610280001_library_updates.sql'],
  '202610280002_professional_plan_auto_updates.sql': ['historical/202610280002_professional_plan_auto_updates.sql'],
  '202610280003_professional_plan_day_views.sql': ['historical/202610280003_professional_plan_day_views.sql'],
  '202610280004_carry_seen_professional_plan_days.sql': ['historical/202610280004_carry_seen_professional_plan_days.sql'],
  '202610280006_professional_student_profile.sql': ['202610280006_professional_student_profile.sql'],
  '202610280007_professional_plan_day_pending_bases.sql': ['historical/202610280007_professional_plan_day_pending_bases.sql'],
  '202610280008_professional_student_legacy_profile.sql': ['202610280008_professional_student_legacy_profile.sql'],
  '202610290002_professional_workspace_history_notes.sql': ['historical/202610290002_note_backfill.sql'],
}
const finalTests = [
  '202610290002_professional_workspace_history_notes.sql',
  '202610310001_explicit_library_plan_application.sql',
  '202611020005_personal_professional_switching.sql',
  '202611020008_plan_selection_notifications.sql',
  '202610290003_professional_profile_invites_model_delete.sql',
  '202610290001_exercise_sprite_requirement.sql',
  '202611030001_plan_relationship_lifecycle.sql',
  '202611070001_check_email_registered_activity.sql',
]
const db = new PGlite()
const sql = async source => (await db.exec(source)).flatMap(result => result.rows.map(row => Object.values(row).join('|'))).join('\n')
const testFile = async file => {
  await db.exec(readFileSync('supabase/tests/' + file, 'utf8').replace(/^\uFEFF/, ''))
  console.log('PASS ' + file)
}
let stage = 'bootstrap'
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon,service_role; grant execute on function auth.uid() to public;`)
  await db.exec(readFileSync('scripts/local-database-bootstrap.sql', 'utf8'))
  for (const file of readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()) {
    stage = file
    if (file === '202610290002_professional_workspace_history_notes.sql') {
      await db.exec(`insert into auth.users(id) values ('10290100-0000-0000-0000-000000000001'),('10290100-0000-0000-0000-000000000002');
        insert into public.user_roles(user_id,role) values ('10290100-0000-0000-0000-000000000001','professional');
        insert into public.professional_student_relationships(id,professional_user_id,student_user_id,status)
          values ('10290110-0000-0000-0000-000000000001','10290100-0000-0000-0000-000000000001','10290100-0000-0000-0000-000000000002','active');
        insert into public.professional_student_notes(professional_id,student_id,body,updated_at)
          values ('10290100-0000-0000-0000-000000000001','10290100-0000-0000-0000-000000000002','Nota antiga','2026-10-20 12:30:00+00');`)
    }
    if (file === '202610290003_professional_profile_invites_and_model_delete.sql') {
      await db.exec(`insert into auth.users(id) values ('10290299-0000-0000-0000-000000000001');
        insert into public.user_roles(user_id,role) values ('10290299-0000-0000-0000-000000000001','professional');
        insert into public.professional_profiles(user_id,professional_name) values ('10290299-0000-0000-0000-000000000001','Legacy Pro');`)
    }
    if (file === '202611030001_plan_relationship_lifecycle.sql') await seedRelationshipUpgrade(sql)
    // PGlite provides gen_random_uuid; this suite does not install server pgcrypto.
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8').replace(/^\uFEFF/, '').replace(/create extension if not exists pgcrypto;/i, ''))
    if (file === '202611030001_plan_relationship_lifecycle.sql') await verifyRelationshipUpgrade(sql)
    if (file === '202610290003_professional_profile_invites_and_model_delete.sql') {
      const result = await db.query(`select code from public.professional_invites where professional_user_id='10290299-0000-0000-0000-000000000001' and is_personal`)
      if (result.rows[0]?.code !== 'LEGACYPRO') throw new Error('legacy personal invite was not backfilled')
    }
    for (const test of checkpoints[file] || []) { stage = test; await testFile(test) }
  }
  for (const test of finalTests) { stage = test; await testFile(test) }
} catch (error) {
  console.error(`FAIL ${stage}: ${error.message}`)
  process.exitCode = 1
} finally {
  await db.close()
}
