begin;

select plan(59);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'user_roles', 'user_roles table exists');
select has_table('public', 'legacy_identity_links', 'legacy_identity_links table exists');

select col_is_pk('public', 'profiles', 'id', 'profiles uses auth user id as primary key');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'profiles id references auth.users');
select col_is_pk('public', 'user_roles', 'id', 'user_roles has a surrogate primary key');
select fk_ok('public', 'user_roles', 'user_id', 'auth', 'users', 'id', 'user_roles user_id references auth.users');
select col_is_pk('public', 'legacy_identity_links', 'id', 'identity links have a surrogate primary key');
select fk_ok('public', 'legacy_identity_links', 'supabase_user_id', 'auth', 'users', 'id', 'identity links reference auth.users');

select has_type('public', 'user_role', 'the approved user role enum exists');
select has_type('public', 'identity_link_status', 'the identity link status enum exists');
select col_is_unique('public', 'profiles', ARRAY['id'], 'profile ids are unique');
select col_is_unique('public', 'user_roles', ARRAY['user_id', 'role'], 'a user cannot receive the same role twice');
select col_is_unique('public', 'legacy_identity_links', ARRAY['legacy_user_id'], 'a legacy identity links once');
select col_is_unique('public', 'legacy_identity_links', ARRAY['supabase_user_id'], 'a Supabase identity links once');

select col_has_default('public', 'profiles', 'created_at', 'profiles created_at has a default');
select col_has_default('public', 'profiles', 'updated_at', 'profiles updated_at has a default');
select col_has_default('public', 'user_roles', 'created_at', 'roles created_at has a default');
select col_has_default('public', 'legacy_identity_links', 'linked_at', 'identity links linked_at has a default');
select col_has_default('public', 'legacy_identity_links', 'updated_at', 'identity links updated_at has a default');
select has_trigger('public', 'legacy_identity_links', 'legacy_identity_links_set_updated_at', 'identity links update their timestamp server-side');
select has_function('public', 'link_legacy_identity', ARRAY['text', 'uuid'], 'identity linking has a dedicated RPC function');
select ok(
  (select prosecdef from pg_proc where oid = 'public.link_legacy_identity(text, uuid)'::regprocedure),
  'identity linking RPC runs as a security definer'
);
select ok(
  has_function_privilege('service_role', 'public.link_legacy_identity(text, uuid)', 'EXECUTE'),
  'only the service role can execute the identity linking RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.link_legacy_identity(text, uuid)', 'EXECUTE'),
  'authenticated clients cannot execute the identity linking RPC'
);

select col_has_check('public', 'user_roles', 'user_roles_role_check', 'roles are restricted to the approved enum values');
select col_has_check('public', 'legacy_identity_links', 'legacy_identity_links_status_check', 'identity link status is constrained');

select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  0,
  'bootstrap test user starts without a profile'
);

insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000002',
  'phase1-bootstrap@example.test',
  'not-used-by-test',
  jsonb_build_object('display_name', '  Phase 1 Student  ', 'is_admin', true, 'unexpected', 'ignored')
);

select throws_ok(
  $$update public.profiles set display_name = repeat('x', 121) where id = '00000000-0000-0000-0000-000000000002'$$,
  '23514',
  null,
  'display names longer than 120 characters are rejected'
);

select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  1,
  'a new auth user receives exactly one profile'
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  'Phase 1 Student',
  'bootstrap copies only a trimmed bounded display name'
);
select is(
  (select count(*)::integer from public.user_roles where user_id = '00000000-0000-0000-0000-000000000002'),
  1,
  'a new auth user receives exactly one role'
);
select is(
  (select role::text from public.user_roles where user_id = '00000000-0000-0000-0000-000000000002'),
  'student',
  'a new auth user receives the student role'
);

insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000001',
  'phase1-professional@example.test',
  'not-used-by-test',
  jsonb_build_object('display_name', 'Phase 1 Professional')
);

set local role service_role;

insert into public.user_roles (user_id, role)
values ('00000000-0000-0000-0000-000000000001', 'professional');

insert into public.legacy_identity_links (legacy_user_id, supabase_user_id)
values
  ('legacy-professional', '00000000-0000-0000-0000-000000000001'),
  ('legacy-student', '00000000-0000-0000-0000-000000000002');

select lives_ok(
  $$select * from public.link_legacy_identity('legacy-student', '00000000-0000-0000-0000-000000000002'::uuid)$$,
  'identity linking RPC is idempotent for the same pair'
);
select throws_ok(
  $$select * from public.link_legacy_identity('legacy-student', '00000000-0000-0000-0000-000000000001'::uuid)$$,
  '23505',
  null,
  'identity linking RPC rejects a conflicting pair atomically'
);

