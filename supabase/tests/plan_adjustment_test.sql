-- プラン調整(016)の動作テスト。Supabase の SQL Editor に貼り付けて Run してください。
--
-- ・使用中のプランを持つユーザー1人になりすまして、実際の権限(authenticated)で操作します
-- ・最後に必ずエラーで終わるので、テスト用の変更(新しいプラン・調整案)は全部取り消されます
--   → 画面に「ERROR: ... テスト結果」と出るのが正常です。OK/NG の一覧を読んでください

do $$
declare
  uid       uuid;
  old_id    bigint;
  old_cycle date;
  old_content jsonb;
  prop1     bigint;
  prop2     bigint;
  prop3     bigint;
  new_id    bigint;
  r         text := '';
  msg       text;
  n         integer;
  rec       record;
begin
  select user_id, id, cycle_start, content into uid, old_id, old_cycle, old_content
    from plans where status = 'active' order by created_at limit 1;
  if uid is null then
    raise exception 'アクティブなプランを持つユーザーがいません(先にプランを1つ作ってください)';
  end if;

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 準備:調整案を3つ作る
  insert into plan_proposals (plan_id, request_text, ai_message, patch, diff)
  values (old_id, 'テスト1', 'テスト', '{}'::jsonb, '[]'::jsonb) returning id into prop1;
  insert into plan_proposals (plan_id, request_text, ai_message, patch, diff)
  values (old_id, 'テスト2', 'テスト', '{}'::jsonb, '[]'::jsonb) returning id into prop2;

  -- 1) 承認:新しいプランができ、元は履歴になる
  new_id := save_adjusted_plan(prop1, old_content, 'テストの調整');
  select count(*) into n from plans where id = old_id and status = 'archived';
  r := r || case when n = 1 then 'OK  ' else 'NG  ' end || '1. 承認すると元のプランが履歴(archived)になる' || E'\n';

  select * into rec from plans where id = new_id;
  r := r || case when rec.status = 'active' and rec.parent_id = old_id then 'OK  ' else 'NG  ' end || '2. 新しいプランが使用中になり、元のプランを親に持つ' || E'\n';
  r := r || case when rec.cycle_start = old_cycle then 'OK  ' else 'NG  ' end || '3. 「1日目」の日付(cycle_start)が引き継がれる(サイクルが続く)' || E'\n';
  r := r || case when rec.change_note = 'テストの調整' then 'OK  ' else 'NG  ' end || '4. 調整の説明が保存される' || E'\n';

  select count(*) into n from plans where user_id = uid and status = 'active';
  r := r || case when n = 1 then 'OK  ' else 'NG  ' end || '5. 使用中のプランは常に1つだけ' || E'\n';

  select count(*) into n from plan_proposals where id = prop1 and status = 'applied' and resolved_at is not null;
  r := r || case when n = 1 then 'OK  ' else 'NG  ' end || '6. 調整案が「適用済み」になる' || E'\n';

  -- 7) 同じ調整案の二重適用は拒否される
  begin
    perform save_adjusted_plan(prop1, old_content, 'もう一度');
    msg := 'no error';
  exception when others then msg := sqlerrm; end;
  r := r || case when msg = 'proposal_not_pending' then 'OK  ' else 'NG  (' || msg || ') ' end || '7. 適用済みの調整案は、もう一度は適用できない' || E'\n';

  -- 8) 古い調整案(対象プランがもう使用中でない)は拒否される
  begin
    perform save_adjusted_plan(prop2, old_content, '古い案');
    msg := 'no error';
  exception when others then msg := sqlerrm; end;
  r := r || case when msg = 'plan_not_active' then 'OK  ' else 'NG  (' || msg || ') ' end || '8. 対象プランが変わったあとの古い調整案は拒否される' || E'\n';

  -- 9) 存在しない調整案
  begin
    perform save_adjusted_plan(-1, old_content, 'x');
    msg := 'no error';
  exception when others then msg := sqlerrm; end;
  r := r || case when msg = 'proposal_not_found' then 'OK  ' else 'NG  (' || msg || ') ' end || '9. 存在しない調整案は拒否される' || E'\n';

  -- 10) 調整案の「やめる」(自分の調整案を更新できる)
  insert into plan_proposals (plan_id, request_text, ai_message, patch, diff)
  values (new_id, 'テスト3', 'テスト', '{}'::jsonb, '[]'::jsonb) returning id into prop3;
  update plan_proposals set status = 'dismissed', resolved_at = now() where id = prop3 and status = 'pending';
  select count(*) into n from plan_proposals where id = prop3 and status = 'dismissed';
  r := r || case when n = 1 then 'OK  ' else 'NG  ' end || '10. 調整案を「やめる」にできる' || E'\n';

  -- 11) やめた調整案は適用できない
  begin
    perform save_adjusted_plan(prop3, old_content, 'やめたはず');
    msg := 'no error';
  exception when others then msg := sqlerrm; end;
  r := r || case when msg = 'proposal_not_pending' then 'OK  ' else 'NG  (' || msg || ') ' end || '11. 「やめた」調整案は適用できない' || E'\n';

  -- 12) 他人のプランを対象にした調整案は作れない
  begin
    insert into plan_proposals (plan_id, request_text, ai_message, patch, diff)
    select p.id, 'x', 'x', '{}'::jsonb, '[]'::jsonb from plans p where p.user_id <> uid limit 1;
    get diagnostics n = row_count;
    r := r || case when n = 0 then '--  12. (他のユーザーのプランがないため、このテストは省略)' else 'NG  12. 他人のプランに調整案を作れてしまった' end || E'\n';
  exception when others then
    r := r || 'OK  12. 他人のプランを対象にした調整案は拒否される' || E'\n';
  end;

  -- 13) 未ログインでは何もできない
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    perform save_adjusted_plan(prop3, old_content, 'x');
    msg := 'no error';
  exception when others then msg := sqlerrm; end;
  r := r || case when msg like 'permission denied%' then 'OK  ' else 'NG  (' || msg || ') ' end || '13. 未ログイン(anon)は関数を呼べない' || E'\n';

  execute 'reset role';
  raise exception E'\n===== テスト結果(このエラーは正常です。変更はすべて取り消されました) =====\n%', r;
end;
$$;
