-- profile に目標カロリー・目標タンパク質量を追加
alter table profile
  add column if not exists target_calories integer,
  add column if not exists target_protein_g numeric(5,1);

-- meal_records にタンパク質量を追加し、meal_type を必須ではなくする
alter table meal_records
  add column if not exists protein_g numeric(5,1);

alter table meal_records
  alter column meal_type drop not null;
