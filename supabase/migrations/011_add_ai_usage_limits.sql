-- AIの利用回数制限(1人あたり・1日あたり・機能ごと)
-- 何度実行してもエラーにならないように書いてあります。既存のテーブルには触りません。

create table if not exists ai_usage (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  usage_date date not null,
  kind       text not null,      -- 'chat' / 'beauty' / 'todos' / 'meal_photo'
  count      integer not null default 0,
  primary key (user_id, usage_date, kind)
);

alter table ai_usage enable row level security;

-- 自分の利用回数は読める。書き込みは下の関数からだけ(直接 insert/update はできない)
drop policy if exists "read own ai_usage" on ai_usage;
create policy "read own ai_usage" on ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 回数を1つ増やす。上限に達していたら増やさず false を返す(日本時間で日付を切り替え)
-- 「確認→加算」を1回の命令で行うので、同時に何回リクエストが来ても上限を超えない
create or replace function public.consume_ai_quota(p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Tokyo')::date;
  new_count integer;
begin
  if uid is null then
    return false;
  end if;

  insert into ai_usage as u (user_id, usage_date, kind, count)
  values (uid, today, p_kind, 1)
  on conflict (user_id, usage_date, kind)
  do update set count = u.count + 1
  where u.count < p_limit
  returning u.count into new_count;

  return new_count is not null;
end;
$$;

revoke all on function public.consume_ai_quota(text, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer) to authenticated;
