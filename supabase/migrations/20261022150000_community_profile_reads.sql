create policy profiles_select_community
on public.profiles
for select
to authenticated
using (true);
