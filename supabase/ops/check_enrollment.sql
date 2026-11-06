-- 학적 점검: 이름·학번으로 후보 계정 보기 (SQL 편집기에서 Run)
-- 아래 두 값만 바꿔 쓴다. 지금 값: 20714 임하진
with q as (select '20714'::text as no, '임하진'::text as nm)
select e.student_no as 학번, e.name as 이름, p.email as 이메일, p.role as 역할,
       to_char(e.created_at at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as 등록,
       case when e.student_no = q.no and e.name = q.nm then '정확히 일치'
            when e.student_no = q.no then '학번만 일치(이름 다름)'
            when e.name = q.nm then '이름만 일치(학번 다름)'
            else '비슷한 후보' end as 판정
  from public.enrollments e join public.profiles p on p.id = e.user_id, q
 where e.school_year = public.current_school_year()
   and (e.student_no = q.no or e.name = q.nm
        or e.name like '%' || right(q.nm, 2) || '%'
        or (left(e.name, 1) = left(q.nm, 1) and e.student_no like left(q.no, 3) || '%')
        or e.student_no like left(q.no, 3) || '%')
 order by (e.student_no = q.no or e.name = q.nm) desc, e.student_no;
