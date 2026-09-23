begin;

select plan(18);

select has_table('public', 'professional_profiles', 'professional profiles table exists');
select col_is_pk('public', 'professional_profiles', 'user_id', 'professional profile is one per owner');
select fk_ok('public', 'professional_profiles', 'user_id', 'auth', 'users', 'id', 'professional profile references auth.users');
select has_type('public', 'professional_verification_status', 'verification status enum exists');
select col_has_default('public', 'professional_profiles', 'verification_status', 'verification defaults to unverified');
select has_trigger('public', 'professional_profiles', 'professional_profiles_protect_server_fields', 'profile server fields are protected');
select has_function('public', 'protect_professional_profile_fields', ARRAY[]::text[], 'profile protection trigger exists');
select has_check('public', 'professional_profiles', 'professional profile name is bounded');
select has_check('public', 'professional_profiles', 'professional specialties are bounded');
select ok((select relrowsecurity from pg_class where oid = 'public.professional_profiles'::regclass), 'professional profiles has RLS enabled');
select ok(has_table_privilege('authenticated', 'public.professional_profiles', 'SELECT'), 'authenticated can select through RLS');
select ok(has_table_privilege('authenticated', 'public.professional_profiles', 'INSERT'), 'authenticated has insert grant for RLS');
select ok(has_table_privilege('authenticated', 'public.professional_profiles', 'UPDATE'), 'authenticated has update grant for RLS');
select ok(not has_table_privilege('authenticated', 'public.professional_profiles', 'DELETE'), 'authenticated cannot delete profiles');
select policy_cmd_is('public', 'professional_profiles', 'professional_profiles_select_own', 'SELECT', 'owner select policy exists');
select policy_cmd_is('public', 'professional_profiles', 'professional_profiles_insert_professional', 'INSERT', 'professional insert policy exists');
select policy_cmd_is('public', 'professional_profiles', 'professional_profiles_update_professional', 'UPDATE', 'professional update policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'professional_profiles'), 3, 'no public enumeration or delete policy exists');

select finish();
rollback;
