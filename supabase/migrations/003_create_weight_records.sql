-- 体重の記録(履歴)
create table if not exists weight_records (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  weight_kg numeric(5,1) not null,
  created_at timestamptz not null default now()
);

-- RLS: ログイン機能がないので、anon キーからの読み書きをすべて許可する
alter table weight_records enable row level security;

create policy "allow all on weight_records" on weight_records
  for all using (true) with check (true);
