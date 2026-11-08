create table public.lost_post_days (
  author uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  primary key (author, day)
);
alter table public.lost_post_days enable row level security;
revoke all on public.lost_post_days from public, anon, authenticated;

insert into public.lost_post_days(author, day)
select distinct author, (created_at at time zone 'Asia/Seoul')::date from public.lost_items;

create function public.reserve_lost_post_day()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.lost_post_days(author, day)
  values (new.author, (new.created_at at time zone 'Asia/Seoul')::date)
  on conflict do nothing;
  if not found then raise exception '분실물 게시물은 하루에 한 번만 올릴 수 있어요'; end if;
  return new;
end $$;
revoke all on function public.reserve_lost_post_day() from public, anon, authenticated;
create trigger lost_post_daily_limit before insert on public.lost_items
for each row execute function public.reserve_lost_post_day();

create function public.can_post_lost_today()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_school_user() and not exists (
    select 1 from public.lost_post_days where author = auth.uid() and day = public.seoul_today()
  )
$$;

create table public.lost_comments (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.lost_items(id) on delete cascade,
  author uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index lost_comments_item_order on public.lost_comments(item_id, id desc);
alter table public.lost_comments enable row level security;
revoke all on public.lost_comments from public, anon, authenticated;

create function public.post_lost_comment(p_item_id bigint, p_body text, p_confirmed boolean)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  body_text text := btrim(coalesce(p_body, ''));
  comment_id bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요'; end if;
  if p_confirmed is distinct from true then raise exception '댓글 작성 안내를 확인해 주세요'; end if;
  if char_length(body_text) not between 1 and 300 then raise exception '댓글을 1~300자로 적어 주세요'; end if;
  if public.has_banned_word(body_text) then raise exception '부적절한 표현이 들어 있어요'; end if;
  perform 1 from public.lost_items where id = p_item_id and status <> 'closed'
    and created_at > now() - interval '30 days' for share;
  if not found then raise exception '댓글을 쓸 수 없는 게시물이에요'; end if;
  insert into public.lost_comments(item_id, author, body)
  values (p_item_id, auth.uid(), body_text) returning id into comment_id;
  return comment_id;
end $$;

create function public.read_lost_comments(p_item_id bigint, p_admin boolean)
returns table(id bigint, body text, created_at timestamptz, nickname text, mine boolean, name text, student_no text)
language sql stable security definer set search_path = public as $$
  select c.id, c.body, c.created_at, p.nickname, c.author = auth.uid(), e.name, e.student_no
  from public.lost_comments c
  join public.lost_feed f on f.id = c.item_id
  join public.profiles p on p.id = c.author
  left join public.enrollments e on p_admin and public.is_admin()
    and e.user_id = c.author and e.school_year = public.current_school_year()
  where c.item_id = p_item_id
  order by c.id desc limit 100
$$;

create function public.admin_lost_authors(p_ids bigint[])
returns table(item_id bigint, name text, student_no text)
language sql stable security definer set search_path = public as $$
  select x.id, e.name, e.student_no
  from public.lost_feed f
  join public.lost_items x on x.id = f.id
  left join public.enrollments e on e.user_id = x.author and e.school_year = public.current_school_year()
  where public.is_admin() and x.id = any(p_ids)
  limit 100
$$;

revoke all on function public.can_post_lost_today(), public.post_lost_comment(bigint,text,boolean),
  public.read_lost_comments(bigint,boolean), public.admin_lost_authors(bigint[]) from public, anon;
grant execute on function public.can_post_lost_today(), public.post_lost_comment(bigint,text,boolean),
  public.read_lost_comments(bigint,boolean), public.admin_lost_authors(bigint[]) to authenticated;
