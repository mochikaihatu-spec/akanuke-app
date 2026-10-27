-- 「憧れ → あなた専用の行動プラン」用の表(フェーズ1)
-- 何度実行してもエラーにならないように書いてあります。既存のテーブル・データには触りません。
-- どちらも user_id + RLS(自分の行だけ)。アカウントを削除すると、一緒に消えます。

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
