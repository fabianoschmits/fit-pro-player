-- Professional model thumbnails and append-only private student notes.
-- Access to notes remains behind authenticated, relationship-scoped RPCs.

create table if not exists public.professional_student_note_entries (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default clock_timestamp(),
  legacy_note boolean not null default false,
  constraint professional_student_note_entries_body_length_check check (char_length(body) between 1 and 2000),
  constraint professional_student_note_entries_body_nonblank_check check (char_length(btrim(body)) > 0),
  foreign key (professional_id, student_id)
    references public.professional_student_relationships(professional_user_id, student_user_id) on delete cascade
);
alter table public.professional_student_note_entries enable row level security;
revoke all on table public.professional_student_note_entries from public, anon, authenticated;
create index if not exists professional_student_note_entries_recent_idx
  on public.professional_student_note_entries(professional_id, student_id, created_at desc, id desc);
create unique index if not exists professional_student_note_entries_legacy_idx
  on public.professional_student_note_entries(professional_id, student_id) where legacy_note;

-- Preserve each existing private note and its original timestamp, then empty the mutable slot.
-- A partial unique index and the emptied source make this safe to re-run.
insert into public.professional_student_note_entries(professional_id, student_id, body, created_at, legacy_note)
select professional_id, student_id, body, updated_at, true
from public.professional_student_notes
where char_length(btrim(body)) > 0
on conflict (professional_id, student_id) where legacy_note do nothing;

update public.professional_student_notes
set body = '', updated_at = clock_timestamp()
where char_length(btrim(body)) > 0;

create or replace function public.professional_programs_page(p_search text default '',p_archived bool default null,p_offset int default 0,p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid page parameters' using errcode='22023';
  end if;
  with owned as materialized (
    select p.* from public.programs p where p.professional_user_id=auth.uid()
      and not exists(select 1 from public.professional_plan_drafts d where d.program_id=p.id)
      and (p_archived is null or p.archived=p_archived)
      and strpos(lower(p.title || ' ' || coalesce(p.objective,'') || ' ' || coalesce(p.description,'')),lower(btrim(coalesce(p_search,''))))>0
  ), latest as (
    select distinct on (v.program_id) v.program_id,v.weekly_plan,max(v.published_at) over (partition by v.program_id) as published_at
    from public.program_versions v join owned p on p.id=v.program_id
    where v.published_at is not null
    order by v.program_id,v.version_number desc,v.id desc
  ), counts as (
    select a.program_id,count(distinct a.student_user_id) as student_count
    from public.program_assignments a join owned p on p.id=a.program_id
    join public.professional_student_relationships r on r.professional_user_id=auth.uid() and r.student_user_id=a.student_user_id and r.status='active'
    where a.professional_user_id=auth.uid() and a.status='active' group by a.program_id
  ), projected as materialized (
    select p.id,p.title,p.description,p.objective,p.archived,coalesce(v.weekly_plan,'{}'::jsonb) as weekly_plan,
      (select count(*) from jsonb_each(coalesce(v.weekly_plan,'{}'::jsonb)) d where jsonb_typeof(d.value)='array' and jsonb_array_length(d.value)>0) as workout_count,
      coalesce(c.student_count,0) as student_count,greatest(p.updated_at,v.published_at) as last_changed_at
    from owned p left join latest v on v.program_id=p.id left join counts c on c.program_id=p.id
  ), page as (
    select * from projected order by last_changed_at desc,id desc offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.last_changed_at desc,p.id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from projected),'offset',p_offset,'has_more',(select count(*) from projected)>p_offset::bigint+p_limit)
  into result;
  return result;
end;
$$;
revoke all on function public.professional_programs_page(text,bool,int,int) from public, anon, authenticated;
grant execute on function public.professional_programs_page(text,bool,int,int) to authenticated;

create or replace function public.list_professional_student_notes(p_student_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  perform 1 from public.professional_student_relationships
    where professional_user_id = auth.uid() and student_user_id = p_student_id and status = 'active' for share;
  if not found then raise exception 'active student relationship required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', entry.id, 'body', entry.body, 'created_at', entry.created_at)
      order by entry.created_at desc, entry.id desc), '[]'::jsonb)
    into result
    from public.professional_student_note_entries entry
    where entry.professional_id = auth.uid() and entry.student_id = p_student_id;
  return result;
end $$;

create or replace function public.add_professional_student_note(p_student_id uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.professional_student_note_entries;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  perform 1 from public.professional_student_relationships
    where professional_user_id = auth.uid() and student_user_id = p_student_id and status = 'active' for share;
  if not found then raise exception 'active student relationship required' using errcode = '42501'; end if;
  if p_body is null or char_length(p_body) not between 1 and 2000 or char_length(btrim(p_body)) = 0 then
    raise exception 'invalid private note' using errcode = '22023';
  end if;
  insert into public.professional_student_note_entries(professional_id, student_id, body)
  values (auth.uid(), p_student_id, p_body)
  returning * into result;
  return jsonb_build_object('id', result.id, 'body', result.body, 'created_at', result.created_at);
end $$;

revoke all on function public.list_professional_student_notes(uuid) from public, anon, authenticated;
revoke all on function public.add_professional_student_note(uuid,text) from public, anon, authenticated;
grant execute on function public.list_professional_student_notes(uuid) to authenticated;
grant execute on function public.add_professional_student_note(uuid,text) to authenticated;
