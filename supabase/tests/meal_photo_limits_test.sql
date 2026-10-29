-- 食事写真AI(kind = 'meal_photo')の利用回数制限の動作テスト。Supabase の SQL Editor に貼り付けて Run してください。
--
-- ・上限の数字(無料 月3回 / 有料 1日5回)は、アプリ側 src/lib/plans-config.ts が DB 関数に渡します。
--   このテストは、その数字(3 と 5)を渡したときの DB 側の動き(数える・止める・リセット・他機能に影響しない)を確かめます
-- ・既存ユーザーの1人になりすまして begin_ai_request / finish_ai_request を呼びます
-- ・いまの回数(すでに使っていてもよい)を読んでから「あと3回」「あと5回」として試すので、本物のデータがあっても動きます
-- ・最後に必ずエラーで終わるので、途中の変更(テスト用の記録)は全部取り消されます
--   → 画面に「ERROR: ... テスト結果」と出るのが正常です。OK/NG の一覧を読んでください

do $$
declare
  uid     uuid;
  r       text := '';
  j       jsonb;
  tok     uuid;
  base    integer;
  lim     integer;
  i       integer;
  n       integer;
  before_others text;
  after_others  text;
  jst     timestamp := now() at time zone 'Asia/Tokyo';
  m_start date := date_trunc('month', now() at time zone 'Asia/Tokyo')::date;
  d_start date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise exception 'auth.users にユーザーがいません';
  end if;

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);

  -- 他の機能(meal_photo 以外)の回数の「いま」を控える
  select coalesce(string_agg(kind || ':' || usage_date || ':' || count, ',' order by kind, usage_date), '')
    into before_others
    from ai_usage where user_id = uid and kind <> 'meal_photo';

  -- ===== 無料: 月3回 =====
  select coalesce(sum(count), 0) into base from ai_usage
   where user_id = uid and kind = 'meal_photo' and usage_date = m_start;
  lim := base + 3;   -- 「あと3回」の状態を作る(base = すでに使った分)

  -- 失敗は回数に数えない
  j := begin_ai_request('meal_photo', lim, 'month', 60);
  r := r || case when j->>'status' = 'ok' and (j->>'used')::int = base then 'OK  ' else 'NG  ' end || '1. 無料: 最初は ok' || E'\n';
  perform finish_ai_request('meal_photo', (j->>'token')::uuid, 'month', false, 'm', 100, 0);
  j := begin_ai_request('meal_photo', lim, 'month', 60);
  r := r || case when j->>'status' = 'ok' and (j->>'used')::int = base then 'OK  ' else 'NG  ' end || '2. 無料: 失敗したあとも回数は増えず、すぐ再試行できる' || E'\n';
  perform finish_ai_request('meal_photo', (j->>'token')::uuid, 'month', true, 'm', 100, 50);  -- 成功1回目

  -- 処理中の同時リクエストは busy(上限を超えて通れない)
  j := begin_ai_request('meal_photo', lim, 'month', 60);
  tok := (j->>'token')::uuid;
  r := r || case when j->>'status' = 'ok' and (j->>'used')::int = base + 1 then 'OK  ' else 'NG  ' end || '3. 無料: 成功1回で used が1つ増える' || E'\n';
  j := begin_ai_request('meal_photo', lim, 'month', 60);
  r := r || case when j->>'status' = 'busy' then 'OK  ' else 'NG  ' end || '4. 無料: 処理中にもう1回呼ぶと busy(同時リクエストで超過できない)' || E'\n';
  perform finish_ai_request('meal_photo', tok, 'month', true, 'm', 100, 50);  -- 成功2回目

  j := begin_ai_request('meal_photo', lim, 'month', 60);
  perform finish_ai_request('meal_photo', (j->>'token')::uuid, 'month', true, 'm', 100, 50);  -- 成功3回目
  r := r || case when j->>'status' = 'ok' and (j->>'used')::int = base + 2 then 'OK  ' else 'NG  ' end || '5. 無料: 3回目まで ok' || E'\n';

  j := begin_ai_request('meal_photo', lim, 'month', 60);
  r := r || case when j->>'status' = 'limit' and (j->>'used')::int = base + 3 then 'OK  ' else 'NG  ' end || '6. 無料: 3回成功したあとの4回目は limit' || E'\n';
  r := r || case when (j->>'next_reset')::date = (date_trunc('month', jst) + interval '1 month')::date then 'OK  ' else 'NG  ' end || '7. 無料: リセット日は翌月1日(日本時間)' || E'\n';
  j := begin_ai_request('meal_photo', lim, 'month', 60);
  r := r || case when j->>'status' = 'limit' then 'OK  ' else 'NG  ' end || '8. 無料: 何度呼んでも limit のまま(鍵も残らない)' || E'\n';

  -- 先月の回数は今月に影響しない
  insert into ai_usage (user_id, usage_date, kind, count)
  values (uid, (date_trunc('month', jst) - interval '1 month')::date, 'meal_photo', 99)
  on conflict (user_id, usage_date, kind) do update set count = 99;
  select count into n from ai_usage where user_id = uid and kind = 'meal_photo' and usage_date = m_start;
  r := r || case when n = base + 3 then 'OK  ' else 'NG  ' end || '9. 無料: 先月99回使っていても、今月の数え方は変わらない(月が変われば 0 から)' || E'\n';

  -- ===== 有料: 1日5回 =====
  select coalesce(sum(count), 0) into base from ai_usage
   where user_id = uid and kind = 'meal_photo' and usage_date = d_start;
  lim := base + 5;

  for i in 1..5 loop
    j := begin_ai_request('meal_photo', lim, 'day', 60);
    if j->>'status' <> 'ok' or (j->>'used')::int <> base + i - 1 then
      r := r || 'NG  ' || '10. 有料: ' || i || '回目が ok にならない(' || (j->>'status') || ')' || E'\n';
      exit;
    end if;
    perform finish_ai_request('meal_photo', (j->>'token')::uuid, 'day', true, 'm', 100, 50);
    if i = 5 then
      r := r || 'OK  10. 有料: 1日5回まで ok' || E'\n';
    end if;
  end loop;

  j := begin_ai_request('meal_photo', lim, 'day', 60);
  r := r || case when j->>'status' = 'limit' and (j->>'used')::int = base + 5 then 'OK  ' else 'NG  ' end || '11. 有料: 5回成功したあとの6回目は limit' || E'\n';
  r := r || case when (j->>'next_reset')::date = jst::date + 1 then 'OK  ' else 'NG  ' end || '12. 有料: リセット日は明日(日本時間の0時)' || E'\n';

  -- 昨日の回数は今日に影響しない
  insert into ai_usage (user_id, usage_date, kind, count)
  values (uid, d_start - 1, 'meal_photo', 99)
  on conflict (user_id, usage_date, kind) do update set count = 99;
  select count into n from ai_usage where user_id = uid and kind = 'meal_photo' and usage_date = d_start;
  r := r || case when n = base + 5 then 'OK  ' else 'NG  ' end || '13. 有料: 昨日99回使っていても、今日の数え方は変わらない(日が変われば 0 から)' || E'\n';

  -- ===== 他の機能に影響しない =====
  select coalesce(string_agg(kind || ':' || usage_date || ':' || count, ',' order by kind, usage_date), '')
    into after_others
    from ai_usage where user_id = uid and kind <> 'meal_photo';
  r := r || case when before_others = after_others then 'OK  ' else 'NG  ' end || '14. meal_photo を使い切っても、chat / plan / beauty / todos / plan_adjust の回数は変わらない' || E'\n';

  -- meal_photo が上限でも、他の機能は止まらない(鍵も独立)
  j := begin_ai_request('chat', 1000, 'day', 60);
  r := r || case when j->>'status' = 'ok' then 'OK  ' else 'NG  ' end || '15. meal_photo が上限でも、chat は使える' || E'\n';
  perform finish_ai_request('chat', (j->>'token')::uuid, 'day', false, 'm', 0, 0);  -- 失敗扱い=回数に数えない

  -- ===== 記録(ログ) =====
  select count(*) into n from ai_usage_logs where user_id = uid and kind = 'meal_photo' and not success and created_at >= now() - interval '5 minutes';
  r := r || case when n = 1 then 'OK  ' else 'NG  ' end || '16. 記録: 失敗が1件ログに残っている' || E'\n';

  raise exception E'\n===== テスト結果(このエラーは正常です。変更はすべて取り消されました) =====\n%', r;
end;
$$;
