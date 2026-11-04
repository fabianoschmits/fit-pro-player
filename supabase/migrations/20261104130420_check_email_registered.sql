-- Returns true if the given email is already registered in auth.users.
-- Callable by anonymous (unauthenticated) users so the sign-up form can
-- give instant feedback before the user submits the form.
-- The function is SECURITY DEFINER so it can read auth.users safely.
create or replace function public.check_email_registered(p_email text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(trim(p_email))
    limit 1
  );
$$;

-- Allow public (anon) role to call this function.
grant execute on function public.check_email_registered(text) to anon;
grant execute on function public.check_email_registered(text) to authenticated;

