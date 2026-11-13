-- 11-08 호원 결정: 의견을 쓸 때 '앱 기능 / 게임(어느 게임)'을 고른다(게임이면 screen = 'game:<id>').
-- 개발자는 게임 의견만 보고 '확인 중'·답변할 수 있다. 앱 기능 의견은 관리자만.

create or replace view public.feedback_admin as
  select f.id, f.kind, f.body, f.screen, f.app_version, f.device, f.status, f.reply, f.created_at, f.updated_at,
         p.nickname, e.grade, e.class_no
    from public.feedback f
    join public.profiles p on p.id = f.user_id
    left join public.enrollments e on e.user_id = f.user_id and e.school_year = public.current_school_year()
   where public.is_admin() or (public.is_developer() and f.screen like 'game:%');
revoke all on public.feedback_admin from public, anon;
grant select on public.feedback_admin to authenticated;

create or replace function public.admin_update_feedback(p_id bigint, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare
  author uuid;
  admin boolean := public.is_admin();
begin
  if not (admin or public.is_developer()) then raise exception '관리자·개발자만 할 수 있어요' using errcode = '42501'; end if;
  if p_status not in ('new', 'seen', 'done', 'wontfix') then raise exception '잘못된 상태예요' using errcode = 'P0001'; end if;
  if not admin then
    if p_status not in ('new', 'seen') then raise exception '반영 완료·보류는 관리자만 할 수 있어요' using errcode = '42501'; end if;
    if not exists (select 1 from public.feedback where id = p_id and screen like 'game:%') then
      raise exception '개발자는 게임 의견만 처리할 수 있어요' using errcode = '42501';
    end if;
  end if;
  update public.feedback set status = p_status, reply = nullif(btrim(coalesce(p_reply, '')), ''), updated_at = now()
   where id = p_id returning user_id into author;
  if not found then raise exception '없는 의견이에요' using errcode = 'P0001'; end if;
  if p_status = 'done' then perform public.award_tokens(author, 10, 'feedback_done', p_id::text); end if;
end $$;
revoke all on function public.admin_update_feedback(bigint, text, text) from public, anon;
grant execute on function public.admin_update_feedback(bigint, text, text) to authenticated;
