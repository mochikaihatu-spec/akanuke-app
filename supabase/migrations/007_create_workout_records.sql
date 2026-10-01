-- 筋トレ記録
create table if not exists workout_records (
  id bigint generated always as identity primary key,
  exercise_name text not null,
  weight numeric(5,1),
  reps integer,
  sets integer,
  created_at timestamptz not null default now()
);

-- RLS: ログイン機能がないので、anon キーからの読み書きをすべて許可する
alter table workout_records enable row level security;

create policy "allow all on workout_records" on workout_records
  for all using (true) with check (true);
