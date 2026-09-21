begin;

select plan(27);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'user_roles', 'user_roles table exists');
select has_table('public', 'legacy_identity_links', 'legacy_identity_links table exists');

select col_is_pk('public', 'profiles', 'id', 'profiles uses auth user id as primary key');
select col_is_fk('public', 'profiles', 'id', 'auth', 'users', 'id', 'profiles id references auth.users');
select col_is_pk('public', 'user_roles', 'id', 'user_roles has a surrogate primary key');
select col_is_fk('public', 'user_roles', 'user_id', 'auth', 'users', 'id', 'user_roles user_id references auth.users');
select col_is_pk('public', 'legacy_identity_links', 'id', 'identity links have a surrogate primary key');
select col_is_fk('public', 'legacy_identity_links', 'supabase_user_id', 'auth', 'users', 'id', 'identity links reference auth.users');

select has_type('public', 'user_role', 'the approved user role enum exists');
select has_type('public', 'identity_link_status', 'the identity link status enum exists');
select has_unique('public', 'profiles', ARRAY['id'], 'profile ids are unique');
select has_unique('public', 'user_roles', ARRAY['user_id', 'role'], 'a user cannot receive the same role twice');
select has_unique('public', 'legacy_identity_links', ARRAY['legacy_user_id'], 'a legacy identity links once');
select has_unique('public', 'legacy_identity_links', ARRAY['supabase_user_id'], 'a Supabase identity links once');

select col_has_default('public', 'profiles', 'created_at', 'profiles created_at has a default');
select col_has_default('public', 'profiles', 'updated_at', 'profiles updated_at has a default');
select col_has_default('public', 'user_roles', 'created_at', 'roles created_at has a default');
select col_has_default('public', 'legacy_identity_links', 'linked_at', 'identity links linked_at has a default');

select has_check('public', 'user_roles', 'user_roles_role_check', 'roles are restricted to the approved enum values');
select has_check('public', 'legacy_identity_links', 'legacy_identity_links_status_check', 'identity link status is constrained');

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

select finish();
rollback;
