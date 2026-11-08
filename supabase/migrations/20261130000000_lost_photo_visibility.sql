-- 사진 공개 조건은 게시물 목록과 동일하게 판단한다.
-- lost_items는 본인 글만 조회할 수 있어 다른 학생의 승인 사진을 찾지 못한다.
do $$
begin
  if to_regclass('storage.objects') is not null then
    alter policy lost_photos_select on storage.objects to authenticated
      using (
        bucket_id = 'lost-photos' and public.is_school_user() and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.is_reviewer()
          or exists (select 1 from public.lost_feed f where f.photo_path = storage.objects.name)
        )
      );
  end if;
end $$;
