-- AIの利用状況・原価・継続の集計(読み取り専用。データは変えません)
-- Supabase の SQL Editor で、下の「クエリ1〜3」を【1つずつ】コピーして Run してください。
--
-- 注意:
--  ・料金(prices)は仮の値です。必ず Anthropic の料金表(コンソールの Pricing)で、
--    使っているモデルの「入力 / 出力 100万トークンあたりの料金(USD)」に書き換えてください。
--  ・円換算のレート(yen_per_usd)も、そのときの為替に合わせて書き換えてください。
--  ・トークンの記録は、利用回数の管理(014)を本番に入れた日から。それ以前の利用は含まれません。
--  ・ユーザーは user_id の先頭8文字で表示します(メールアドレスは出しません)。

-- ============================================================
-- クエリ1:機能ごとの利用状況と原価(直近30日)
--   calls_ok / calls_failed: 成功 / 失敗の回数(失敗はユーザーの回数には数えないが、原価はかかる)
--   cost_yen: 原価(円)  avg_yen_per_call: 1回あたりの原価(円)
-- ============================================================
with params as (
  select 3.00::numeric  as input_usd_per_mtok,   -- ★要確認:入力100万トークンあたり(USD)
         15.00::numeric as output_usd_per_mtok,  -- ★要確認:出力100万トークンあたり(USD)
         150::numeric   as yen_per_usd           -- ★要確認:為替
)
select
  l.kind,
  count(*) filter (where l.success)       as calls_ok,
  count(*) filter (where not l.success)   as calls_failed,
  sum(l.input_tokens)                     as input_tokens,
  sum(l.output_tokens)                    as output_tokens,
  round(sum(
    (coalesce(l.input_tokens, 0)  * p.input_usd_per_mtok +
     coalesce(l.output_tokens, 0) * p.output_usd_per_mtok) / 1000000.0 * p.yen_per_usd
  ), 1)                                   as cost_yen,
  round(avg(
    (coalesce(l.input_tokens, 0)  * p.input_usd_per_mtok +
     coalesce(l.output_tokens, 0) * p.output_usd_per_mtok) / 1000000.0 * p.yen_per_usd
  ), 2)                                   as avg_yen_per_call
from ai_usage_logs l, params p
where l.created_at >= now() - interval '30 days'
group by l.kind
order by cost_yen desc nulls last;

-- ============================================================
-- クエリ2:ユーザーごとの、今月の原価(日本時間の月初から)
--   月額680円に対して、原価がいくらか / 利益(手数料を除く前)がいくらかの目安
-- ============================================================
with params as (
  select 3.00::numeric  as input_usd_per_mtok,   -- ★要確認
         15.00::numeric as output_usd_per_mtok,  -- ★要確認
         150::numeric   as yen_per_usd,          -- ★要確認
         680::numeric   as price_yen             -- 有料プランの月額(案)
), month_start as (
  select (date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo') as t
)
select
  left(l.user_id::text, 8)                                  as user,
  count(*)                                                  as calls,
  count(*) filter (where l.kind = 'plan')                   as plan,
  count(*) filter (where l.kind = 'plan_adjust')            as adjust,
  count(*) filter (where l.kind = 'beauty')                 as beauty,
  count(*) filter (where l.kind = 'chat')                   as chat,
  count(*) filter (where l.kind = 'todos')                  as todos,
  count(*) filter (where l.kind = 'meal_photo')             as photo,
  round(sum(
    (coalesce(l.input_tokens, 0)  * p.input_usd_per_mtok +
     coalesce(l.output_tokens, 0) * p.output_usd_per_mtok) / 1000000.0 * p.yen_per_usd
  ), 1)                                                     as cost_yen,
  round(max(p.price_yen) - sum(
    (coalesce(l.input_tokens, 0)  * p.input_usd_per_mtok +
     coalesce(l.output_tokens, 0) * p.output_usd_per_mtok) / 1000000.0 * p.yen_per_usd
  ), 1)                                                     as margin_if_paid_yen
from ai_usage_logs l, params p, month_start m
where l.created_at >= m.t
group by l.user_id
order by cost_yen desc nulls last;

-- ============================================================
-- クエリ3:続けられているか(ユーザーごと)
--   plan_created: 最初のプランを作った日 / adjusted: 調整した回数
--   done_total: ミッションの完了回数 / active_days_14: 直近14日で記録した日数
--   last_record: 最後にミッションを記録した日
-- ============================================================
select
  left(u.id::text, 8)                                                    as user,
  (select min(p.created_at at time zone 'Asia/Tokyo')::date from plans p where p.user_id = u.id) as plan_created,
  (select count(*) from plans p where p.user_id = u.id and p.parent_id is not null)              as adjusted,
  (select count(*) from mission_logs m where m.user_id = u.id and m.status = 'done')             as done_total,
  (select count(*) from mission_logs m where m.user_id = u.id and m.status = 'rest')             as rest_total,
  (select count(*) from mission_logs m
     where m.user_id = u.id and m.mission_date >= (now() at time zone 'Asia/Tokyo')::date - 13)  as active_days_14,
  (select max(m.mission_date) from mission_logs m where m.user_id = u.id)                        as last_record
from auth.users u
order by plan_created nulls last;
