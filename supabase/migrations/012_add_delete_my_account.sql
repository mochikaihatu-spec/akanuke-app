-- アカウントの削除(本人が自分のアカウントだけを消せる)
-- 何度実行してもエラーにならないように書いてあります。既存のテーブル・データには触りません。
--
-- auth.users の行を消すと、各テーブルの user_id(on delete cascade)により、
-- profile / meal_records / weight_records / workout_records /
-- beauty_consultations / daily_todos / ai_usage の自分のデータがすべて一緒に消えます。
-- 食事写真(Storage)は、アプリ側が先に Storage の機能で消します。

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
