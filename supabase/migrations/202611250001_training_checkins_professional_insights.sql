-- Additive private context, explicit per-cycle consent and professional tracking.
begin;
create table public.training_checkins (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 workout_id text not null check(char_length(workout_id) between 1 and 256),
 version int not null default 1 check(version=1),
 status text not null check(status in ('answered','dismissed','removed')),
 reasons text[] not null default '{}',
 note text not null default '' check(char_length(note)<=280),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 answered_at timestamptz, dismissed_at timestamptz, removed_at timestamptz,
 revision bigint not null default 1 check(revision>0), operation_id uuid not null,
 unique(user_id,workout_id), unique(id,user_id),
 check(status='answered' or (reasons='{}' and note=''))
);
create table public.training_checkin_shares (
 checkin_id uuid not null, student_id uuid not null,
 professional_id uuid not null, relationship_id uuid not null,
 shared_reasons text[] not null default '{}', granted_at timestamptz not null default now(),
 revoked_at timestamptz, revision bigint not null default 1 check(revision>0),
 primary key(checkin_id,relationship_id),
 foreign key(checkin_id,student_id) references public.training_checkins(id,user_id) on delete cascade,
 foreign key(relationship_id,professional_id,student_id) references public.professional_student_relationships(id,professional_user_id,student_user_id) on delete cascade
);
create index training_checkin_shares_professional_idx on public.training_checkin_shares(professional_id,relationship_id) where revoked_at is null;
create table public.training_checkin_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null, workout_id text not null, request_fingerprint text not null,
 primary key(user_id,operation_id)
);
create table public.professional_insight_states (
 professional_id uuid not null references auth.users(id) on delete cascade,
 student_id uuid not null, relationship_id uuid not null,
 insight_type text not null check(insight_type in ('recurring_time_constraint','recurring_low_completion','recurring_equipment_unavailable','recurring_exercise_changes','reduced_training_frequency','no_recent_workouts','recurring_fatigue','reported_discomfort','frequent_flex_adjustments','positive_training_consistency')),
 episode_key text not null check(char_length(episode_key)<=256),
 evidence_fingerprint text not null check(char_length(evidence_fingerprint)<=16384),
 status text not null check(status in ('new','reviewed','snoozed','archived')),
 reviewed_at timestamptz, snoozed_until timestamptz, archived_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision bigint not null default 1 check(revision>0),
 primary key(professional_id,relationship_id,insight_type),
 foreign key(relationship_id,professional_id,student_id) references public.professional_student_relationships(id,professional_user_id,student_user_id) on delete cascade
);
alter table public.training_checkins enable row level security;
alter table public.training_checkin_shares enable row level security;
alter table public.training_checkin_operations enable row level security;
alter table public.professional_insight_states enable row level security;
revoke all on public.training_checkins,public.training_checkin_shares,public.training_checkin_operations,public.professional_insight_states from public,anon,authenticated;
grant select on public.training_checkins,public.training_checkin_shares to authenticated;
create policy checkins_owner_read on public.training_checkins for select to authenticated using(user_id=auth.uid());
create policy checkin_shares_owner_read on public.training_checkin_shares for select to authenticated using(student_id=auth.uid());
create function public.professional_insight_consent_valid(p_relationship uuid,p_type text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.professional_student_relationships r where r.id=p_relationship and r.professional_user_id=auth.uid() and r.status='active'
 and (p_type not in ('recurring_time_constraint','recurring_equipment_unavailable','recurring_fatigue','reported_discomfort') or exists(
 select 1 from public.training_checkin_shares s join public.training_checkins c on c.id=s.checkin_id and c.user_id=s.student_id
 where s.relationship_id=r.id and s.professional_id=auth.uid() and s.revoked_at is null and c.status='answered'
 and (case p_type when 'recurring_time_constraint' then 'time_constraint' when 'recurring_equipment_unavailable' then 'equipment_unavailable' when 'recurring_fatigue' then 'fatigue' else 'pain_or_discomfort' end)=any(s.shared_reasons)
 and (case p_type when 'recurring_time_constraint' then 'time_constraint' when 'recurring_equipment_unavailable' then 'equipment_unavailable' when 'recurring_fatigue' then 'fatigue' else 'pain_or_discomfort' end)=any(c.reasons))))
