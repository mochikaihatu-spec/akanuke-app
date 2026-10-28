-- 今日のミッションの記録(完了 / お休み)。フェーズ2
-- 何度実行してもエラーにならないように書いてあります。既存のテーブル・データには触りません。
-- ミッション自体は保存済みプランの「週間プラン」から取り出す(AIは使わない)ので、
-- ここには「その日に何をしたか」だけを残す。やることの文はコピーを持つので、プランを作り直しても記録は消えない。

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