create temporary table link_update_before on commit drop as
select supabase_user_id, updated_at
from public.legacy_identity_links
where supabase_user_id = '00000000-0000-0000-0000-000000000002';

update public.legacy_identity_links
set status = 'revoked'
where supabase_user_id = '00000000-0000-0000-0000-000000000002';

select ok(
  (select link.updated_at > before_update.updated_at
   from public.legacy_identity_links link
   join link_update_before before_update using (supabase_user_id)
   where link.supabase_user_id = '00000000-0000-0000-0000-000000000002'),
  'an identity-link update receives a server-controlled updated_at'
);

create temporary table profile_update_before on commit drop as
select id, updated_at
from public.profiles
where id = '00000000-0000-0000-0000-000000000002';

select is(
  (select count(*)::integer from public.profiles),
  2,
  'service-side setup can create both profiles'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  1,
  'a user can read their own profile'
);
select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  0,
  'a user cannot read another profile'
);
select lives_ok(
  $$update public.profiles set display_name = 'Updated Student' where id = '00000000-0000-0000-0000-000000000002'$$,
  'a user can update their permitted profile field'
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  'Updated Student',
  'the permitted profile update is persisted'
);
select ok(
  (select profile.updated_at > before_update.updated_at
   from public.profiles profile
   join profile_update_before before_update using (id)
   where profile.id = '00000000-0000-0000-0000-000000000002'),
  'an allowed profile update receives a server-controlled updated_at'
);
select throws_ok(
  $$update public.profiles set id = '00000000-0000-0000-0000-000000000001' where id = '00000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'a user cannot change the profile id'
);
select throws_ok(
  $$update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'a user cannot change the profile creation timestamp'
);
select lives_ok(
  $$update public.profiles set updated_at = '2000-01-01T00:00:00Z' where id = '00000000-0000-0000-0000-000000000002'$$,
  'a client cannot control the profile update timestamp'
);
select ok(
  (select updated_at <> '2000-01-01T00:00:00Z'::timestamptz
   from public.profiles
   where id = '00000000-0000-0000-0000-000000000002'),
  'the profile update timestamp is overwritten server-side'
);

select is(
  (select count(*)::integer from public.user_roles where user_id = '00000000-0000-0000-0000-000000000002'),
  1,
  'a user can read their own roles'
);
select is(
  (select count(*)::integer from public.user_roles where user_id = '00000000-0000-0000-0000-000000000001'),
  0,
  'a user cannot read another users roles'
);
select throws_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000002', 'admin')$$,
  '42501',
  null,
  'a user cannot insert an elevated role'
);
update public.user_roles set role = 'admin' where user_id = '00000000-0000-0000-0000-000000000002';
select is(
  (select role::text from public.user_roles where user_id = '00000000-0000-0000-0000-000000000002'),
  'student',
  'a user cannot update their role'
);
delete from public.user_roles where user_id = '00000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::integer from public.user_roles where user_id = '00000000-0000-0000-0000-000000000002'),
  1,
  'a user cannot delete their role'
);

select is(
  (select count(*)::integer from public.legacy_identity_links where supabase_user_id = '00000000-0000-0000-0000-000000000002'),
  1,
  'a user can read their own identity link'
);
select is(
  (select count(*)::integer from public.legacy_identity_links where supabase_user_id = '00000000-0000-0000-0000-000000000001'),
  0,
  'a user cannot read another identity link'
);
select throws_ok(
  $$insert into public.legacy_identity_links (legacy_user_id, supabase_user_id) values ('legacy-injected', '00000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'a user cannot create an identity link'
);
update public.legacy_identity_links set legacy_user_id = 'legacy-rewritten' where supabase_user_id = '00000000-0000-0000-0000-000000000002';
select is(
  (select legacy_user_id from public.legacy_identity_links where supabase_user_id = '00000000-0000-0000-0000-000000000002'),
  'legacy-student',
  'a user cannot rewrite an identity link'
);
delete from public.legacy_identity_links where supabase_user_id = '00000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::integer from public.legacy_identity_links where supabase_user_id = '00000000-0000-0000-0000-000000000002'),
  1,
  'a user cannot delete an identity link'
);

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '00000000-0000-0000-0000-000000000001',
  'role', 'authenticated',
  'user_role', 'professional'
)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  0,
  'professional users still cannot read another profile'
);
select is(
  (select count(*)::integer from public.legacy_identity_links where supabase_user_id = '00000000-0000-0000-0000-000000000002'),
  0,
  'professional users still cannot read another identity link'
);

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '00000000-0000-0000-0000-000000000002',
  'role', 'authenticated',
  'user_role', 'admin'
)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  0,
  'a client-supplied admin claim does not bypass profile ownership'
);

select finish();
rollback;
