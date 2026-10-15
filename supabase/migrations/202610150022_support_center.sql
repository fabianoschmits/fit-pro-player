do $$ begin
  create type public.support_ticket_status as enum ('unread','read','pending','answered','resolved','archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.support_ticket_priority as enum ('low','normal','high','urgent');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.support_author_kind as enum ('user','admin');
exception when duplicate_object then null; end $$;

create table if not exists public.support_categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  label text not null, description text, sort_order integer not null default 0,
  is_active boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_faq_articles (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.support_categories(id),
  question text not null check (char_length(btrim(question)) between 3 and 240),
  answer text not null check (char_length(btrim(answer)) between 3 and 10000),
  sort_order integer not null default 0, is_featured boolean not null default false,
  is_published boolean not null default false, created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), published_at timestamptz
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.support_categories(id),
  subject text not null check (char_length(btrim(subject)) between 3 and 160),
  status public.support_ticket_status not null default 'unread',
  priority public.support_ticket_priority not null default 'normal', assigned_admin_id uuid references auth.users(id),
  last_message_at timestamptz not null default now(), first_read_at timestamptz, first_response_at timestamptz,
  resolved_at timestamptz, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id), author_kind public.support_author_kind not null,
  body text not null check (char_length(btrim(body)) between 1 and 10000), read_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid references auth.users(id), event_type text not null, from_value jsonb, to_value jsonb, created_at timestamptz not null default now()
);

insert into public.support_categories (slug, label, description, sort_order) values
 ('question','Dúvida','Perguntas sobre o aplicativo',1), ('technical','Problema técnico','Erros ou falhas',2),
 ('criticism','Crítica','Algo que não funcionou bem',3), ('suggestion','Sugestão de melhoria','Ideias para melhorar',4),
 ('feature_request','Solicitação de recurso','Um novo recurso',5), ('account','Conta e acesso','Login e conta',6),
 ('training','Treino e exercícios','Treinos, exercícios e progresso',7), ('privacy','Privacidade e dados','Privacidade e dados pessoais',8),
 ('other','Outro','Outros assuntos',9)
on conflict (slug) do update set label = excluded.label, description = excluded.description, sort_order = excluded.sort_order;

create index if not exists support_tickets_status_updated_idx on public.support_tickets(status, updated_at desc);
create index if not exists support_tickets_user_updated_idx on public.support_tickets(user_id, updated_at desc);
create index if not exists support_tickets_category_status_idx on public.support_tickets(category_id, status);
create index if not exists support_messages_ticket_created_idx on public.support_messages(ticket_id, created_at);

alter table public.support_categories enable row level security;
alter table public.support_faq_articles enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_ticket_events enable row level security;

revoke all on table public.support_categories, public.support_faq_articles, public.support_tickets, public.support_messages, public.support_ticket_events from anon, authenticated;
grant select on table public.support_categories, public.support_faq_articles to authenticated;

drop policy if exists support_categories_read on public.support_categories;
create policy support_categories_read on public.support_categories for select to authenticated using (is_active);
drop policy if exists support_faq_read on public.support_faq_articles;
create policy support_faq_read on public.support_faq_articles for select to authenticated using (is_published);
drop policy if exists support_tickets_own_read on public.support_tickets;
create policy support_tickets_own_read on public.support_tickets for select to authenticated using (user_id = auth.uid());
drop policy if exists support_messages_own_read on public.support_messages;
create policy support_messages_own_read on public.support_messages for select to authenticated using (exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
drop policy if exists support_events_own_read on public.support_ticket_events;
create policy support_events_own_read on public.support_ticket_events for select to authenticated using (exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));

