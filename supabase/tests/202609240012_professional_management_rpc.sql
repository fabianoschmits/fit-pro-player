select has_function('public', 'professional_client_summaries', 'professional client summaries RPC exists');
select has_function('public', 'professional_client_detail', 'professional client detail RPC exists');
select has_function('public', 'publish_program_version', 'program version publication RPC exists');
select has_function('public', 'assign_program_version', 'explicit assignment RPC exists');
select has_function('public', 'student_program_overview', 'student overview RPC exists');

select function_security_definer('public.professional_client_summaries()', 'client summaries are SECURITY DEFINER');
select function_security_definer('public.student_program_overview()', 'student overview is SECURITY DEFINER');
select function_privilege('public.professional_client_summaries()', 'authenticated', 'EXECUTE', true, 'professionals can read their client summaries');
select function_privilege('public.professional_client_summaries()', 'anon', 'EXECUTE', false, 'anonymous users cannot read client summaries');
select function_privilege('public.assign_program_version(uuid,uuid,uuid)', 'authenticated', 'EXECUTE', true, 'authenticated users reach assignment boundary');
select function_privilege('public.assign_program_version(uuid,uuid,uuid)', 'anon', 'EXECUTE', false, 'anonymous users cannot assign programs');
select ok(position('auth.uid()' in lower(pg_get_functiondef('public.assign_program_version(uuid,uuid,uuid)'::regprocedure))) > 0, 'assignment is caller scoped');
select ok(position('active' in lower(pg_get_functiondef('public.assign_program_version(uuid,uuid,uuid)'::regprocedure))) > 0, 'assignment requires active relationship');
select ok(position('version_id' in lower(pg_get_functiondef('public.publish_program_version(uuid,jsonb)'::regprocedure))) > 0, 'publication returns a version');
