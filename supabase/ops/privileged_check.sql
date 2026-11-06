-- 권한이 있는 학번(관리자·교육활동부·소통홍보부·기획행정부)을 지금 누가 등록했는지 확인한다.
-- 이름이 본인과 다르면(남이 학번을 먼저 등록한 것) 앱의 '학생 관리'에서 학적 해제 후 본인이 다시 등록하게 한다.
with lists as (
  select key, unnest(string_to_array(value, ',')) as student_no
    from public.app_config where key in ('admins', 'study_managers', 'comm_members', 'planners')
)
select l.key as 부서, l.student_no as 학번, e.name as 등록한_이름, p.email as 계정, p.role as 역할,
       case when e.user_id is null then '아직 등록 안 함' else '' end as 상태
  from lists l
  left join public.enrollments e on e.student_no = l.student_no and e.school_year = public.current_school_year()
  left join public.profiles p on p.id = e.user_id
 order by l.key, l.student_no;
