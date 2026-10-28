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

-- 「憧れ → 行動プラン」(詳細は supabase/migrations/013_add_ideal_profiles_and_plans.sql)
-- ヒアリングの答え(ユーザーごとに1行)
create table if not exists ideal_profiles (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ideal_text     text not null check (char_length(ideal_text) between 1 and 100),
  focus_areas    text[] not null default '{}',
  concerns       text check (char_length(concerns) <= 500),
  monthly_budget text check (monthly_budget in ('3000', '5000', '10000', '20000', 'none')),
  daily_minutes  integer check (daily_minutes in (5, 15, 30, 60)),
  preferences    text check (char_length(preferences) <= 500),
  updated_at     timestamptz not null default now()
);

-- AIが作ったプラン(作り直すと前のプランは 'archived' になって履歴に残る)
create table if not exists plans (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status         text not null default 'active' check (status in ('active', 'archived')),
  ideal_snapshot jsonb not null,   -- プランを作った時点のヒアリングの答えのコピー
  content        jsonb not null,   -- AIが作ったプラン本体(サーバーで形を検査してから保存)
  created_at     timestamptz not null default now()
);

-- 「使用中のプラン」は1人につき1つだけ
create unique index if not exists plans_one_active_per_user
  on plans (user_id) where status = 'active';
create index if not exists plans_user_created_idx
  on plans (user_id, created_at desc);

alter table ideal_profiles enable row level security;
alter table plans          enable row level security;

drop policy if exists "own rows on ideal_profiles" on ideal_profiles;
create policy "own rows on ideal_profiles" on ideal_profiles
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- プランは「読む・追加する・使用中→履歴に変える(更新)」だけ。直接の削除はできない
drop policy if exists "read own plans" on plans;
create policy "read own plans" on plans
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "insert own plans" on plans;
create policy "insert own plans" on plans
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "update own plans" on plans;
create policy "update own plans" on plans
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 新しいプランを保存する:前の使用中プランを履歴にして、新しいものを追加(1回の命令でまとめて行う)
-- security invoker(既定)なので、RLSがそのまま効く = 自分の行しか触れない
create or replace function public.save_new_plan(p_ideal_snapshot jsonb, p_content jsonb)
returns bigint
language plpgsql
as $$
declare
  new_id bigint;
begin
  update plans set status = 'archived'
   where user_id = (select auth.uid()) and status = 'active';

  insert into plans (status, ideal_snapshot, content)
  values ('active', p_ideal_snapshot, p_content)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.save_new_plan(jsonb, jsonb) from public, anon;
grant execute on function public.save_new_plan(jsonb, jsonb) to authenticated;

-- 無料/有料の区分・月間の利用回数管理(詳細は supabase/migrations/014_add_tiers_and_monthly_ai_limits.sql)
create table if not exists subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  plan               text not null default 'paid' check (plan in ('paid')),
  status             text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  current_period_end timestamptz,
  updated_at         timestamptz not null default now()
);

alter table subscriptions enable row level security;

drop policy if exists "read own subscription" on subscriptions;
create policy "read own subscription" on subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));
-- insert / update / delete のポリシーは作らない = ユーザー自身は変更できない

-- ============================================================
-- 2) AI利用の記録(いつ・どの機能を・何トークン使ったか)。本人は読むだけ
-- ============================================================
create table if not exists ai_usage_logs (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null,
  success       boolean not null,
  model         text,
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_created_idx on ai_usage_logs (user_id, created_at desc);

alter table ai_usage_logs enable row level security;

drop policy if exists "read own ai_usage_logs" on ai_usage_logs;
create policy "read own ai_usage_logs" on ai_usage_logs
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================
-- 3) 同時実行を防ぐ鍵(ユーザー × 機能ごとに1つ)。誰も直接は読み書きできない
-- ============================================================
create table if not exists ai_locks (
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null,
  token        uuid not null,
  locked_until timestamptz not null,
  primary key (user_id, kind)
);

alter table ai_locks enable row level security;
-- ポリシーなし = 直接のアクセスは全面禁止(下の関数だけが触れる)