$$;
revoke all on function public.professional_insight_consent_valid(uuid,text) from public,anon;
grant execute on function public.professional_insight_consent_valid(uuid,text) to authenticated;
create policy insight_states_owner_read on public.professional_insight_states for select to authenticated using(professional_id=auth.uid() and public.professional_insight_consent_valid(relationship_id,insight_type));
-- A fingerprint contains session associations. Redact each withdrawn association,
-- not merely the entire state when its last grant is revoked.
create function public.professional_insight_safe_fingerprint(p_relationship uuid,p_type text,p_value text)
returns text language sql stable set search_path=public,pg_temp as $$
 select case when p_type not in ('recurring_time_constraint','recurring_equipment_unavailable','recurring_fatigue','reported_discomfort') then p_value else
 jsonb_build_array(p_type,coalesce((select jsonb_agg(to_jsonb(i.value) order by i.value)
 from jsonb_array_elements_text(p_value::jsonb->1)i where exists(
 select 1 from public.training_checkin_shares s join public.training_checkins c on c.id=s.checkin_id and c.user_id=s.student_id
 join public.professional_student_relationships r on r.id=s.relationship_id and r.professional_user_id=auth.uid() and r.status='active'
 where s.relationship_id=p_relationship and c.workout_id=i.value and c.status='answered' and s.revoked_at is null
 and (case p_type when 'recurring_time_constraint' then 'time_constraint' when 'recurring_equipment_unavailable' then 'equipment_unavailable' when 'recurring_fatigue' then 'fatigue' else 'pain_or_discomfort' end)=any(s.shared_reasons)
 and (case p_type when 'recurring_time_constraint' then 'time_constraint' when 'recurring_equipment_unavailable' then 'equipment_unavailable' when 'recurring_fatigue' then 'fatigue' else 'pain_or_discomfort' end)=any(c.reasons)
 )),'[]'::jsonb),p_value::jsonb->2)::text end
$$;
revoke all on function public.professional_insight_safe_fingerprint(uuid,text,text) from public,anon,authenticated;

-- Internal: textual workout identifiers belong to canonical completed history.
create function public.checkin_workout_owned(p_user uuid,p_workout text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.workout_sessions s join public.workout_session_operations o on o.session_id=s.id and o.user_id=s.user_id
  where s.user_id=p_user and s.status='completed' and o.kind='session_completed' and o.payload->'workout'->>'id'=p_workout)
 or exists(select 1 from public.account_snapshots a cross join lateral jsonb_array_elements(case when jsonb_typeof(a.payload->'workouts')='array' then a.payload->'workouts' else '[]'::jsonb end) w
  where a.user_id=p_user and w->>'id'=p_workout and (not w ? 'status' or w->>'status'='completed') and jsonb_typeof(w->'entries')='array')
$$;
revoke all on function public.checkin_workout_owned(uuid,text) from public,anon,authenticated;

create function public.save_training_checkin(p_workout_id text,p_record jsonb,p_expected_revision bigint,p_operation_id uuid,p_shares jsonb default null,p_import boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); row public.training_checkins; oldop public.training_checkin_operations;
 reasons text[]; state text; observation text; share jsonb; rel public.professional_student_relationships; requested text[]; req jsonb; request_hash text;
