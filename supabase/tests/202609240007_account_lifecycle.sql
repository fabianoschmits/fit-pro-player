select has_function('public', 'delete_my_account', '{}', 'caller account deletion RPC exists');
select ok(
  (select prosecdef from pg_proc where oid = 'public.delete_my_account()'::regprocedure),
  'caller account deletion RPC is security definer'
);
select ok(
  (select proconfig @> array['search_path=public, auth, pg_temp'] from pg_proc where oid = 'public.delete_my_account()'::regprocedure),
  'caller account deletion RPC pins search_path'
);
select ok(has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE'), 'authenticated can delete own account');
select ok(not has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE'), 'anonymous cannot delete accounts');
select ok(not has_function_privilege('public', 'public.delete_my_account()', 'EXECUTE'), 'public cannot delete accounts');
