// Disposable PostgreSQL/WASM harness. Auth identity is stubbed; production is never contacted.
// pgcrypto provisioning is omitted because this suite does not invoke invite/crypto functions.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now()); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to authenticated,anon,service_role; grant execute on function auth.uid() to public;`)
const files = readdirSync('supabase/migrations').filter(name => name.startsWith('202609') || ['202610020014_professional_readiness.sql','202610040015_notifications.sql','202610050015_student_professional_management.sql','202610090016_professional_program_metadata.sql','202610090017_professional_workspace_reads.sql','202610190001_domain_training_state.sql','20261022110000_remove_redundant_advisory_locks.sql','20261022120000_handle_initial_insert_unique_violation.sql','20261027120000_plan_library.sql'].includes(name)).sort()
for (const name of files) {
 try { await db.exec(readFileSync('supabase/migrations/'+name,'utf8').replace(/^\uFEFF/,'').replace(/create extension if not exists pgcrypto;/i,'')); console.log('APPLIED '+name) }
 catch(e) { console.error('FAILED '+name+' '+e.message); process.exit(1) }
}
const updatesMigration = 'supabase/migrations/202610280001_library_updates.sql'
await db.exec(readFileSync(updatesMigration, 'utf8'))
try { await db.exec(readFileSync('supabase/tests/20261027120000_plan_library.sql','utf8').replace(/^\uFEFF/,'')); console.log('PASS plan library integration') } catch(e) { console.error(e.message,e.where);process.exit(1) }
try { await db.exec(readFileSync('supabase/tests/202610280001_library_updates.sql', 'utf8')); console.log('PASS library updates and personal routines') } catch(e) { console.error(e.message,e.where);process.exit(1) }
await db.exec(readFileSync('supabase/migrations/202610280002_professional_plan_auto_updates.sql', 'utf8'))
try { await db.exec(readFileSync('supabase/tests/202610280002_professional_plan_auto_updates.sql', 'utf8')); console.log('PASS automatic professional plan updates') } catch(e) { console.error(e.message,e.where);process.exit(1) }
await db.exec(readFileSync('supabase/migrations/202610280003_professional_plan_day_views.sql', 'utf8'))
try { await db.exec(readFileSync('supabase/tests/202610280003_professional_plan_day_views.sql', 'utf8')); console.log('PASS professional plan day views') } catch(e) { console.error(e.message,e.where);process.exit(1) }
await db.exec(readFileSync('supabase/migrations/202610280004_carry_seen_professional_plan_days.sql', 'utf8'))
try { await db.exec(readFileSync('supabase/tests/202610280004_carry_seen_professional_plan_days.sql', 'utf8')); console.log('PASS carry seen professional plan days') } catch(e) { console.error(e.message,e.where);process.exit(1) }
await db.exec(readFileSync('supabase/migrations/202610280005_professional_plan_day_update_bases.sql', 'utf8'))
await db.exec(readFileSync('supabase/migrations/202610280006_professional_student_profile.sql', 'utf8'))
try { await db.exec(readFileSync('supabase/tests/202610280006_professional_student_profile.sql', 'utf8')); console.log('PASS professional student profile and access control') } catch(e) { console.error(e.message,e.where);process.exit(1) }
await db.exec(readFileSync('supabase/migrations/202610280007_professional_plan_day_pending_bases.sql', 'utf8'))
try { await db.exec(readFileSync('supabase/tests/202610280007_professional_plan_day_pending_bases.sql', 'utf8')); console.log('PASS professional plan day pending bases') } catch(e) { console.error(e.message,e.where);process.exit(1) }
await db.exec(readFileSync('supabase/migrations/202610280008_professional_student_legacy_profile.sql', 'utf8'))
try { await db.exec(readFileSync('supabase/tests/202610280008_professional_student_legacy_profile.sql', 'utf8')) } catch(e) { console.error(e.message); process.exit(1) }
console.log('PASS legacy student profile compatibility')
await db.exec(readFileSync('supabase/migrations/202610290003_professional_profile_invites_and_model_delete.sql', 'utf8'))
try { await db.exec(readFileSync('supabase/tests/202610290003_professional_profile_invites_model_delete.sql', 'utf8')); console.log('PASS professional profile save contract') } catch(e) { console.error(e.message,e.where,e.query); process.exit(1) }
await db.exec(readFileSync('supabase/migrations/202610290001_exercise_sprite_requirement.sql', 'utf8'))
for (const name of readdirSync('supabase/migrations').filter(name => name.endsWith('_exercise_sprite_catalogue.sql')).sort()) {
 await db.exec(readFileSync('supabase/migrations/' + name, 'utf8'))
}
try { await db.exec(readFileSync('supabase/tests/202610290001_exercise_sprite_requirement.sql', 'utf8')); console.log('PASS sprite-only professional prescriptions and legacy activation guards') } catch(e) { console.error(e.message,e.where); process.exit(1) }
await db.exec(`
insert into auth.users(id) values ('10290100-0000-0000-0000-000000000001'),('10290100-0000-0000-0000-000000000002');
insert into public.user_roles(user_id,role) values ('10290100-0000-0000-0000-000000000001','professional');
insert into public.professional_student_relationships(id,professional_user_id,student_user_id,status)
 values ('10290110-0000-0000-0000-000000000001','10290100-0000-0000-0000-000000000001','10290100-0000-0000-0000-000000000002','active');
insert into public.professional_student_notes(professional_id,student_id,body,updated_at)
 values ('10290100-0000-0000-0000-000000000001','10290100-0000-0000-0000-000000000002','Nota antiga','2026-10-20 12:30:00+00');
`)
await db.exec(readFileSync('supabase/migrations/202610290002_professional_workspace_history_notes.sql', 'utf8'))
try { await db.exec(readFileSync('supabase/tests/202610290002_professional_workspace_history_notes.sql', 'utf8')); console.log('PASS professional model plans and private student notes') } catch(e) { console.error(e.message,e.where); process.exit(1) }
await db.close()
