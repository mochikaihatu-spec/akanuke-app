-- 無料/有料の区分と、月間・日間のAI利用回数の管理(失敗したときは回数に数えない)
-- 何度実行してもエラーにならないように書いてあります。
-- 既存のテーブル・データ、011 の consume_ai_quota 関数には触りません(今の本番コードがまだ使っているため)。

-- ============================================================
-- 1) 契約状態(無料/有料)。ユーザーは「読む」ことしかできない
--    書き込みは Supabase の管理画面(SQL Editor)や、将来の決済連携(サーバー専用)だけ。
--    行がない人 = 無料プラン
-- ============================================================
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
