-- プロフィール情報(体重・目標体重・身長)
-- 1人用アプリなので id=1 の1行だけを使い回す
create table if not exists profile (
  id smallint primary key default 1,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  target_weight_kg numeric(5,1),
  target_calories integer,
  target_protein_g numeric(5,1),
  updated_at timestamptz not null default now(),
  constraint profile_single_row check (id = 1)
);

insert into profile (id)
values (1)
on conflict (id) do nothing;

-- 食事記録
create table if not exists meal_records (
  id bigint generated always as identity primary key,
  eaten_at timestamptz not null default now(),
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null,
  calories integer,
  protein_g numeric(5,1),
  created_at timestamptz not null default now()
);

-- 体重の記録(履歴)
create table if not exists weight_records (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  weight_kg numeric(5,1) not null,
  created_at timestamptz not null default now()
);

-- RLS: ログイン機能がないので、anon キーからの読み書きをすべて許可する
alter table profile enable row level security;
alter table meal_records enable row level security;
alter table weight_records enable row level security;

create policy "allow all on profile" on profile
  for all using (true) with check (true);

create policy "allow all on meal_records" on meal_records
  for all using (true) with check (true);

create policy "allow all on weight_records" on weight_records
  for all using (true) with check (true);
