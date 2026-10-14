select has_table('public', 'privacy_documents', 'privacy documents table exists');
select has_table('public', 'privacy_consents', 'privacy consents table exists');
select has_table('public', 'privacy_requests', 'privacy requests table exists');
select ok(has_function_privilege('authenticated', 'public.create_privacy_request(text, text)', 'EXECUTE'), 'authenticated can create own privacy request');
select ok(not has_function_privilege('anon', 'public.create_privacy_request(text, text)', 'EXECUTE'), 'anonymous cannot create privacy request');
select ok(not has_function_privilege('public', 'public.create_privacy_request(text, text)', 'EXECUTE'), 'public cannot create privacy request');
select ok(has_function_privilege('authenticated', 'public.record_privacy_consent(text, text, boolean)', 'EXECUTE'), 'authenticated can record own consent');
select ok(not has_function_privilege('anon', 'public.record_privacy_consent(text, text, boolean)', 'EXECUTE'), 'anonymous cannot record consent');