-- ============================================================
-- 4) AIを呼ぶ前:鍵を取る → 今の期間の回数を確認(失敗しても回数は減らない)
--    p_period: 'month'(日本時間の月初でリセット) / 'day'(日本時間の0時でリセット)
--    戻り値(jsonb): status = ok / limit / busy / unauthenticated / invalid
-- ============================================================
create or replace function public.begin_ai_request(
  p_kind text,
  p_limit integer,
  p_period text,
  p_lock_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid          uuid := auth.uid();
  jst          timestamp := now() at time zone 'Asia/Tokyo';
  period_start date;
  next_reset   date;
  got_token    uuid;
  used         integer;
begin
  if uid is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if p_kind is null or char_length(p_kind) not between 1 and 40
     or p_period not in ('day', 'month')
     or p_limit is null or p_limit < 0 or p_limit > 100000
     or p_lock_seconds not between 5 and 600 then
    return jsonb_build_object('status', 'invalid');
  end if;

  if p_period = 'month' then
    period_start := date_trunc('month', jst)::date;
    next_reset   := (date_trunc('month', jst) + interval '1 month')::date;
  else
    period_start := jst::date;
    next_reset   := jst::date + 1;
  end if;

  -- 先に鍵を取る(同じ人の同じ機能が同時に走らないので、回数を超えて通る隙間がなくなる)
  insert into ai_locks as l (user_id, kind, token, locked_until)
  values (uid, p_kind, gen_random_uuid(), now() + make_interval(secs => p_lock_seconds))
  on conflict (user_id, kind)
  do update set token = excluded.token, locked_until = excluded.locked_until
  where l.locked_until < now()
  returning l.token into got_token;

  if got_token is null then
    return jsonb_build_object('status', 'busy');
  end if;

  select u.count into used
    from ai_usage u
   where u.user_id = uid and u.usage_date = period_start and u.kind = p_kind;
  used := coalesce(used, 0);

  if used >= p_limit then
    -- 上限に達している:取った鍵はすぐ返す
    delete from ai_locks where user_id = uid and kind = p_kind and token = got_token;
    return jsonb_build_object(
      'status', 'limit', 'used', used, 'limit', p_limit,
      'period', p_period, 'period_start', period_start, 'next_reset', next_reset
    );
  end if;

  return jsonb_build_object(
    'status', 'ok', 'token', got_token, 'used', used, 'limit', p_limit,
    'period', p_period, 'period_start', period_start, 'next_reset', next_reset
  );
end;
$$;

-- ============================================================
-- 5) AIを呼んだ後:成功したときだけ回数を1つ増やす。記録は成功・失敗どちらも残す。鍵は返す
--    鍵(token)はAPIサーバーだけが持っているので、外からは他人の鍵を返せない。
--    鍵が合わなくても(期限切れなど)、成功なら回数は数える = 数え漏れが起きない側に倒す
-- ============================================================
create or replace function public.finish_ai_request(
  p_kind text,
  p_token uuid,
  p_period text,
  p_success boolean,
  p_model text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid          uuid := auth.uid();
  jst          timestamp := now() at time zone 'Asia/Tokyo';
  period_start date;
begin
  if uid is null then
    return;
  end if;

  if p_kind is null or char_length(p_kind) not between 1 and 40 or p_period not in ('day', 'month') then
    return;
  end if;

  period_start := case when p_period = 'month' then date_trunc('month', jst)::date else jst::date end;

  if p_success then
    insert into ai_usage as u (user_id, usage_date, kind, count)
    values (uid, period_start, p_kind, 1)
    on conflict (user_id, usage_date, kind)
    do update set count = u.count + 1;
  end if;

  insert into ai_usage_logs (user_id, kind, success, model, input_tokens, output_tokens)
  values (
    uid, p_kind, coalesce(p_success, false), left(p_model, 80),
    greatest(p_input_tokens, 0), greatest(p_output_tokens, 0)
  );

  delete from ai_locks where user_id = uid and kind = p_kind and token = p_token;
end;
$$;

revoke all on function public.begin_ai_request(text, integer, text, integer) from public, anon;
revoke all on function public.finish_ai_request(text, uuid, text, boolean, text, integer, integer) from public, anon;
grant execute on function public.begin_ai_request(text, integer, text, integer) to authenticated;
grant execute on function public.finish_ai_request(text, uuid, text, boolean, text, integer, integer) to authenticated;

-- 今日のミッションの記録(詳細は supabase/migrations/015_add_mission_logs.sql)
create table if not exists mission_logs (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id      bigint not null references plans(id) on delete cascade,
  mission_date date not null,                       -- 日本時間の日付
  day_index    integer not null check (day_index between 1 and 7),
  area         text not null,
  task         text not null check (char_length(task) between 1 and 200),
  minutes      integer check (minutes between 0 and 240),
  status       text not null check (status in ('done', 'rest')),
  created_at   timestamptz not null default now(),
  unique (user_id, mission_date)                    -- 1人1日1件まで
);

create index if not exists mission_logs_user_date_idx on mission_logs (user_id, mission_date desc);

alter table mission_logs enable row level security;

-- 自分の行だけ読み書きできる。plan_id も自分のプランしか指定できない
drop policy if exists "own rows on mission_logs" on mission_logs;
create policy "own rows on mission_logs" on mission_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );

