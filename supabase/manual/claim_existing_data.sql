-- 【1回だけ実行】ログイン機能を入れる前から入っていたデータを、自分のアカウントに引き継ぐ
--
-- 使い方:
--   1) アプリで新規登録する(まだプロフィールの入力はしない)
--   2) 下の 'ここに登録したメールアドレス' を、登録したメールアドレスに書き換える
--      (シングルクォート ' ' は消さずに、中身だけ書き換えます)
--   3) SupabaseのSQL Editorに貼り付けて Run
--
-- 何をするか:
--   user_id が空欄(=ログイン機能の導入前に作られた)のデータを、すべてあなたのものにします

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = 'ここに登録したメールアドレス';

  if uid is null then
    raise exception 'このメールアドレスのユーザーが見つかりません。メールアドレスの書き間違いがないか確認してください';
  end if;

  -- 新規登録時に自動で作られた「空のプロフィール」を消し、元のプロフィールを引き継ぐ
  delete from profile where user_id = uid;
  update profile set user_id = uid where user_id is null;

  update meal_records         set user_id = uid where user_id is null;
  update weight_records       set user_id = uid where user_id is null;
  update workout_records      set user_id = uid where user_id is null;
  update beauty_consultations set user_id = uid where user_id is null;
  update daily_todos          set user_id = uid where user_id is null;
end
$$;

-- 確認用(任意): それぞれ引き継がれた件数が表示されます
select
  (select count(*) from profile              where user_id is not null) as profile,
  (select count(*) from weight_records       where user_id is not null) as weight_records,
  (select count(*) from beauty_consultations where user_id is not null) as beauty_consultations,
  (select count(*) from meal_records         where user_id is not null) as meal_records,
  (select count(*) from workout_records      where user_id is not null) as workout_records;
