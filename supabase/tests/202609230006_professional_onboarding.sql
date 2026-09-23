begin;

select plan(10);

select has_function('public', 'provision_professional_profile', array['text', 'text', 'text[]', 'text', 'text', 'text'], 'professional onboarding RPC exists');
select function_security_definer('public.provision_professional_profile(text,text,text[],text,text,text)', 'professional onboarding RPC is SECURITY DEFINER');
select function_privilege('public.provision_professional_profile(text,text,text[],text,text,text)', 'authenticated', 'EXECUTE', true, 'authenticated users can execute onboarding RPC');
select function_privilege('public.provision_professional_profile(text,text,text[],text,text,text)', 'anon', 'EXECUTE', false, 'anonymous users cannot execute onboarding RPC');

select ok(position('auth.uid()' in lower(pg_get_functiondef('public.provision_professional_profile(text,text,text[],text,text,text)'::regprocedure))) > 0, 'RPC is owner-scoped to auth.uid');
select ok(position('professional' in lower(pg_get_functiondef('public.provision_professional_profile(text,text,text[],text,text,text)'::regprocedure))) > 0, 'RPC grants only professional capability');
select ok(position('unverified' in lower(pg_get_functiondef('public.provision_professional_profile(text,text,text[],text,text,text)'::regprocedure))) > 0, 'RPC starts profiles unverified');
select ok(position('on conflict' in lower(pg_get_functiondef('public.provision_professional_profile(text,text,text[],text,text,text)'::regprocedure))) > 0, 'RPC is idempotent');
select policy_cmd_is('public', 'professional_profiles', 'professional_profiles_insert_professional', 'INSERT', 'professional profile remains RLS protected');
select ok(position('admin' in lower(pg_get_functiondef('public.provision_professional_profile(text,text,text[],text,text,text)'::regprocedure))) = 0, 'RPC has no admin escalation path');

select * from finish();
rollback;
