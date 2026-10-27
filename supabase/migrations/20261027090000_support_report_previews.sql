drop function if exists public.support_list_my_tickets(public.support_ticket_status, integer, integer);
create function public.support_list_my_tickets(p_status public.support_ticket_status default null, p_limit integer default 50, p_offset integer default 0)
returns table(ticket_id uuid, subject text, category_slug text, category_label text, status public.support_ticket_status, priority public.support_ticket_priority, last_message_at timestamptz, created_at timestamptz, report_context jsonb)
language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
  return query select t.id,t.subject,c.slug,c.label,t.status,t.priority,t.last_message_at,t.created_at,
    (select jsonb_build_object('target_kind',r.target_kind,'post_id',r.post_id,'comment_id',r.comment_id,'reported_user_id',r.reported_user_id,'verification_link',r.verification_link,'content_excerpt',r.content_excerpt,'image_path',p.image_path) from public.community_report_context r left join public.community_posts p on p.id=r.post_id where r.ticket_id=t.id)
  from public.support_tickets t join public.support_categories c on c.id=t.category_id
  where t.user_id=auth.uid() and (p_status is null or t.status=p_status)
  order by t.last_message_at desc limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(0,coalesce(p_offset,0));
end; $$;
revoke all on function public.support_list_my_tickets(public.support_ticket_status,integer,integer) from public,anon;
grant execute on function public.support_list_my_tickets(public.support_ticket_status,integer,integer) to authenticated;

create or replace function public.support_ticket_detail(p_ticket_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ declare v jsonb; begin
 select jsonb_build_object('ticket',to_jsonb(t),'category',jsonb_build_object('slug',c.slug,'label',c.label),'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.support_messages m where m.ticket_id=t.id),'[]'::jsonb),'report_context',(select jsonb_build_object('target_kind',r.target_kind,'post_id',r.post_id,'comment_id',r.comment_id,'reported_user_id',r.reported_user_id,'verification_link',r.verification_link,'content_excerpt',r.content_excerpt,'image_path',p.image_path) from public.community_report_context r left join public.community_posts p on p.id=r.post_id where r.ticket_id=t.id)) into v from public.support_tickets t join public.support_categories c on c.id=t.category_id where t.id=p_ticket_id and t.user_id=auth.uid(); if v is null then raise exception 'ticket not found' using errcode='P0002'; end if; return v; end; $$;
