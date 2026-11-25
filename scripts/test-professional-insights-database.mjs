import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
// Disposable PostgreSQL/WASM. Never connects to production.
const db = new PGlite({ extensions:{pgcrypto} })
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
 await db.exec(readFileSync('scripts/local-database-bootstrap.sql','utf8'))
 for(const file of readdirSync('supabase/migrations').sort()) {
  try { await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace(/^\uFEFF/, '')) }
  catch(error) { throw new Error(file+': '+error.message,{cause:error}) }
 }
 const results=await db.exec(readFileSync('supabase/tests/202611250001_training_checkins_professional_insights.sql','utf8'))
 console.log('PASS dedicated checkin database authorization and migration scenario',results.length,'statements')
} finally { await db.close() }
