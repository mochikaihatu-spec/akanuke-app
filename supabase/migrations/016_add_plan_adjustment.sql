-- AI相談でプランを調整する(フェーズ3)。調整案は「承認されるまでプランを変えない」
-- 何度実行してもエラーにならないように書いてあります。既存のデータは壊しません。

-- ============================================================
-- 1) plans に列を追加
--    cycle_start: 「1日目」の日付(日本時間)。調整してもサイクルが続くよう、引き継ぐ
--    parent_id:   調整の元になったプラン
--    change_note: 調整の説明(AIのひと言)
-- ============================================================
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
