// Browser fixture backed by the actual PostgreSQL/WASM engine and production migrations.
// Only authentication transport is stubbed; RPC bodies, RLS and persistence are real.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
const root = new URL('../', import.meta.url)
export async function createLifecycleBrowserDatabase() {
 const db = new PGlite()
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon,service_role; grant execute on function auth.uid() to public;`)
 await db.exec(readFileSync(new URL('scripts/local-database-bootstrap.sql', root), 'utf8'))
 for (const file of readdirSync(new URL('supabase/migrations/', root)).sort()) {
  await db.exec(readFileSync(new URL(`supabase/migrations/${file}`, root), 'utf8').replace(/^\uFEFF/, '').replace(/create extension if not exists pgcrypto;/i, ''))
 }
 const queryAs = (actor, sql, args = []) => db.transaction(async tx => {
  await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`, [actor])
  await tx.exec('set local role authenticated')
  return tx.query(sql, args)
 })
 const rpc = async (actor, name, args = {}) => {
  if (!/^[a-z_]+$/.test(name) || Object.keys(args).some(key => !/^p_[a-z_]+$/.test(key))) throw new Error('invalid fixture RPC')
  const keys = Object.keys(args)
  const call = `public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')})`
  const metadata = await db.query(`select proretset from pg_proc where oid=to_regprocedure($1)`, [`public.${name}()`])
  const tableFunctions = new Set(['preview_professional_invite','professional_client_detail','student_professional_detail'])
  const result = await queryAs(actor, tableFunctions.has(name) || metadata.rows[0]?.proretset
   ? `select coalesce(jsonb_agg(to_jsonb(row)),'[]'::jsonb) as data from ${call} row`
   : `select to_jsonb(${call}) as data`, keys.map(key => args[key] && typeof args[key] === 'object' ? JSON.stringify(args[key]) : args[key]))
  return result.rows[0].data
 }
 const tables = ['athlete_routines','athlete_schedules','account_preferences','professional_plan_drafts','programs','program_versions','professional_student_relationships','profiles']
 const names = ['preview_professional_invite','request_professional_link','professional_link_requests_page','professional_link_request_detail','accept_professional_link_request','reject_professional_link_request','professional_students_page','professional_dashboard_summary','professional_client_detail','professional_relationship_cycles','athlete_plan_library_page','save_personal_library_plan','apply_library_plan','save_student_plan_draft','send_student_plan','student_professional_cards','student_professional_detail','student_link_requests','revoke_professional_relationship','professional_executions_page','professional_historical_executions_page','professional_historical_student_detail','list_professional_student_notes','add_professional_student_note','save_athlete_plan','save_account_preferences','load_athlete_body','save_athlete_body']
 const browserRpc = actor => Object.fromEntries([
  ...names.map(name => [name, async args => {
   try { return await rpc(actor, name, args) }
   catch (error) { console.error('Lifecycle fixture RPC failed', name, error.code, error.message); return { __error: { status: error.code === '42501' ? 403 : 400, body: { code: error.code, message: error.message } } } }
  }]),
  ...tables.map(table => [table, async (_args, { request }) => {
   const url = new URL(request.url()), values = [], conditions = []
   for (const [key, value] of url.searchParams) {
    if (/^[a-z_]+$/.test(key) && value.startsWith('eq.')) { values.push(value.slice(3)); conditions.push(`${key}=$${values.length}`) }
   }
   const columns = url.searchParams.get('select') || '*'
   if (columns !== '*' && !/^[a-z_,]+$/.test(columns)) throw new Error('invalid fixture columns')
   const response = await queryAs(actor, `select ${columns} from public.${table}${conditions.length ? ` where ${conditions.join(' and ')}` : ''} limit 500`, values)
   return request.headers().accept?.includes('vnd.pgrst.object') ? response.rows[0] || null : response.rows
  }]),
 ])
 return { db, rpc, queryAs, browserRpc, close: () => db.close() }
}
