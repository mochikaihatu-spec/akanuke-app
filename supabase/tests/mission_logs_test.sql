-- ミッション記録(015)の安全の仕組みのテスト。Supabase の SQL Editor に貼り付けて Run してください。
--
-- ・プランを持っているユーザー1人になりすまして、実際の権限(authenticated)で操作します
-- ・最後に必ずエラーで終わるので、テスト用の記録は全部取り消されます
--   → 画面に「ERROR: ... テスト結果」と出るのが正常です。OK/NG の一覧を読んでください

do $$
declare
  uid      uuid;
  pid      bigint;
  other_pid bigint;
  r        text := '';
  n        integer;
  ok       boolean;
begin
  select user_id, id into uid, pid from plans where status = 'active' order by created_at limit 1;
  if uid is null then
    raise exception 'アクティブなプランを持つユーザーがいません(先にプランを1つ作ってください)';
  end if;
  select id into other_pid from plans where user_id <> uid limit 1;

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1) 自分のプランで記録できる
  begin
    insert into mission_logs (plan_id, mission_date, day_index, area, task, minutes, status)
    values (pid, date '2000-01-01', 1, '肌', 'テスト', 5, 'done');
    ok := true;
  exception when others then ok := false; end;
  r := r || case when ok then 'OK  ' else 'NG  ' end || '1. 自分のプランで完了を記録できる' || E'\n';

  -- 2) 同じ日に2件は入らない
  begin
    insert into mission_logs (plan_id, mission_date, day_index, area, task, minutes, status)
    values (pid, date '2000-01-01', 1, '肌', 'テスト2', 5, 'rest');
    ok := false;
  exception when unique_violation then ok := true; when others then ok := false; end;
  r := r || case when ok then 'OK  ' else 'NG  ' end || '2. 同じ日の2件目は拒否される(1日1件)' || E'\n';

  -- 3) 不正な状態は入らない
  begin
    insert into mission_logs (plan_id, mission_date, day_index, area, task, minutes, status)
    values (pid, date '2000-01-02', 1, '肌', 'テスト', 5, 'cheat');
    ok := false;
  exception when check_violation then ok := true; when others then ok := false; end;
  r := r || case when ok then 'OK  ' else 'NG  ' end || '3. status が done / rest 以外だと拒否される' || E'\n';

  -- 4) 日番号の範囲外は入らない
  begin
    insert into mission_logs (plan_id, mission_date, day_index, area, task, minutes, status)
    values (pid, date '2000-01-03', 9, '肌', 'テスト', 5, 'done');
    ok := false;
  exception when check_violation then ok := true; when others then ok := false; end;
  r := r || case when ok then 'OK  ' else 'NG  ' end || '4. day_index が 1〜7 以外だと拒否される' || E'\n';

  -- 5) 他人の user_id では書けない
  begin
    insert into mission_logs (user_id, plan_id, mission_date, day_index, area, task, minutes, status)
    values (gen_random_uuid(), pid, date '2000-01-04', 1, '肌', 'テスト', 5, 'done');
    ok := false;
  exception when others then ok := true; end;
  r := r || case when ok then 'OK  ' else 'NG  ' end || '5. 他人の user_id では記録できない' || E'\n';

  -- 6) 他人のプランを指定できない(他のユーザーのプランがあるときだけ確認)
  if other_pid is null then
    r := r || '--  6. (他のユーザーのプランがないため、このテストは省略)' || E'\n';
  else
    begin
      insert into mission_logs (plan_id, mission_date, day_index, area, task, minutes, status)
      values (other_pid, date '2000-01-05', 1, '肌', 'テスト', 5, 'done');
      ok := false;
    exception when others then ok := true; end;
    r := r || case when ok then 'OK  ' else 'NG  ' end || '6. 他人のプランを指定した記録は拒否される' || E'\n';
  end if;

  -- 7) 読めるのは自分の行だけ
  select count(*) into n from mission_logs where user_id <> uid;
  r := r || case when n = 0 then 'OK  ' else 'NG  ' end || '7. 他人の記録は見えない' || E'\n';

  -- 8) 自分の記録を取り消せる(削除)
  delete from mission_logs where mission_date = date '2000-01-01';
  select count(*) into n from mission_logs where mission_date = date '2000-01-01';
  r := r || case when n = 0 then 'OK  ' else 'NG  ' end || '8. 自分の記録を取り消せる(戻す)' || E'\n';

  -- 9) 未ログイン(anon)からは、本人の記録があっても見えず、書き込めない
  --    (表への読み取り自体は許されるが、行ごとの制限で 0 件になるのが Supabase の標準の動き)
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into mission_logs (plan_id, mission_date, day_index, area, task, minutes, status)
  values (pid, date '2000-01-09', 1, '肌', 'テスト', 5, 'done');

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';

  select count(*) into n from mission_logs;
  r := r || case when n = 0 then 'OK  ' else 'NG  ' end || '9a. 未ログインからは1件も見えない(本人の記録があっても)' || E'
';

  begin
    insert into mission_logs (user_id, plan_id, mission_date, day_index, area, task, minutes, status)
    values (uid, pid, date '2000-01-10', 1, '肌', 'テスト', 5, 'done');
    ok := false;
  exception when others then ok := true; end;
  r := r || case when ok then 'OK  ' else 'NG  ' end || '9b. 未ログインからは書き込めない' || E'
';

  execute 'reset role';
  raise exception E'\n===== テスト結果(このエラーは正常です。変更はすべて取り消されました) =====\n%', r;
end;
$$;
