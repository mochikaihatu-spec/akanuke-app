-- 利用回数制限(014)の動作テスト。Supabase の SQL Editor に貼り付けて Run してください。
--
-- ・既存ユーザーの1人になりすまして、begin_ai_request / finish_ai_request を呼びます
-- ・テスト専用の機能名(t_...)だけを使います
-- ・最後に必ずエラーで終わるので、途中の変更(テスト用の記録)は全部取り消されます
--   → 画面に「ERROR: ... テスト結果」と出るのが正常です。OK/NG の一覧を読んでください

do $$
declare
  uid  uuid;
  r    text := '';
  j    jsonb;
  tok  uuid;
  tok2 uuid;
  n    integer;
  jst  timestamp := now() at time zone 'Asia/Tokyo';
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise exception 'auth.users にユーザーがいません';
  end if;

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);

  -- 1) 通常:最初は ok
  j := begin_ai_request('t_a', 2, 'month', 60);
  tok := (j->>'token')::uuid;
  r := r || case when j->>'status' = 'ok' and (j->>'used')::int = 0 then 'OK  ' else 'NG  ' end || '1. 最初のリクエストは ok(used=0)' || E'\n';

  -- 2) 同時実行:鍵が取られているので busy
  j := begin_ai_request('t_a', 2, 'month', 60);
  r := r || case when j->>'status' = 'busy' then 'OK  ' else 'NG  ' end || '2. 処理中にもう1回呼ぶと busy' || E'\n';

  -- 3) 失敗:回数は増えず、鍵は返る
  perform finish_ai_request('t_a', tok, 'month', false, 'm', 100, 0);
  select coalesce(sum(count), 0) into n from ai_usage where user_id = uid and kind = 't_a';
  r := r || case when n = 0 then 'OK  ' else 'NG  ' end || '3. AIが失敗しても回数は 0 のまま' || E'\n';

  j := begin_ai_request('t_a', 2, 'month', 60);
  tok := (j->>'token')::uuid;
  r := r || case when j->>'status' = 'ok' then 'OK  ' else 'NG  ' end || '4. 失敗のあと、すぐ再試行できる(鍵が返っている)' || E'\n';

  -- 5) 成功:1回目、2回目
  perform finish_ai_request('t_a', tok, 'month', true, 'm', 1000, 500);
  j := begin_ai_request('t_a', 2, 'month', 60);
  tok := (j->>'token')::uuid;
  r := r || case when j->>'status' = 'ok' and (j->>'used')::int = 1 then 'OK  ' else 'NG  ' end || '5. 成功1回で used=1' || E'\n';
  perform finish_ai_request('t_a', tok, 'month', true, 'm', 1000, 500);

  -- 6) 上限到達:limit と、残り・リセット日の情報
  j := begin_ai_request('t_a', 2, 'month', 60);
  r := r || case when j->>'status' = 'limit' and (j->>'used')::int = 2 then 'OK  ' else 'NG  ' end || '6. 2回成功したあとは limit' || E'\n';
  r := r || case when (j->>'next_reset')::date = (date_trunc('month', jst) + interval '1 month')::date then 'OK  ' else 'NG  ' end || '7. リセット日が翌月1日(日本時間)' || E'\n';
  j := begin_ai_request('t_a', 2, 'month', 60);
  r := r || case when j->>'status' = 'limit' then 'OK  ' else 'NG  ' end || '8. limit のあとも鍵が残らない(busy にならない)' || E'\n';

  -- 9) 月が変わったら数え直し:先月の回数は今月に影響しない
  insert into ai_usage (user_id, usage_date, kind, count)
  values (uid, (date_trunc('month', jst) - interval '1 month')::date, 't_b', 99);
  j := begin_ai_request('t_b', 1, 'month', 60);
  r := r || case when j->>'status' = 'ok' and (j->>'used')::int = 0 then 'OK  ' else 'NG  ' end || '9. 先月99回使っていても、今月は 0 回から' || E'\n';
  perform finish_ai_request('t_b', (j->>'token')::uuid, 'month', true, 'm', 1, 1);

  -- 10) 日の切り替え:昨日の回数は今日に影響しない
  insert into ai_usage (user_id, usage_date, kind, count)
  values (uid, jst::date - 1, 't_c', 99);
  j := begin_ai_request('t_c', 1, 'day', 60);
  r := r || case when j->>'status' = 'ok' and (j->>'used')::int = 0 then 'OK  ' else 'NG  ' end || '10. 昨日99回使っていても、今日は 0 回から' || E'\n';
  perform finish_ai_request('t_c', (j->>'token')::uuid, 'day', true, 'm', 1, 1);

  -- 11) 別の機能とは独立して数える
  j := begin_ai_request('t_d', 1, 'month', 60);
  r := r || case when j->>'status' = 'ok' and (j->>'used')::int = 0 then 'OK  ' else 'NG  ' end || '11. 別の機能(t_d)は t_a の影響を受けない' || E'\n';
  tok := (j->>'token')::uuid;

  -- 12) 他人の鍵(でたらめな token)では、鍵を返せない
  perform finish_ai_request('t_d', gen_random_uuid(), 'month', false, 'm', 0, 0);
  j := begin_ai_request('t_d', 1, 'month', 60);
  r := r || case when j->>'status' = 'busy' then 'OK  ' else 'NG  ' end || '12. でたらめな token では鍵を解除できない' || E'\n';

  -- 13) 鍵の期限切れ:期限が過ぎたら取り直せる
  update ai_locks set locked_until = now() - interval '1 second' where user_id = uid and kind = 't_d';
  j := begin_ai_request('t_d', 1, 'month', 60);
  tok2 := (j->>'token')::uuid;
  r := r || case when j->>'status' = 'ok' and tok2 <> tok then 'OK  ' else 'NG  ' end || '13. 鍵の期限が切れたら新しく取れる' || E'\n';

  -- 14) 期限切れ後に古い鍵で成功を報告しても、回数は数える(数え漏れ防止)
  perform finish_ai_request('t_d', tok, 'month', true, 'm', 10, 10);
  select coalesce(sum(count), 0) into n from ai_usage where user_id = uid and kind = 't_d';
  r := r || case when n = 1 then 'OK  ' else 'NG  ' end || '14. 古い鍵でも、成功は回数に数える' || E'\n';
  perform finish_ai_request('t_d', tok2, 'month', false, 'm', 0, 0);

  -- 15) 記録(ログ):成功2・失敗1、トークン数の合計
  select count(*) into n from ai_usage_logs where user_id = uid and kind = 't_a' and success;
  r := r || case when n = 2 then 'OK  ' else 'NG  ' end || '15. 記録:t_a の成功が2件' || E'\n';
  select count(*) into n from ai_usage_logs where user_id = uid and kind = 't_a' and not success;
  r := r || case when n = 1 then 'OK  ' else 'NG  ' end || '16. 記録:t_a の失敗が1件' || E'\n';
  select coalesce(sum(input_tokens), 0) into n from ai_usage_logs where user_id = uid and kind = 't_a';
  r := r || case when n = 2100 then 'OK  ' else 'NG  ' end || '17. 記録:入力トークンの合計 2100(100+1000+1000)' || E'\n';

  -- 18) 不正な値は invalid
  j := begin_ai_request('t_e', -1, 'month', 60);
  r := r || case when j->>'status' = 'invalid' then 'OK  ' else 'NG  ' end || '18. 上限が負の数なら invalid' || E'\n';
  j := begin_ai_request('t_e', 1, 'year', 60);
  r := r || case when j->>'status' = 'invalid' then 'OK  ' else 'NG  ' end || '19. 期間が不正なら invalid' || E'\n';

  -- 20) 未ログイン
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  j := begin_ai_request('t_f', 1, 'month', 60);
  r := r || case when j->>'status' = 'unauthenticated' then 'OK  ' else 'NG  ' end || '20. ログインしていないと unauthenticated' || E'\n';

  raise exception E'\n===== テスト結果(このエラーは正常です。変更はすべて取り消されました) =====\n%', r;
end;
$$;
