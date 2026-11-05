-- 2026학년도 2학기 2학년 선택 과목. 이후 학기는 별도 구성 행으로 등록한다.
create table public.timetable_configs (
 school_year int not null, semester int not null check (semester in (1,2)),
 grade int not null check (grade between 1 and 3), groups jsonb not null,
 primary key (school_year, semester, grade)
);
alter table public.timetable_configs enable row level security;
grant select on public.timetable_configs to authenticated;
create policy timetable_config_read on public.timetable_configs for select to authenticated using (public.is_school_user());
insert into public.timetable_configs values (2026, 2, 2, $config$[{"id": "A", "label": "A타임", "subjects": ["인공지능기초", "사회문화탐구", "여행지리", "세계사", "경제", "현대사회와 윤리", "화학반응의 세계", "생명과학"], "slots": {"1": [[1, 2], [3, 2], [4, 1]], "2": [[1, 2], [3, 2], [4, 1]], "3": [[1, 2], [3, 2], [4, 1]], "4": [[1, 2], [3, 2], [4, 1]], "5": [[1, 2], [3, 2], [4, 1]], "6": [[1, 2], [3, 2], [4, 1]], "7": [[1, 2], [3, 2], [4, 1]], "8": [[1, 2], [3, 2], [4, 1]]}}, {"id": "B", "label": "B타임", "subjects": ["화학반응의 세계", "지구시스템 과학", "역학과 에너지", "현대사회와 윤리", "세계사", "여행지리", "생명과학"], "slots": {"1": [[1, 5], [4, 7], [5, 5]], "2": [[1, 5], [4, 7], [5, 5]], "3": [[1, 5], [4, 7], [5, 5]], "4": [[1, 5], [4, 7], [5, 5]], "5": [[1, 5], [4, 7], [5, 5]], "6": [[1, 5], [4, 7], [5, 5]], "7": [[1, 5], [4, 7], [5, 5]], "8": [[1, 5], [4, 7], [5, 5]]}}, {"id": "C", "label": "C타임", "subjects": ["심화영어 독해와 작문", "인공지능수학", "사회문화탐구", "경제", "세계사", "생명과학", "현대사회와 윤리", "역학과 에너지"], "slots": {"1": [[2, 5], [3, 4], [5, 6]], "2": [[2, 5], [3, 4], [5, 6]], "3": [[2, 5], [3, 4], [5, 6]], "4": [[2, 5], [3, 4], [5, 6]], "5": [[2, 5], [3, 4], [5, 6]], "6": [[2, 5], [3, 4], [5, 6]], "7": [[2, 5], [3, 4], [5, 6]], "8": [[2, 5], [3, 4], [5, 6]]}}, {"id": "D", "label": "D타임", "subjects": ["현대사회와 윤리", "독서토론과 글쓰기", "화학반응의 세계", "여행지리", "사회문화탐구", "경제", "지구시스템과학", "인공지능수학"], "slots": {"1": [[2, 2], [4, 4], [5, 3]], "2": [[2, 2], [4, 4], [5, 3]], "3": [[2, 2], [4, 4], [5, 3]], "4": [[2, 2], [4, 4], [5, 3]], "5": [[2, 2], [4, 4], [5, 3]], "6": [[2, 2], [4, 4], [5, 3]], "7": [[2, 2], [4, 4], [5, 3]], "8": [[2, 2], [4, 4], [5, 3]]}}, {"id": "general", "label": "교양", "subjects": ["일본어 회화", "중국어 회화", "로봇과 공학세계"], "slots": {"1": [[1, 4], [2, 4], [4, 3]], "2": [[1, 3], [3, 3], [5, 1]], "3": [[2, 1], [3, 1], [4, 2]], "4": [[2, 1], [3, 1], [4, 2]], "5": [[2, 1], [3, 1], [4, 2]], "6": [[1, 1], [2, 3], [5, 4]], "7": [[1, 1], [2, 3], [5, 4]], "8": [[1, 6], [4, 6], [5, 2]]}}, {"id": "art", "label": "예술", "subjects": ["음악", "미술"], "slots": {"1": [[1, 6], [3, 1]], "2": [[1, 6], [3, 1]], "3": [[1, 1], [2, 7]], "4": [[1, 1], [2, 7]], "5": [[2, 4], [5, 2]], "6": [[2, 4], [5, 2]], "7": [[1, 7], [2, 6]], "8": [[1, 7], [2, 6]]}}]$config$::jsonb);

create table public.timetable_choices (
 user_id uuid not null references auth.users(id) on delete cascade,
 school_year int not null, semester int not null, grade int not null,
 choices jsonb not null,
 primary key (user_id, school_year, semester),
 foreign key (school_year, semester, grade) references public.timetable_configs
);
alter table public.timetable_choices enable row level security;
grant select on public.timetable_choices to authenticated;
create policy timetable_choice_read on public.timetable_choices for select to authenticated
 using (user_id = auth.uid() and public.is_school_user());

create function public.save_timetable_choices(p_year int, p_semester int, p_choices jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare g int; config jsonb; entry jsonb;
begin
 if auth.uid() is null or not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요'; end if;
 select grade into g from public.enrollments where user_id = auth.uid() and school_year = p_year;
 if g is distinct from 2 then raise exception '2학년 학적이 필요해요'; end if;
 select groups into config from public.timetable_configs where school_year=p_year and semester=p_semester and grade=g;
 if config is null then raise exception '이 학기의 과목 정보가 아직 없어요'; end if;
 if jsonb_typeof(p_choices) is distinct from 'object' then raise exception '과목을 모두 선택해 주세요'; end if;
 if (select count(*) from jsonb_object_keys(p_choices)) <> jsonb_array_length(config) then raise exception '과목을 모두 선택해 주세요'; end if;
 for entry in select value from jsonb_array_elements(config) loop
  if not exists (select 1 from jsonb_array_elements_text(entry->'subjects') s where s = p_choices->>(entry->>'id')) then
   raise exception '목록에서 과목을 선택해 주세요';
  end if;
 end loop;
 insert into public.timetable_choices values (auth.uid(),p_year,p_semester,g,p_choices)
 on conflict (user_id,school_year,semester) do update set grade=excluded.grade, choices=excluded.choices;
end $$;
revoke all on function public.save_timetable_choices(int,int,jsonb) from public, anon;
grant execute on function public.save_timetable_choices(int,int,jsonb) to authenticated;
