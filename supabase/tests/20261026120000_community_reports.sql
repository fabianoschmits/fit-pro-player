begin;

do $$
declare reporter uuid := gen_random_uuid(); author uuid := gen_random_uuid(); admin uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  post_id uuid; parent_comment_id uuid; reply_id uuid; ticket_id uuid; duplicate_ticket_id uuid; detail jsonb;
begin
  insert into auth.users(id) values (reporter), (author), (admin), (outsider);
  insert into public.user_roles(user_id, role) values (admin, 'admin');
  insert into public.community_posts(author_id, image_path, caption) values (author, author || '/report.jpg', 'Conteúdo para revisão') returning id into post_id;
  insert into public.community_comments(post_id, author_id, body) values (post_id, author, 'Comentário para revisão') returning id into parent_comment_id;
  insert into public.community_comments(post_id, author_id, body, parent_comment_id) values (post_id, author, 'Resposta para revisão', parent_comment_id) returning id into reply_id;

  perform set_config('request.jwt.claim.sub', reporter::text, true);
  set local role authenticated;
  ticket_id := public.community_report_content('post', post_id, null, 'spam', null);
  duplicate_ticket_id := public.community_report_content('post', post_id, null, 'spam', null);
  if ticket_id <> duplicate_ticket_id then raise exception 'Duplicate report created another ticket'; end if;
  if not exists (select 1 from public.support_tickets t join public.support_categories c on c.id=t.category_id where t.id=ticket_id and t.user_id=reporter and c.slug='community_report') then raise exception 'Report ticket was not created'; end if;

  ticket_id := public.community_report_content('comment', post_id, reply_id, 'other', 'Contexto adicional necessário');
  begin
    perform public.community_report_content('comment', post_id, reply_id, 'other', null);
    raise exception 'Other reason allowed without description';
  exception when raise_exception then if sqlerrm <> 'Explique o motivo da denúncia' then raise; end if; end;
  begin
    perform public.community_report_content('comment', gen_random_uuid(), reply_id, 'spam', null);
    raise exception 'Mismatched post accepted';
  exception when raise_exception then if sqlerrm <> 'Conteúdo indisponível' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', author::text, true);
  begin
    perform public.community_report_content('post', post_id, null, 'spam', null);
    raise exception 'Self report allowed';
  exception when raise_exception then if sqlerrm <> 'Você não pode denunciar seu próprio conteúdo' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', outsider::text, true);
  begin
    perform public.ops_support_ticket_detail(ticket_id);
    raise exception 'Non-admin report context leaked';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  detail := public.ops_support_ticket_detail(ticket_id);
  if detail->'report_context'->>'target_kind' <> 'comment' then raise exception 'Report target kind missing'; end if;
  if detail->'report_context'->>'post_id' <> post_id::text then raise exception 'Report post id missing'; end if;
  if detail->'report_context'->>'comment_id' <> reply_id::text then raise exception 'Report comment id missing'; end if;
  if detail->'report_context'->>'verification_link' <> '/community?post=' || post_id::text then raise exception 'Canonical verification link missing'; end if;
  if detail->'report_context'->>'content_excerpt' <> 'Resposta para revisão' then raise exception 'Immutable excerpt missing'; end if;
  reset role;
end $$;

select 'PASS: community report validation, deduplication and admin review context' as result;
rollback;
