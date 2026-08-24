-- 食事記録に写真URLを追加
alter table meal_records
  add column if not exists photo_url text;

-- 写真保存用のストレージバケット
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', true)
on conflict (id) do nothing;

-- ログイン機能がないので、anon キーからの読み書きをすべて許可する
create policy "allow all on meal-photos objects"
on storage.objects for all
using (bucket_id = 'meal-photos')
with check (bucket_id = 'meal-photos');
