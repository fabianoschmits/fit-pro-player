-- Keep historical prescriptions readable, but require artwork for every new
-- publication, delivery or activation. Catalogue snapshots are generated from
-- the same sprite manifest used by both frontend roles.
create table public.exercise_sprite_catalogue (
  exercise_id text primary key
);
alter table public.exercise_sprite_catalogue enable row level security;
revoke all on public.exercise_sprite_catalogue from public, anon, authenticated;
grant select on public.exercise_sprite_catalogue to authenticated;
create policy exercise_sprite_catalogue_read on public.exercise_sprite_catalogue
  for select to authenticated using (true);

create function public.require_sprite_exercises(p_entries jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'invalid exercise list' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_entries) entry
    where not exists (select 1 from public.exercise_sprite_catalogue c
      where c.exercise_id=coalesce(entry->>'exerciseId',entry->>'id'))
  ) then
    raise exception 'weekly-plan-exercise-unavailable' using errcode='22023';
  end if;
end $$;
revoke all on function public.require_sprite_exercises(jsonb) from public,anon,authenticated;

create function public.check_program_sprite_exercises() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare entries jsonb;
begin
  if new.published_at is not null then
    for entries in select value from jsonb_each(new.weekly_plan) loop
      perform public.require_sprite_exercises(entries);
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.check_program_sprite_exercises() from public,anon,authenticated;
create trigger program_versions_require_sprites
  before insert or update of weekly_plan,published_at on public.program_versions
  for each row execute function public.check_program_sprite_exercises();

create function public.check_assignment_sprite_exercises() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare entries jsonb;
begin
  if new.status='active' then
    for entries in select value from public.program_versions v,
      lateral jsonb_each(v.weekly_plan) where v.id=new.version_id loop
      perform public.require_sprite_exercises(entries);
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.check_assignment_sprite_exercises() from public,anon,authenticated;
create trigger program_assignments_require_sprites
  before insert or update of version_id,status on public.program_assignments
  for each row execute function public.check_assignment_sprite_exercises();

create function public.check_execution_plan_sprite_exercises() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.prescription->>'assigned'='true' then
    perform public.require_sprite_exercises(new.prescription->'ex');
  end if;
  return new;
end $$;
revoke all on function public.check_execution_plan_sprite_exercises() from public,anon,authenticated;
create trigger athlete_routines_require_professional_sprites
  before insert or update of prescription on public.athlete_routines
  for each row execute function public.check_execution_plan_sprite_exercises();
