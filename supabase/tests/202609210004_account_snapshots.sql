begin;

select plan(25);

select has_table('public', 'account_snapshots', 'account snapshots table exists');
select col_is_pk('public', 'account_snapshots', 'user_id', 'one snapshot exists per user');
select fk_ok('public', 'account_snapshots', 'user_id', 'auth', 'users', 'id', 'snapshot owner references auth.users');
select col_has_default('public', 'account_snapshots', 'created_at', 'snapshot created_at has a default');
select col_has_default('public', 'account_snapshots', 'updated_at', 'snapshot updated_at has a default');
select has_check('public', 'account_snapshots', 'snapshot revision is positive');
select has_check('public', 'account_snapshots', 'snapshot schema version is positive');
select has_check('public', 'account_snapshots', 'snapshot payload is an object');
select has_function('public', 'save_own_account_snapshot', ARRAY['bigint', 'integer', 'jsonb'], 'snapshot CAS RPC exists');
select ok(
  (select prosecdef from pg_proc where oid = 'public.save_own_account_snapshot(bigint, integer, jsonb)'::regprocedure),
  'snapshot CAS RPC is security definer'
);
select ok(
  has_function_privilege('authenticated', 'public.save_own_account_snapshot(bigint, integer, jsonb)', 'EXECUTE'),
  'authenticated can execute the snapshot CAS RPC'
);
select ok(
  not has_function_privilege('anon', 'public.save_own_account_snapshot(bigint, integer, jsonb)', 'EXECUTE'),
  'anon cannot execute the snapshot CAS RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.account_snapshots', 'INSERT'),
  'authenticated cannot insert snapshots directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.account_snapshots', 'UPDATE'),
  'authenticated cannot update snapshots directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.account_snapshots', 'DELETE'),
  'authenticated cannot delete snapshots directly'
);
select ok(
  has_table_privilege('authenticated', 'public.account_snapshots', 'SELECT'),
  'authenticated can select snapshots subject to RLS'
);
select policy_cmd_is('public', 'account_snapshots', 'account_snapshots_select_own', 'SELECT', 'own snapshot select policy exists');
select policy_roles_are('public', 'account_snapshots', 'account_snapshots_select_own', ARRAY['authenticated'], 'snapshot select is authenticated-only');
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'account_snapshots'),
  1,
  'snapshot table has no write policies'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.account_snapshots'::regclass),
  'snapshot table has RLS enabled'
);
select is(
  (select count(*)::integer from pg_trigger where tgrelid = 'public.account_snapshots'::regclass),
  0,
  'snapshot timestamps are controlled by the CAS operation'
);
select ok(
  (select proconfig @> array['search_path=public, pg_temp'] from pg_proc where oid = 'public.save_own_account_snapshot(bigint, integer, jsonb)'::regprocedure),
  'snapshot CAS RPC uses a safe search path'
);
select ok(
  not has_function_privilege('public', 'public.save_own_account_snapshot(bigint, integer, jsonb)', 'EXECUTE'),
  'public cannot execute the snapshot CAS RPC'
);
select is(
  (select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'account_snapshots'),
  6,
  'snapshot table contains only the approved six columns'
);
select finish();
rollback;
