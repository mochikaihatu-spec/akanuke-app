-- 使う機能を選べる設定(筋トレ管理・美容相談)
-- 新規は false(オフ)からスタートし、プロフィール画面で自分からオンにしてもらう
alter table profile
  add column if not exists use_workout boolean not null default false,
  add column if not exists use_beauty boolean not null default false;
