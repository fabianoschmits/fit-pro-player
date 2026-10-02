select has_function('public', 'professional_client_summaries', 'professional client summaries RPC exists');
select has_function('public', 'professional_client_detail', 'professional client detail RPC exists');
select has_function('public', 'publish_program_version', 'program version publication RPC exists');
select has_function('public', 'assign_program_version', 'explicit assignment RPC exists');
select has_function('public', 'student_program_overview', 'student overview RPC exists');

select ok((select prosecdef from pg_proc where oid = 'public.professional_client_summaries()'::regprocedure), 'client summaries are SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.student_program_overview()'::regprocedure), 'student overview is SECURITY DEFINER');
select ok(has_function_privilege('authenticated', 'public.professional_client_summaries()', 'EXECUTE'), 'professionals can read their client summaries');
select ok(not has_function_privilege('anon', 'public.professional_client_summaries()', 'EXECUTE'), 'anonymous users cannot read client summaries');
select ok(has_function_privilege('authenticated', 'public.assign_program_version(uuid,uuid,uuid)', 'EXECUTE'), 'authenticated users reach assignment boundary');
select ok(not has_function_privilege('anon', 'public.assign_program_version(uuid,uuid,uuid)', 'EXECUTE'), 'anonymous users cannot assign programs');
select ok(position('auth.uid()' in lower(pg_get_functiondef('public.assign_program_version(uuid,uuid,uuid)'::regprocedure))) > 0, 'assignment is caller scoped');
select ok(position('active' in lower(pg_get_functiondef('public.assign_program_version(uuid,uuid,uuid)'::regprocedure))) > 0, 'assignment requires active relationship');
select is((select prorettype::regtype::text from pg_proc where oid = 'public.publish_program_version(uuid,jsonb)'::regprocedure), 'program_versions', 'publication returns a program version');
