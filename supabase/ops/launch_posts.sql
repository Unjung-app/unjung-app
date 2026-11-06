-- 출시 예시 게시물(11/8 출시 직전 1번 실행). 모두 실제 내용이며 작성자는 학생자치회장(20818) 계정.
-- 먼저 20818 학번으로 앱에 가입·학번 등록이 되어 있어야 한다. 두 번 실행해도 같은 글이 중복되지 않는다.
do $$
declare
  u uuid := (select user_id from public.enrollments where student_no = '20818' and school_year = public.current_school_year());
  sid bigint;
begin
  if u is null then raise exception '먼저 20818 학번으로 앱에 가입하고 학번을 등록해 주세요'; end if;

  -- 학생 공지 3개(바로 게시, 2주)
  if not exists (select 1 from public.notices where author = u and title = '운중고 스마트 스쿨 출시!') then
    insert into public.notices (author, author_grade, kind, title, body, scope, show_from, show_until, status, reviewer, reviewed_at) values
    (u, 2, 'council', '운중고 스마트 스쿨 출시!',
     E'운중고 학생들이 직접 만든 우리 학교 앱이 나왔어요.\n\n· 우리 반 시간표와 지금 몇 교시인지\n· 오늘 급식과 한줄평\n· 스터디 윗미(공부 시간 재기·그룹 순위)\n· 운중고 학생이 만든 게임 3종\n· 학생 공지, 분실물, 행사 사진, 학생회 설문·건의\n\n🎉 11/22까지 출시 기념 토큰 2배 + 웰컴 토큰 50개! 홈 화면의 배너에서 받아 가세요.\n불편한 점은 전체 → 의견 보내기로 알려 주세요.',
     'all', date '2026-11-08', date '2026-11-21', 'approved', u, now()),
    (u, 2, 'event', '스터디 윗미 행사 참여 안내 (교육활동부)',
     E'11/9(월)~11/25(수) 공부 시간을 재는 교육활동부 행사예요.\n\n1. 아래 가운데 [스터디] 탭\n2. 우리 학년 그룹에 비밀번호 2026 입력 → 참여\n3. 과목을 추가하고 ▶ 로 시작\n\n참여한 모두에게 참여 선물, 꾸준히 참여한 학생에게 상품이 있어요. 그룹 안에서는 닉네임으로만 보여요.',
     'all', date '2026-11-08', date '2026-11-21', 'approved', u, now()),
    (u, 2, 'council', '학생회 건의함이 앱으로 들어왔어요',
     E'전체 → 운중 보이스에서 학교에 바라는 점을 익명으로 건의할 수 있어요(학년만 표시).\n공감이 많은 건의는 기획행정부가 확인하고 학교에 전달해요.\n기획행정부가 올리는 설문·안건 투표에 참여하면 토큰도 받아요.',
     'all', date '2026-11-08', date '2026-11-21', 'approved', u, now());
  end if;

  -- 출시 첫인상 설문(학생회, 11/8 22:00 ~ 11/22, 투표한 학생에게 결과 공개)
  if not exists (select 1 from public.surveys where title = '운중고 스마트 스쿨 첫인상 설문') then
    insert into public.surveys (author, title, description, results, opens_at, closes_at)
    values (u, '운중고 스마트 스쿨 첫인상 설문', '앱을 더 좋게 만드는 데 쓸게요. 1분이면 끝나요!', 'after_vote',
            timestamptz '2026-11-08 22:00+09', timestamptz '2026-11-22 23:59+09')
    returning id into sid;
    insert into public.survey_questions (survey_id, ord, kind, prompt, options, required) values
    (sid, 1, 'single', '앱 첫인상은 어떤가요?', array['최고예요', '좋아요', '보통이에요', '아쉬워요'], true),
    (sid, 2, 'multi', '가장 자주 쓸 것 같은 기능을 모두 골라 주세요', array['시간표', '급식·한줄평', '스터디 윗미', '게임', '학생 공지', '행사 사진', '운중 보이스(설문·건의)'], true),
    (sid, 3, 'text', '앱에 생겼으면 하는 기능이나 바라는 점', '{}', false);
  end if;
end $$;
