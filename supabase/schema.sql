-- アカヌケ: データベース全体の設計図(ゼロから作り直すとき用)
-- すでに動いているデータベースには実行せず、supabase/migrations の番号順に実行してください
-- 全テーブルに user_id(持ち主)があり、RLSで「自分の行だけ」操作できます

-- プロフィール(ユーザーごとに1行。新規登録時にトリガーで自動作成)
create table if not exists profile (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  target_weight_kg numeric(5,1),
  target_calories integer,
  target_protein_g numeric(5,1),
  face_illustration text default 'female' check (face_illustration in ('male', 'female')),
  use_workout boolean not null default false,
  use_beauty boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 食事記録
create table if not exists meal_records (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null,
  calories integer,
  protein_g numeric(5,1),
  photo_url text, -- 写真の保存先パス(meal-photosバケット内の「ユーザーID/ファイル名」)
  created_at timestamptz not null default now()
);

-- 体重の記録(履歴)
create table if not exists weight_records (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  weight_kg numeric(5,1) not null,
  created_at timestamptz not null default now()
);

-- 美容・垢抜け相談の履歴
create table if not exists beauty_consultations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categories text[] not null,
  concern text,
  answer text not null,
  created_at timestamptz not null default now()
);

-- 筋トレ記録
create table if not exists workout_records (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_name text not null,
  weight numeric(5,1),
  reps integer,
  sets integer,
  created_at timestamptz not null default now()
);

-- 「今日のToDo」のキャッシュ(ユーザーごとに1日1回だけAIに生成させる)
create table if not exists daily_todos (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  todo_date date not null,
  items jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, todo_date)
);

-- AIの利用回数(ユーザー・日付・機能ごと)。増やすのは consume_ai_quota 関数だけ(011参照)
create table if not exists ai_usage (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  usage_date date not null,
  kind       text not null,
  count      integer not null default 0,
  primary key (user_id, usage_date, kind)
);

create index if not exists meal_records_user_id_idx         on meal_records (user_id);
create index if not exists weight_records_user_id_idx       on weight_records (user_id);
create index if not exists workout_records_user_id_idx      on workout_records (user_id);
create index if not exists beauty_consultations_user_id_idx on beauty_consultations (user_id);

-- 新規登録した人のプロフィールを自動作成(use_workout / use_beauty は false)
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

-- RLS: 自分のuser_idの行だけ、読み・追加・更新・削除できる(未ログインは何も見えない)
alter table profile              enable row level security;
alter table meal_records         enable row level security;
alter table weight_records       enable row level security;
alter table beauty_consultations enable row level security;
alter table workout_records      enable row level security;
alter table daily_todos          enable row level security;

create policy "own rows on profile" on profile
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows on meal_records" on meal_records
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows on weight_records" on weight_records
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows on beauty_consultations" on beauty_consultations
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows on workout_records" on workout_records
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows on daily_todos" on daily_todos
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 食事写真の保存先: 非公開バケット + ユーザーIDのフォルダ
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

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

-- AI利用回数の制限(詳細は supabase/migrations/011_add_ai_usage_limits.sql)
alter table ai_usage enable row level security;

create policy "read own ai_usage" on ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.consume_ai_quota(p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Tokyo')::date;
  new_count integer;
begin
  if uid is null then
    return false;
  end if;

  insert into ai_usage as u (user_id, usage_date, kind, count)
  values (uid, today, p_kind, 1)
  on conflict (user_id, usage_date, kind)
  do update set count = u.count + 1
  where u.count < p_limit
  returning u.count into new_count;

  return new_count is not null;
end;
$$;

revoke all on function public.consume_ai_quota(text, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer) to authenticated;

-- アカウント削除(本人が自分のアカウントだけを消す。詳細は supabase/migrations/012_add_delete_my_account.sql)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
