// plans-config(料金プラン・上限・期間の計算)の確認。実行: npm test
import assert from 'node:assert/strict'
import {
  AI_QUOTAS,
  PAID_PLAN,
  limitMessage,
  periodStart,
  remainingText,
  resetLabel,
  tierFromSubscription,
  upgradeHint,
} from '../src/lib/plans-config.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log('  ok  ' + name)
}

console.log('プランごとの上限(方針どおりか)')
test('無料: プラン作成は月1回、AI美容相談は月20回', () => {
  assert.deepEqual(AI_QUOTAS.free.plan, { limit: 1, period: 'month' })
  assert.deepEqual(AI_QUOTAS.free.beauty, { limit: 20, period: 'month' })
})
test('有料: プラン作成は月4回、AI美容相談は月100回、月額680円', () => {
  assert.deepEqual(AI_QUOTAS.paid.plan, { limit: 4, period: 'month' })
  assert.deepEqual(AI_QUOTAS.paid.beauty, { limit: 100, period: 'month' })
  assert.equal(PAID_PLAN.priceYenPerMonth, 680)
})
test('決済は未実装なので、購入できる扱いになっていない', () => {
  assert.equal(PAID_PLAN.purchasable, false)
})

console.log('有料かどうかの判定(tierFromSubscription)')
const now = new Date('2026-10-28T00:00:00Z')
test('行がなければ無料', () => {
  assert.equal(tierFromSubscription(null, now), 'free')
  assert.equal(tierFromSubscription(undefined, now), 'free')
})
test('active かつ期限内なら有料', () => {
  const sub = { plan: 'paid', status: 'active', current_period_end: '2026-11-28T00:00:00Z' }
  assert.equal(tierFromSubscription(sub, now), 'paid')
})
test('期限が過ぎていたら無料', () => {
  const sub = { plan: 'paid', status: 'active', current_period_end: '2026-10-27T23:59:59Z' }
  assert.equal(tierFromSubscription(sub, now), 'free')
})
test('canceled / past_due は無料', () => {
  const end = '2026-11-28T00:00:00Z'
  assert.equal(tierFromSubscription({ plan: 'paid', status: 'canceled', current_period_end: end }, now), 'free')
  assert.equal(tierFromSubscription({ plan: 'paid', status: 'past_due', current_period_end: end }, now), 'free')
})
test('期限がない/不正な値/知らないプランは無料(安全側)', () => {
  assert.equal(tierFromSubscription({ plan: 'paid', status: 'active', current_period_end: null }, now), 'free')
  assert.equal(tierFromSubscription({ plan: 'paid', status: 'active', current_period_end: 'abc' }, now), 'free')
  assert.equal(tierFromSubscription({ plan: 'gold', status: 'active', current_period_end: '2026-11-28T00:00:00Z' }, now), 'free')
})

console.log('日本時間での期間(periodStart / resetLabel)')
test('月の境目: 日本時間の11月1日0時ちょうどで、月が切り替わる', () => {
  assert.equal(periodStart('month', new Date('2026-10-31T14:59:59Z')), '2026-10-01') // 日本時間 10/31 23:59:59
  assert.equal(periodStart('month', new Date('2026-10-31T15:00:00Z')), '2026-11-01') // 日本時間 11/1 0:00:00
})
test('日の境目: 日本時間の0時で、日が切り替わる', () => {
  assert.equal(periodStart('day', new Date('2026-10-27T14:59:59Z')), '2026-10-27')
  assert.equal(periodStart('day', new Date('2026-10-27T15:00:00Z')), '2026-10-28')
})
test('月の途中は、同じ月の1日を返す', () => {
  assert.equal(periodStart('month', new Date('2026-10-15T03:00:00Z')), '2026-10-01')
})
test('リセットの案内: 月は来月1日、12月は1月1日、日は明日', () => {
  assert.equal(resetLabel('month', new Date('2026-10-15T03:00:00Z')), '11月1日 0時(日本時間)')
  assert.equal(resetLabel('month', new Date('2026-12-15T03:00:00Z')), '1月1日 0時(日本時間)')
  assert.equal(resetLabel('day', new Date('2026-10-15T03:00:00Z')), '明日 0時(日本時間)')
})
test('UTCでは10月末でも、日本時間で11月なら「12月1日」を案内する', () => {
  assert.equal(resetLabel('month', new Date('2026-10-31T15:30:00Z')), '12月1日 0時(日本時間)')
})

console.log('表示用の文')
test('上限メッセージに、上限の回数・リセット時期・有料プランの案内(準備中)が入る', () => {
  const msg = limitMessage('plan', 'free', new Date('2026-10-15T03:00:00Z'))
  assert.ok(msg.includes('今月のプラン作成の上限(1回)に達しました'))
  assert.ok(msg.includes('11月1日 0時(日本時間)にリセット'))
  assert.ok(msg.includes('準備中'))
  assert.ok(msg.includes('月4回'))
})
test('購入できない間は「購入できる」ような言い方をしない', () => {
  const hint = upgradeHint('beauty', 'free')
  assert.ok(hint.includes('準備中'))
  assert.ok(!hint.includes('お申し込み') && !hint.includes('購入'))
})
test('有料プランの人には案内を出さない / 上限が同じ機能にも出さない', () => {
  assert.equal(upgradeHint('plan', 'paid'), null)
  assert.equal(upgradeHint('chat', 'free'), null)
})
test('残り回数の文', () => {
  assert.equal(remainingText('plan', 'free', 0), '今月のプラン作成: あと1回(全1回)')
  assert.equal(remainingText('plan', 'free', 1), '今月のプラン作成: あと0回(全1回)')
  assert.equal(remainingText('beauty', 'free', 25), '今月のAI美容相談: あと0回(全20回)') // 超えても負の数にならない
})

console.log(`\n${passed} 件すべて成功`)