create or replace function public.support_create_ticket(p_category_slug text, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_category uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select id into v_category from public.support_categories where slug = lower(btrim(p_category_slug)) and is_active;
  if v_category is null then raise exception 'invalid support category' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_subject,''))) < 3 or char_length(btrim(coalesce(p_body,''))) < 1 then raise exception 'subject and message are required' using errcode = '22023'; end if;
  insert into public.support_tickets(user_id, category_id, subject) values (auth.uid(), v_category, btrim(p_subject)) returning id into v_id;
  insert into public.support_messages(ticket_id, author_id, author_kind, body) values (v_id, auth.uid(), 'user', btrim(p_body));
  insert into public.support_ticket_events(ticket_id, actor_id, event_type, to_value) values (v_id, auth.uid(), 'created', jsonb_build_object('status','unread'));
  return v_id;
end; $$;

create or replace function public.support_add_user_message(p_ticket_id uuid, p_body text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status public.support_ticket_status;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select status into v_status from public.support_tickets where id = p_ticket_id and user_id = auth.uid() for update;
  if not found then raise exception 'ticket not found' using errcode = 'P0002'; end if;
  if v_status = 'archived' then raise exception 'archived ticket cannot receive messages' using errcode = '55000'; end if;
  insert into public.support_messages(ticket_id, author_id, author_kind, body) values (p_ticket_id, auth.uid(), 'user', btrim(p_body));
  update public.support_tickets set status = 'pending', last_message_at = now(), updated_at = now(), resolved_at = null where id = p_ticket_id;
end; $$;

create or replace function public.support_list_my_tickets(p_status public.support_ticket_status default null, p_limit integer default 50, p_offset integer default 0)
returns table(ticket_id uuid, subject text, category_slug text, category_label text, status public.support_ticket_status, priority public.support_ticket_priority, last_message_at timestamptz, created_at timestamptz)
language sql security definer set search_path = public, pg_temp as $$
 select t.id, t.subject, c.slug, c.label, t.status, t.priority, t.last_message_at, t.created_at from public.support_tickets t join public.support_categories c on c.id=t.category_id where t.user_id=auth.uid() and (p_status is null or t.status=p_status) order by t.last_message_at desc limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(0,coalesce(p_offset,0)); $$;

create or replace function public.support_ticket_detail(p_ticket_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
  select jsonb_build_object('ticket', to_jsonb(t), 'category', jsonb_build_object('slug',c.slug,'label',c.label), 'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.support_messages m where m.ticket_id=t.id),'[]'::jsonb)) into v from public.support_tickets t join public.support_categories c on c.id=t.category_id where t.id=p_ticket_id and t.user_id=auth.uid();
  if v is null then raise exception 'ticket not found' using errcode='P0002'; end if; return v;
end; $$;

create or replace function public.ops_support_overview() returns table(unread_count bigint, pending_count bigint, answered_count bigint, resolved_count bigint, archived_count bigint)
language plpgsql security definer set search_path=public,pg_temp as $$ begin perform public.ops_require_admin(); return query select count(*) filter(where status='unread'),count(*) filter(where status='pending'),count(*) filter(where status='answered'),count(*) filter(where status='resolved'),count(*) filter(where status='archived') from public.support_tickets; end; $$;

create or replace function public.ops_support_list_tickets(p_query text default null, p_status public.support_ticket_status default null, p_category text default null, p_priority public.support_ticket_priority default null, p_assigned_admin_id uuid default null, p_from_date timestamptz default null, p_to_date timestamptz default null, p_limit integer default 50, p_offset integer default 0)
returns table(ticket_id uuid,user_id uuid,email text,display_name text,subject text,category_slug text,category_label text,status public.support_ticket_status,priority public.support_ticket_priority,assigned_admin_id uuid,last_message_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path=public,auth,pg_temp as $$ begin perform public.ops_require_admin(); return query select t.id,t.user_id,coalesce(u.email::text,''),coalesce(p.display_name,''),t.subject,c.slug,c.label,t.status,t.priority,t.assigned_admin_id,t.last_message_at,t.created_at from public.support_tickets t join public.support_categories c on c.id=t.category_id join auth.users u on u.id=t.user_id left join public.profiles p on p.id=t.user_id where (p_query is null or lower(t.subject) like '%'||lower(p_query)||'%' or lower(coalesce(u.email::text,'')) like '%'||lower(p_query)||'%' or exists(select 1 from public.support_messages m where m.ticket_id=t.id and lower(m.body) like '%'||lower(p_query)||'%')) and (p_status is null or t.status=p_status) and (p_category is null or c.slug=p_category) and (p_priority is null or t.priority=p_priority) and (p_assigned_admin_id is null or t.assigned_admin_id=p_assigned_admin_id) and (p_from_date is null or t.created_at>=p_from_date) and (p_to_date is null or t.created_at<=p_to_date) order by t.last_message_at desc limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(0,coalesce(p_offset,0)); end; $$;

create or replace function public.ops_support_ticket_detail(p_ticket_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ declare v jsonb; begin perform public.ops_require_admin(); select jsonb_build_object('ticket',to_jsonb(t),'category',jsonb_build_object('slug',c.slug,'label',c.label),'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.support_messages m where m.ticket_id=t.id),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.support_ticket_events e where e.ticket_id=t.id),'[]'::jsonb)) into v from public.support_tickets t join public.support_categories c on c.id=t.category_id where t.id=p_ticket_id; if v is null then raise exception 'ticket not found' using errcode='P0002'; end if; return v; end; $$;

create or replace function public.ops_support_reply(p_ticket_id uuid,p_body text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin perform public.ops_require_admin(); if not exists(select 1 from public.support_tickets where id=p_ticket_id and status <> 'archived') then raise exception 'ticket unavailable' using errcode='55000'; end if; insert into public.support_messages(ticket_id,author_id,author_kind,body) values(p_ticket_id,auth.uid(),'admin',btrim(p_body)); update public.support_tickets set status='answered',first_response_at=coalesce(first_response_at,now()),last_message_at=now(),updated_at=now() where id=p_ticket_id; end; $$;

create or replace function public.ops_support_update_ticket(p_ticket_id uuid,p_status public.support_ticket_status default null,p_priority public.support_ticket_priority default null,p_assigned_admin_id uuid default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare v_old jsonb; v_new jsonb; begin perform public.ops_require_admin(); select to_jsonb(t) into v_old from public.support_tickets t where id=p_ticket_id for update; if v_old is null then raise exception 'ticket not found' using errcode='P0002'; end if; update public.support_tickets set status=coalesce(p_status,status),priority=coalesce(p_priority,priority),assigned_admin_id=p_assigned_admin_id,first_read_at=case when p_status in ('read','pending','answered','resolved') and first_read_at is null then now() else first_read_at end,resolved_at=case when p_status='resolved' then now() when p_status is not null and p_status <> 'resolved' then null else resolved_at end,archived_at=case when p_status='archived' then now() when p_status is not null and p_status <> 'archived' then null else archived_at end,updated_at=now() where id=p_ticket_id; select to_jsonb(t) into v_new from public.support_tickets t where id=p_ticket_id; insert into public.support_ticket_events(ticket_id,actor_id,event_type,from_value,to_value) values(p_ticket_id,auth.uid(),'updated',v_old,v_new); end; $$;

create or replace function public.ops_support_mark_read(p_ticket_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin perform public.ops_require_admin(); update public.support_tickets set status=case when status='unread' then 'read' else status end,first_read_at=coalesce(first_read_at,now()),updated_at=now() where id=p_ticket_id; end; $$;

create or replace function public.support_list_categories()
returns table(slug text, label text, description text, sort_order integer)
language sql security definer set search_path=public,pg_temp as $$ select slug,label,description,sort_order from public.support_categories where is_active order by sort_order, label; $$;

create or replace function public.support_list_faq(p_query text default null, p_category text default null)
returns table(article_id uuid, category_slug text, category_label text, question text, answer text, sort_order integer, is_featured boolean)
language sql security definer set search_path=public,pg_temp as $$ select a.id,c.slug,c.label,a.question,a.answer,a.sort_order,a.is_featured from public.support_faq_articles a join public.support_categories c on c.id=a.category_id where a.is_published and (p_query is null or lower(a.question||' '||a.answer) like '%'||lower(p_query)||'%') and (p_category is null or c.slug=p_category) order by a.is_featured desc,a.sort_order,a.question; $$;

create or replace function public.ops_support_list_faq()
returns table(article_id uuid, category_id uuid, category_slug text, category_label text, question text, answer text, sort_order integer, is_featured boolean, is_published boolean, updated_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$ begin perform public.ops_require_admin(); return query select a.id,a.category_id,c.slug,c.label,a.question,a.answer,a.sort_order,a.is_featured,a.is_published,a.updated_at from public.support_faq_articles a join public.support_categories c on c.id=a.category_id order by a.sort_order,a.question; end; $$;

create or replace function public.ops_support_save_faq(p_article_id uuid,p_category_slug text,p_question text,p_answer text,p_sort_order integer default 0,p_is_featured boolean default false,p_is_published boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ declare v_id uuid; v_category uuid; begin perform public.ops_require_admin(); select id into v_category from public.support_categories where slug=p_category_slug and is_active; if v_category is null then raise exception 'invalid support category' using errcode='22023'; end if; if p_article_id is null then insert into public.support_faq_articles(category_id,question,answer,sort_order,is_featured,is_published,created_by,updated_by,published_at) values(v_category,btrim(p_question),btrim(p_answer),coalesce(p_sort_order,0),coalesce(p_is_featured,false),coalesce(p_is_published,false),auth.uid(),auth.uid(),case when p_is_published then now() end) returning id into v_id; else update public.support_faq_articles set category_id=v_category,question=btrim(p_question),answer=btrim(p_answer),sort_order=coalesce(p_sort_order,0),is_featured=coalesce(p_is_featured,false),is_published=coalesce(p_is_published,false),updated_by=auth.uid(),updated_at=now(),published_at=case when p_is_published then coalesce(published_at,now()) else null end where id=p_article_id returning id into v_id; end if; return v_id; end; $$;

create or replace function public.ops_support_delete_faq(p_article_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin perform public.ops_require_admin(); delete from public.support_faq_articles where id=p_article_id; end; $$;

revoke all on function public.support_create_ticket(text,text,text),public.support_add_user_message(uuid,text),public.support_list_my_tickets(public.support_ticket_status,integer,integer),public.support_ticket_detail(uuid) from public,anon,authenticated;
revoke all on function public.support_list_categories(),public.support_list_faq(text,text) from public,anon,authenticated;
grant execute on function public.support_create_ticket(text,text,text),public.support_add_user_message(uuid,text),public.support_list_my_tickets(public.support_ticket_status,integer,integer),public.support_ticket_detail(uuid),public.support_list_categories(),public.support_list_faq(text,text) to authenticated;
revoke all on function public.ops_support_overview(),public.ops_support_list_tickets(text,public.support_ticket_status,text,public.support_ticket_priority,uuid,timestamptz,timestamptz,integer,integer),public.ops_support_ticket_detail(uuid),public.ops_support_reply(uuid,text),public.ops_support_update_ticket(uuid,public.support_ticket_status,public.support_ticket_priority,uuid),public.ops_support_mark_read(uuid) from public,anon,authenticated;
revoke all on function public.ops_support_list_faq(),public.ops_support_save_faq(uuid,text,text,text,integer,boolean,boolean),public.ops_support_delete_faq(uuid) from public,anon,authenticated;
grant execute on function public.ops_support_overview(),public.ops_support_list_tickets(text,public.support_ticket_status,text,public.support_ticket_priority,uuid,timestamptz,timestamptz,integer,integer),public.ops_support_ticket_detail(uuid),public.ops_support_reply(uuid,text),public.ops_support_update_ticket(uuid,public.support_ticket_status,public.support_ticket_priority,uuid),public.ops_support_mark_read(uuid),public.ops_support_list_faq(),public.ops_support_save_faq(uuid,text,text,text,integer,boolean,boolean),public.ops_support_delete_faq(uuid) to authenticated;
