-- 美容・垢抜け相談の履歴
create table if not exists beauty_consultations (
  id bigint generated always as identity primary key,
  categories text[] not null,
  concern text,
  answer text not null,
  created_at timestamptz not null default now()
);

-- RLS: ログイン機能がないので、anon キーからの読み書きをすべて許可する
alter table beauty_consultations enable row level security;

create policy "allow all on beauty_consultations" on beauty_consultations
  for all using (true) with check (true);
