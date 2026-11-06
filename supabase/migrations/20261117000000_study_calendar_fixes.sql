-- 11-06 호원 피드백 반영 (1)
--  · 스터디 윗미: 달력으로 지난 기록 보기
--  · 과목명 바로잡기: 사회문화탐구 → 사회문제탐구 (선택과목 설정·학생 선택 모두)

-- 한 달 기록: 날짜별 총 공부 시간(수업 중 포함)과 과목별 시간
create or replace function public.my_study_month(p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m0 date := date_trunc('month', coalesce(p_month, public.seoul_today()))::date;
  m1 date := (date_trunc('month', coalesce(p_month, public.seoul_today())) + interval '1 month - 1 day')::date;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return jsonb_build_object(
    'month', m0,
    'days', coalesce((select jsonb_object_agg(day, ranked_seconds + class_seconds) from public.study_daily
                       where user_id = me and day between m0 and m1 and ranked_seconds + class_seconds > 0), '{}'::jsonb),
    'by_subject', coalesce((select jsonb_object_agg(d, subj) from (
        select d, jsonb_object_agg(k, v) subj from (
          select (s.started_at at time zone 'Asia/Seoul')::date d, coalesce(s.subject, '') k, sum(s.ranked_seconds + s.class_seconds)::int v
            from public.study_sessions s
           where s.user_id = me and (s.started_at at time zone 'Asia/Seoul')::date between m0 and m1
           group by 1, 2 having sum(s.ranked_seconds + s.class_seconds) > 0) x group by d) y), '{}'::jsonb)
  );
end $$;
revoke all on function public.my_study_month(date) from public, anon;
grant execute on function public.my_study_month(date) to authenticated;

-- 과목명 바로잡기
update public.timetable_configs set groups = replace(groups::text, '사회문화탐구', '사회문제탐구')::jsonb where groups::text like '%사회문화탐구%';
update public.timetable_choices set choices = replace(choices::text, '사회문화탐구', '사회문제탐구')::jsonb where choices::text like '%사회문화탐구%';
