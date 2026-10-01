-- 「今日のToDo」のキャッシュ(1日1回だけAIに生成させ、その日はこの結果を使い回す)
create table if not exists daily_todos (
  todo_date date primary key,
  items jsonb not null,
  created_at timestamptz not null default now()
);

alter table daily_todos enable row level security;

create policy "allow all on daily_todos" on daily_todos
  for all using (true) with check (true);
