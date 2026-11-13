-- 11-08 학생 의견 #4·#12, 호원 결정: 닉네임은 처음 정한 뒤 한 번은 바로 바꿀 수 있고, 그 뒤로는 14일에 한 번(예전 30일)
alter table public.profiles add column if not exists nickname_changes int not null default 0;
-- 이미 닉네임이 있는 학생은 '처음 정함 1번'으로 친다 → 한 번은 바로 바꿀 수 있다
update public.profiles set nickname_changes = 1 where nickname is not null and nickname_changes = 0;

create or replace function public.set_nickname(p_nickname text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n text := btrim(coalesce(p_nickname, ''));
  cur public.profiles;
  next_ok timestamptz;
begin
  if not public.is_school_user() then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  select * into cur from public.profiles where id = me for update;
  if cur.nickname is not null and cur.nickname = n then return public.my_wallet(); end if;
  if n !~ '^[가-힣A-Za-z0-9_]{2,10}$' then
    raise exception '닉네임은 한글·영문·숫자·_ 로 2~10자예요' using errcode = 'P0001';
  end if;
  if public.has_banned_word(n) or public.has_reserved_word(n) then
    raise exception '사용할 수 없는 단어가 들어 있어요' using errcode = 'P0001';
  end if;
  if cur.nickname is not null and cur.nickname_changes >= 2 and cur.nickname_changed_at is not null
     and cur.nickname_changed_at > now() - interval '14 days' then
    next_ok := cur.nickname_changed_at + interval '14 days';
    raise exception '닉네임은 14일에 한 번 바꿀 수 있어요 (%부터 가능)',
      to_char(next_ok at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"') using errcode = 'P0001';
  end if;
  begin
    update public.profiles set nickname = n, nickname_changed_at = now(), nickname_changes = nickname_changes + 1 where id = me;
  exception when unique_violation then
    raise exception '이미 다른 학생이 쓰는 닉네임이에요' using errcode = 'P0001';
  end;
  return public.my_wallet();
end $$;

-- 화면용: 지금 바로 바꿀 수 있는지, 아니면 언제부터인지
create or replace function public.nickname_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'free', p.nickname is null or p.nickname_changes < 2,
    'until', case when p.nickname is not null and p.nickname_changes >= 2 and p.nickname_changed_at > now() - interval '14 days'
                  then p.nickname_changed_at + interval '14 days' end)
    from public.profiles p where p.id = auth.uid() and public.is_school_user()
$$;
revoke all on function public.nickname_status() from public, anon;
grant execute on function public.nickname_status() to authenticated;
