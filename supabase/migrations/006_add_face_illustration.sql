-- 顔タップUIに表示するイラスト(男性用/女性用)の設定
alter table profile
  add column if not exists face_illustration text default 'female'
    check (face_illustration in ('male', 'female'));
