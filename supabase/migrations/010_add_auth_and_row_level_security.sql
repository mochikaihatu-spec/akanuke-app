-- ログイン機能(Supabase Auth)とユーザーごとのデータ分離
-- 何度実行してもエラーにならないように書いてあります

-- ============================================================
-- 1) 各テーブルに「持ち主」を表す user_id を追加
--    (すでにあるデータの user_id は、この時点では空欄のままにします。
--     後で「データの引き継ぎ」SQLで自分のアカウントに紐づけます)
-- ============================================================
alter table profile              add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table meal_records         add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table weight_records       add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table workout_records      add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table beauty_consultations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table daily_todos          add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 今後データを追加するとき、ログイン中のユーザーのIDが自動で入るようにする
alter table profile              alter column user_id set default auth.uid();
alter table meal_records         alter column user_id set default auth.uid();
alter table weight_records       alter column user_id set default auth.uid();
alter table workout_records      alter column user_id set default auth.uid();
alter table beauty_consultations alter column user_id set default auth.uid();
alter table daily_todos          alter column user_id set default auth.uid();

-- 検索を速くするための索引
create index if not exists meal_records_user_id_idx         on meal_records (user_id);
create index if not exists weight_records_user_id_idx       on weight_records (user_id);
create index if not exists workout_records_user_id_idx      on workout_records (user_id);
create index if not exists beauty_consultations_user_id_idx on beauty_consultations (user_id);

-- ============================================================
-- 2) profile を「ユーザーごとに1行」にする
--    (今までは id=1 の1行だけを全員で使い回す作りだった)
-- ============================================================
alter table profile drop constraint if exists profile_single_row;
alter table profile drop column if exists id;  -- 主キーも一緒に消えます
create unique index if not exists profile_user_id_key on profile (user_id);

-- ============================================================
-- 3) daily_todos(今日のToDoのキャッシュ)も「ユーザー+日付」で1行にする
-- ============================================================
alter table daily_todos drop constraint if exists daily_todos_pkey;
alter table daily_todos alter column todo_date set not null;
create unique index if not exists daily_todos_user_date_key on daily_todos (user_id, todo_date);

-- ============================================================
-- 4) 新規登録した人のプロフィールを自動で作る
--    use_workout / use_beauty は false(オフ)で始まります
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (user_id, use_workout, use_beauty)
  values (new.id, false, false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- すでに登録済みのユーザーがいれば、プロフィールを用意しておく
insert into profile (user_id, use_workout, use_beauty)
select id, false, false from auth.users
on conflict (user_id) do nothing;

-- ============================================================
-- 5) RLS(行レベルセキュリティ)
--    「自分のuser_idの行だけ、読み・追加・更新・削除できる」
--    ログインしていない人(anon)は何も見えません
-- ============================================================
alter table profile              enable row level security;
alter table meal_records         enable row level security;
alter table weight_records       enable row level security;
alter table workout_records      enable row level security;
alter table beauty_consultations enable row level security;
alter table daily_todos          enable row level security;

-- 今までの「誰でも全部OK」ルールを削除
drop policy if exists "allow all on profile"              on profile;
drop policy if exists "allow all on meal_records"         on meal_records;
drop policy if exists "allow all on weight_records"       on weight_records;
drop policy if exists "allow all on workout_records"      on workout_records;
drop policy if exists "allow all on beauty_consultations" on beauty_consultations;
drop policy if exists "allow all on daily_todos"          on daily_todos;

-- 新しいルール(自分の行だけ)
drop policy if exists "own rows on profile" on profile;
create policy "own rows on profile" on profile
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own rows on meal_records" on meal_records;
create policy "own rows on meal_records" on meal_records
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own rows on weight_records" on weight_records;
create policy "own rows on weight_records" on weight_records
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own rows on workout_records" on workout_records;
create policy "own rows on workout_records" on workout_records
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own rows on beauty_consultations" on beauty_consultations;
create policy "own rows on beauty_consultations" on beauty_consultations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own rows on daily_todos" on daily_todos;
create policy "own rows on daily_todos" on daily_todos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============================================================
-- 6) 食事写真のStorage:非公開 + ユーザーごとのフォルダ
--    写真は「ユーザーID/ファイル名」で保存し、自分のフォルダだけ操作できる
-- ============================================================
update storage.buckets set public = false where id = 'meal-photos';

drop policy if exists "allow all on meal-photos objects" on storage.objects;
drop policy if exists "own folder on meal-photos" on storage.objects;
create policy "own folder on meal-photos" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

comment on column meal_records.photo_url is
  '食事写真の保存先パス(meal-photosバケット内の「ユーザーID/ファイル名」)。以前はURLを入れていた';