begin
 if caller is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_workout_id is null or char_length(p_workout_id) not between 1 and 256 or p_operation_id is null or p_expected_revision is null or p_expected_revision<0 or p_record->>'version' is distinct from '1' then raise exception 'invalid checkin' using errcode='22023'; end if;
 state:=p_record->>'status'; observation:=btrim(coalesce(p_record->>'note',''));
 if state is null or state not in ('answered','dismissed','removed') or char_length(observation)>280 or (p_record ? 'reasons' and jsonb_typeof(p_record->'reasons')<>'array') then raise exception 'invalid checkin' using errcode='22023'; end if;
 select coalesce(array_agg(value),'{}') into reasons from jsonb_array_elements_text(coalesce(p_record->'reasons','[]')) v;
 if cardinality(reasons)<>(select count(distinct x) from unnest(reasons)x) or not reasons <@ array['time_constraint','fatigue','equipment_unavailable','pain_or_discomfort','personal_preference','unexpected_event','flex_adjustment','professional_guidance','training_felt_easy','felt_good_to_continue','other'] then raise exception 'invalid reasons' using errcode='22023'; end if;
 if state<>'answered' then reasons:='{}';observation:=''; elsif cardinality(reasons)=0 and observation='' then raise exception 'empty checkin' using errcode='22023'; end if;
 if p_shares is not null and (jsonb_typeof(p_shares)<>'array' or jsonb_array_length(p_shares)>50) then raise exception 'invalid shares' using errcode='22023';end if;
 req:=jsonb_build_object('record',p_record,'shares',p_shares,'import',p_import);
 request_hash:=encode(sha256(convert_to(req::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('checkin:'||caller||':'||p_workout_id,0));
 select * into oldop from public.training_checkin_operations where user_id=caller and operation_id=p_operation_id;
 if found then
  if oldop.workout_id<>p_workout_id or oldop.request_fingerprint<>request_hash then raise exception 'operation mismatch' using errcode='22023';end if;
  select * into row from public.training_checkins where user_id=caller and workout_id=p_workout_id;
  return to_jsonb(row);
 end if;
 select * into row from public.training_checkins where user_id=caller and workout_id=p_workout_id for update;
 if p_import and row.id is not null then
  -- Never choose between a legacy write and a dedicated write using device time.
  if row.operation_id is distinct from p_operation_id then raise exception 'legacy checkin conflict' using errcode='40001';end if;
 elsif coalesce(row.revision,0)<>p_expected_revision then raise exception 'checkin revision conflict' using errcode='40001';end if;
 if not public.checkin_workout_owned(caller,p_workout_id) then raise exception 'completed workout not found' using errcode='42501';end if;
 insert into public.training_checkins(user_id,workout_id,status,reasons,note,operation_id,answered_at,dismissed_at,removed_at)
 values(caller,p_workout_id,state,reasons,observation,p_operation_id,case when state='answered' then now() end,case when state='dismissed' then now() end,case when state='removed' then now() end)
 on conflict(user_id,workout_id) do update set status=excluded.status,reasons=excluded.reasons,note=excluded.note,operation_id=excluded.operation_id,
  updated_at=now(),revision=training_checkins.revision+1,answered_at=coalesce(training_checkins.answered_at,excluded.answered_at),dismissed_at=excluded.dismissed_at,removed_at=excluded.removed_at returning * into row;
 -- Removed reasons disappear from every existing grant immediately. New reasons
 -- require an explicit replacement grant; the note never enters this table.
 update public.training_checkin_shares s set shared_reasons=array(select x from unnest(s.shared_reasons)x where x=any(reasons)),
  revoked_at=case when state<>'answered' then now() else s.revoked_at end,revision=s.revision+1 where s.checkin_id=row.id;
 if p_shares is not null then
  update public.training_checkin_shares set revoked_at=now(),shared_reasons='{}',revision=revision+1 where checkin_id=row.id;
  for share in select * from jsonb_array_elements(p_shares) loop
   select * into rel from public.professional_student_relationships where id=(share->>'relationshipId')::uuid and student_user_id=caller and status='active' for share;
   if not found then raise exception 'active relationship required' using errcode='42501';end if;
   select coalesce(array_agg(value),'{}') into requested from jsonb_array_elements_text(share->'reasons');
   if state<>'answered' or not requested<@reasons or cardinality(requested)<>(select count(distinct x) from unnest(requested)x) or ('pain_or_discomfort'=any(requested) and coalesce((share->>'sensitiveConsent')::boolean,false)=false) then raise exception 'invalid reason consent' using errcode='22023';end if;
   insert into public.training_checkin_shares(checkin_id,student_id,professional_id,relationship_id,shared_reasons)
   values(row.id,caller,rel.professional_user_id,rel.id,requested)
   on conflict(checkin_id,relationship_id) do update set shared_reasons=excluded.shared_reasons,revoked_at=null,granted_at=now(),revision=training_checkin_shares.revision+1;
  end loop;
 end if;
 insert into public.training_checkin_operations values(caller,p_operation_id,p_workout_id,request_hash);
 -- Remove exactly the acknowledged legacy value, preserving unrelated settings.
 -- An old PWA can reintroduce it; reads still prefer the dedicated revision.
 update public.account_preferences set preferences=jsonb_set(preferences,'{trainingCheckIns}',(preferences->'trainingCheckIns')-p_workout_id),
  revision=revision+1,updated_at=now()
 where user_id=caller and preferences->'trainingCheckIns'->p_workout_id=p_record;
 return to_jsonb(row);
end $$;
revoke all on function public.save_training_checkin(text,jsonb,bigint,uuid,jsonb,boolean) from public,anon;
grant execute on function public.save_training_checkin(text,jsonb,bigint,uuid,jsonb,boolean) to authenticated;

-- No shared reasons or student histories are cached persistently by the client.
create function public.get_professional_insights_context(p_offset int default 0,p_limit int default 20,p_student_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then raise exception 'invalid page' using errcode='22023';end if;
 with rels as materialized (
  select r.*,p.display_name,p.avatar_ref from public.professional_student_relationships r left join public.profiles p on p.id=r.student_user_id
  where r.professional_user_id=auth.uid() and r.status='active' and (p_student_id is null or r.student_user_id=p_student_id)
 ), page as (select * from rels order by id offset p_offset limit p_limit),
 entries as (
  select r.id,jsonb_build_object('student',jsonb_build_object('id',r.student_user_id,'relationshipId',r.id,'displayName',r.display_name,'avatarRef',r.avatar_ref,'relationshipCreatedAt',r.created_at),
   'coverage',jsonb_build_object('complete',false,'scope','authorized-professional-executions'),
   'workouts',coalesce((select jsonb_agg(w.value) from (
     select jsonb_build_object('id',coalesce(e.payload->>'workoutId',e.id::text),'name',coalesce(e.payload->>'workoutName',e.prescription_snapshot->>'workoutTitle',''),'completedAt',e.completed_at,'status','completed',
      'entries',coalesce(e.payload->'entries','[]'::jsonb),'comparison',e.payload->'comparison','executionId',e.id) value
     from public.workout_executions e join public.program_assignments a on a.id=e.assignment_id
     where a.relationship_id=r.id and a.professional_user_id=auth.uid() and e.student_user_id=r.student_user_id and e.status='completed'
      and e.completed_at>=now()-interval '42 days' and e.completed_at<=now() order by e.completed_at desc,e.id limit 200
    )w),'[]'::jsonb),
   'sharedCheckins',coalesce((select jsonb_agg(jsonb_build_object('workoutId',c.workout_id,'reasons',array(select x from unnest(s.shared_reasons)x where x=any(c.reasons))))
    from public.training_checkin_shares s join public.training_checkins c on c.id=s.checkin_id and c.user_id=s.student_id
    where s.relationship_id=r.id and s.professional_id=auth.uid() and s.revoked_at is null and c.status='answered' and c.updated_at>=now()-interval '42 days'),'[]'::jsonb),
   'states',coalesce((select jsonb_agg(jsonb_build_object('type',s.insight_type,'episodeKey',s.episode_key,'evidenceFingerprint',public.professional_insight_safe_fingerprint(s.relationship_id,s.insight_type,s.evidence_fingerprint),'status',s.status,'snoozedUntil',s.snoozed_until,'revision',s.revision))
    from public.professional_insight_states s where s.relationship_id=r.id and s.professional_id=auth.uid() and public.professional_insight_consent_valid(s.relationship_id,s.insight_type)),'[]'::jsonb)
  ) value from page r
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(value order by id) from entries),'[]'::jsonb),'total',(select count(*) from rels),'hasMore',(select count(*) from rels)>p_offset+p_limit,'offset',p_offset) into result;
 return result;
end $$;
revoke all on function public.get_professional_insights_context(int,int,uuid) from public,anon;
grant execute on function public.get_professional_insights_context(int,int,uuid) to authenticated;

create function public.save_professional_insight_state(p_relationship_id uuid,p_type text,p_episode_key text,p_fingerprint text,p_status text,p_expected_revision bigint,p_snooze_days int default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare rel public.professional_student_relationships; row public.professional_insight_states;
begin
 if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501';end if;
 select * into rel from public.professional_student_relationships where id=p_relationship_id and professional_user_id=auth.uid() and status='active' for share;
 if not found then raise exception 'active relationship required' using errcode='42501';end if;
 if p_status is null or p_status not in ('new','reviewed','snoozed','archived') or (p_status='snoozed' and (p_snooze_days is null or p_snooze_days not in (1,3,7))) then raise exception 'invalid state' using errcode='22023';end if;
 if p_fingerprint is null or jsonb_typeof(p_fingerprint::jsonb)<>'array' or jsonb_array_length(p_fingerprint::jsonb)<>3 or p_fingerprint::jsonb->>0 is distinct from p_type or jsonb_typeof(p_fingerprint::jsonb->1)<>'array' then raise exception 'invalid fingerprint' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('insight:'||rel.id||':'||p_type,0));
 select * into row from public.professional_insight_states where professional_id=auth.uid() and relationship_id=rel.id and insight_type=p_type for update;
 if p_expected_revision is null or coalesce(row.revision,0)<>p_expected_revision then raise exception 'insight revision conflict' using errcode='40001';end if;
 insert into public.professional_insight_states(professional_id,student_id,relationship_id,insight_type,episode_key,evidence_fingerprint,status,reviewed_at,snoozed_until,archived_at)
 values(auth.uid(),rel.student_user_id,rel.id,p_type,p_episode_key,p_fingerprint,p_status,case when p_status='reviewed' then now() end,case when p_status='snoozed' then now()+make_interval(days=>p_snooze_days) end,case when p_status='archived' then now() end)
 on conflict(professional_id,relationship_id,insight_type) do update set episode_key=excluded.episode_key,evidence_fingerprint=excluded.evidence_fingerprint,status=excluded.status,reviewed_at=excluded.reviewed_at,snoozed_until=excluded.snoozed_until,archived_at=excluded.archived_at,revision=professional_insight_states.revision+1,updated_at=now() returning * into row;
 return to_jsonb(row);
end $$;
revoke all on function public.save_professional_insight_state(uuid,text,text,text,text,bigint,int) from public,anon;
grant execute on function public.save_professional_insight_state(uuid,text,text,text,text,bigint,int) to authenticated;
commit;
