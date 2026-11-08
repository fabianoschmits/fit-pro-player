begin;
-- Preserve the existing consent API while preventing a late browser save from
-- applying one account's analytics choice to a different authenticated account.
create or replace function public.record_scoped_privacy_consent(p_expected_account uuid,p_version text,p_purpose text,p_granted boolean,p_details text default '')
returns public.privacy_consents language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_account then raise exception 'consent account changed' using errcode='42501'; end if;
 return public.record_privacy_consent(p_version,p_purpose,p_granted,p_details);
end $$;
revoke all on function public.record_scoped_privacy_consent(uuid,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.record_scoped_privacy_consent(uuid,text,text,boolean,text) to authenticated;
commit;
