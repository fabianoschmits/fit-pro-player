-- Dedicated rejection code: never confuse an ended grant with owner/auth denial.
begin;
create or replace function public.save_training_checkin(p_workout_id text,p_record jsonb,p_expected_revision bigint,p_operation_id uuid,p_shares jsonb default null,p_import boolean default false)
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
   select coalesce(array_agg(value),'{}') into requested from jsonb_array_elements_text(coalesce(share->'reasons','[]'));
   -- All old grants were already revoked above. Empty requests are revocations,
   -- and require no active cycle. A new nonempty grant always requires one.
   if cardinality(requested)=0 then continue;end if;
   select * into rel from public.professional_student_relationships where id=(share->>'relationshipId')::uuid and student_user_id=caller and status='active' for share;
   if not found then raise exception 'checkin sharing relationship is no longer active' using errcode='PCK01';end if;
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



commit;
