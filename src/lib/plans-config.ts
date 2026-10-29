// 無料/有料プランの設定と、利用回数まわりの純粋な計算(画面でもサーバーでも使う)
// 料金や回数はまず検証するための「初期案」。変えたいときはこのファイルの数字だけを直す

export type Tier = 'free' | 'paid'
export type AiKind = 'plan' | 'plan_adjust' | 'beauty' | 'chat' | 'todos' | 'meal_photo'
export type Period = 'month' | 'day'
export type Quota = { limit: number; period: Period }

// 有料プラン。決済は未実装なので purchasable は false(購入できるようには見せない)
export const PAID_PLAN = {
  priceYenPerMonth: 680,
  purchasable: false,
} as const

// 日本時間を基準に数える。month=毎月1日の0時にリセット / day=毎日0時にリセット
export const AI_QUOTAS: Record<Tier, Record<AiKind, Quota>> = {
  free: {
    plan: { limit: 1, period: 'month' },
    plan_adjust: { limit: 5, period: 'month' },
    beauty: { limit: 20, period: 'month' },
    chat: { limit: 20, period: 'day' },
    todos: { limit: 5, period: 'day' },
    meal_photo: { limit: 3, period: 'month' },
  },
  paid: {
    plan: { limit: 4, period: 'month' },
    plan_adjust: { limit: 20, period: 'month' },
    beauty: { limit: 100, period: 'month' },
    chat: { limit: 20, period: 'day' },
    todos: { limit: 5, period: 'day' },
    meal_photo: { limit: 5, period: 'day' },
  },
}

export const AI_KIND_LABELS: Record<AiKind, string> = {
  plan: 'プラン作成',
  plan_adjust: 'プラン相談',
  beauty: 'AI美容相談',
  chat: 'AIチャット',
  todos: '今日のToDo',
  meal_photo: '食事の写真解析',
}

// 将来、有料限定の機能を足すときの置き場所(いまは未使用)。判定は必ずサーバー側で行う
export const TIER_FEATURES: Record<Tier, { detailedProgressAnalysis: boolean; personalizedProductAdvice: boolean }> = {
  free: { detailedProgressAnalysis: false, personalizedProductAdvice: false },
  paid: { detailedProgressAnalysis: true, personalizedProductAdvice: true },
}

// ---- 有料かどうかの判定(subscriptions 表の行から) ----------------------------

export type SubscriptionRow = {
  plan?: string | null
  status?: string | null
  current_period_end?: string | null
}

// 行がない/有効でない/期限切れ → 無料。有料と判定するのは「active かつ期限内」だけ
export function tierFromSubscription(sub: SubscriptionRow | null | undefined, now: Date = new Date()): Tier {
  if (!sub || sub.plan !== 'paid' || sub.status !== 'active' || !sub.current_period_end) return 'free'
  const end = new Date(sub.current_period_end)
  return Number.isFinite(end.getTime()) && end.getTime() > now.getTime() ? 'paid' : 'free'
}

// ---- 日本時間での期間の計算 ----------------------------------------------------

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

// 日本時間の年月日(月は1〜12)
export function jstDateParts(now: Date) {
  const d = new Date(now.getTime() + JST_OFFSET_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

const pad = (n: number) => String(n).padStart(2, '0')

// 今の期間の開始日('YYYY-MM-DD')。DB の ai_usage.usage_date と同じ値になる
export function periodStart(period: Period, now: Date = new Date()) {
  const { year, month, day } = jstDateParts(now)
  return period === 'month' ? `${year}-${pad(month)}-01` : `${year}-${pad(month)}-${pad(day)}`
}

// 「次にリセットされる日」を表す文(例: 11月1日 0時(日本時間) / 明日 0時(日本時間))
export function resetLabel(period: Period, now: Date = new Date()) {
  if (period === 'day') return '明日 0時(日本時間)'
  const { month } = jstDateParts(now)
  const nextMonth = month === 12 ? 1 : month + 1
  return `${nextMonth}月1日 0時(日本時間)`
}

// ---- 表示用の文 ---------------------------------------------------------------

// 有料プランの案内。強引にならない一文。決済が未実装のうちは「準備中」と明記する
export function upgradeHint(kind: AiKind, tier: Tier): string | null {
  if (tier !== 'free') return null
  const paid = AI_QUOTAS.paid[kind]
  const free = AI_QUOTAS.free[kind]
  if (paid.limit <= free.limit) return null

  const unit = paid.period === 'month' ? '月' : '1日'
  return PAID_PLAN.purchasable
    ? `有料プラン(月額${PAID_PLAN.priceYenPerMonth}円)なら、${unit}${paid.limit}回まで利用できます。`
    : `有料プラン(月額${PAID_PLAN.priceYenPerMonth}円)は準備中です。始まったら、${unit}${paid.limit}回まで利用できる予定です。`
}

// 上限に達したときのメッセージ(残り0回と、リセットの時期を必ず入れる)
export function limitMessage(kind: AiKind, tier: Tier, now: Date = new Date()) {
  const quota = AI_QUOTAS[tier][kind]
  const when = quota.period === 'month' ? '今月' : '今日'
  const base = `${when}の${AI_KIND_LABELS[kind]}の上限(${quota.limit}回)に達しました。${resetLabel(quota.period, now)}にリセットされます。`
  const hint = upgradeHint(kind, tier)
  return hint ? `${base}${hint}` : base
}

// 残り回数の表示用(例: 今月のプラン作成: あと1回(全1回))
export function remainingText(kind: AiKind, tier: Tier, used: number) {
  const quota = AI_QUOTAS[tier][kind]
  const remaining = Math.max(0, quota.limit - used)
  const when = quota.period === 'month' ? '今月' : '今日'
  return `${when}の${AI_KIND_LABELS[kind]}: あと${remaining}回(全${quota.limit}回)`
}