-- プラン調整(詳細は supabase/migrations/016_add_plan_adjustment.sql)
alter table plans add column if not exists cycle_start date;
alter table plans add column if not exists parent_id   bigint references plans(id) on delete set null;
alter table plans add column if not exists change_note text check (char_length(change_note) <= 300);

-- すでにあるプランは、作成日(日本時間)を1日目にする
update plans set cycle_start = (created_at at time zone 'Asia/Tokyo')::date where cycle_start is null;

alter table plans alter column cycle_start set default ((now() at time zone 'Asia/Tokyo')::date);
alter table plans alter column cycle_start set not null;

-- ============================================================
-- 2) 調整案(承認待ち / 適用済み / やめた)。再読み込みしても残り、二重には適用されない
-- ============================================================
create table if not exists plan_proposals (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id      bigint not null references plans(id) on delete cascade,  -- 調整の対象(その時点の使用中プラン)
  request_text text not null check (char_length(request_text) between 1 and 500),
  ai_message   text not null check (char_length(ai_message) <= 300),
  patch        jsonb not null,   -- AIが返した「どこをどう変えるか」
  diff         jsonb not null,   -- 画面に出す変更前/変更後(表示用)
  status       text not null default 'pending' check (status in ('pending', 'applied', 'dismissed')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists plan_proposals_user_created_idx on plan_proposals (user_id, created_at desc);

alter table plan_proposals enable row level security;

drop policy if exists "own rows on plan_proposals" on plan_proposals;
create policy "own rows on plan_proposals" on plan_proposals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );

-- ============================================================
-- 3) 承認された調整案を、新しいプランとして保存する(1回の命令でまとめて行う)
--    ・調整案が「承認待ち」で、対象プランが「今も使用中」のときだけ通る(古い調整案は拒否)
--    ・元のプランは履歴(archived)に残り、新しいプランが cycle_start を引き継ぐ
--    security invoker(既定)なので、RLSがそのまま効く = 自分の行しか触れない
-- ============================================================
create or replace function public.save_adjusted_plan(
  p_proposal_id bigint,
  p_content jsonb,
  p_note text default null
)
returns bigint
language plpgsql
as $$
declare
  prop   plan_proposals%rowtype;
  old    plans%rowtype;
  new_id bigint;
begin
  select * into prop
    from plan_proposals
   where id = p_proposal_id and user_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'proposal_not_found';
  end if;
  if prop.status <> 'pending' then
    raise exception 'proposal_not_pending';
  end if;

  select * into old
    from plans
   where id = prop.plan_id and user_id = (select auth.uid()) and status = 'active'
   for update;
  if not found then
    raise exception 'plan_not_active';
  end if;

  update plans set status = 'archived' where id = old.id;

  insert into plans (status, ideal_snapshot, content, cycle_start, parent_id, change_note)
  values ('active', old.ideal_snapshot, p_content, old.cycle_start, old.id, left(p_note, 300))
  returning id into new_id;

  update plan_proposals set status = 'applied', resolved_at = now() where id = prop.id;

  return new_id;
end;
$$;

revoke all on function public.save_adjusted_plan(bigint, jsonb, text) from public, anon;
grant execute on function public.save_adjusted_plan(bigint, jsonb, text) to authenticated;
