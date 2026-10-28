// plan-patch(調整案の検査・適用・比較)と planWarnings の確認。実行: npm test
import assert from 'node:assert/strict'
import { planWarnings, validatePlan } from '../src/lib/plan-schema.ts'
import { applyPatch, diffPlans, parsePatchReply, validatePatch } from '../src/lib/plan-patch.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log('  ok  ' + name)
}

const action = (title, extra = {}) => ({
  title, detail: `${title}のやり方`, minutes: 5, cost_yen: 500, frequency: '毎日', ...extra,
})
const basePlan = () => ({
  summary: '要約',
  vibe: { title: '雰囲気', keywords: ['a', 'b', 'c'] },
  elements: [
    { area: '肌', priority: 1, why: '理由', actions: [action('保湿'), action('日焼け止め')] },
    { area: '眉', priority: 2, why: '理由', actions: [action('眉を整える', { frequency: '週1回' })] },
  ],
  weekly: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, area: '肌', task: `タスク${day}`, minutes: 5 })),
  notes: '注意書き',
})
const plan = () => validatePlan(basePlan()).value

console.log('parsePatchReply / validatePatch')
test('正しい patch を読める(コードブロックや前置きがあってもよい)', () => {
  const reply = '```json\n' + JSON.stringify({ message: '夜だけにしました', changes: [{ op: 'remove_action', element: 0, action_index: 1 }] }) + '\n```'
  const r = parsePatchReply(reply)
  assert.equal(r.ok, true)
  assert.equal(r.value.changes.length, 1)
})
test('変更が0件でも読める(ひと言だけの返事)', () => {
  const r = parsePatchReply(JSON.stringify({ message: '専門家に相談してください', changes: [] }))
  assert.equal(r.ok, true)
  assert.equal(r.value.changes.length, 0)
})
test('許可されていない操作(op)は止まる', () => {
  const r = validatePatch({ message: 'x', changes: [{ op: 'delete_plan' }] })
  assert.equal(r.ok, false)
  assert.equal(validatePatch({ message: 'x', changes: [{ op: 'replace_element', element: 0 }] }).ok, false)
})
test('変更が7件以上、messageなし、JSONでない返事は止まる', () => {
  const many = Array.from({ length: 7 }, () => ({ op: 'remove_action', element: 0, action_index: 0 }))
  assert.equal(validatePatch({ message: 'x', changes: many }).ok, false)
  assert.equal(validatePatch({ changes: [] }).ok, false)
  assert.equal(parsePatchReply('調整案はありません').ok, false)
  assert.equal(parsePatchReply('{ 壊れたJSON').ok, false)
})
test('番号が小数・文字だと止まる', () => {
  assert.equal(validatePatch({ message: 'x', changes: [{ op: 'remove_action', element: 0.5, action_index: 0 }] }).ok, false)
  assert.equal(validatePatch({ message: 'x', changes: [{ op: 'remove_action', element: '0', action_index: 0 }] }).ok, false)
})
test('messageは120文字に切り詰められる', () => {
  const r = validatePatch({ message: 'あ'.repeat(300), changes: [] })
  assert.equal(r.value.message.length, 120)
})

console.log('applyPatch(元のプランは変えない)')
test('行動の差し替え・追加・削除・週間の差し替えが適用される', () => {
  const p = plan()
  const patch = {
    message: 'm',
    changes: [
      { op: 'replace_action', element: 0, action_index: 0, action: action('夜だけ保湿', { minutes: 2 }) },
      { op: 'add_action', element: 1, action: action('眉マスカラ') },
      { op: 'remove_action', element: 0, action_index: 1 },
      { op: 'replace_weekly', day: 3, area: '眉', task: '眉を整える', minutes: 3 },
    ],
  }
  const r = applyPatch(p, patch)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.elements[0].actions.map((a) => a.title), ['夜だけ保湿'])
  assert.deepEqual(r.value.elements[1].actions.map((a) => a.title), ['眉を整える', '眉マスカラ'])
  assert.equal(r.value.weekly[2].task, '眉を整える')
  assert.equal(r.value.weekly[2].day, 3)
})
test('適用しても、元のプラン(引数)は書き換わらない', () => {
  const p = plan()
  const snapshot = JSON.stringify(p)
  applyPatch(p, { message: 'm', changes: [{ op: 'remove_action', element: 0, action_index: 0 }] })
  assert.equal(JSON.stringify(p), snapshot)
})
test('存在しない要素・行動・日を指すと止まる', () => {
  const p = plan()
  assert.equal(applyPatch(p, { message: 'm', changes: [{ op: 'remove_action', element: 9, action_index: 0 }] }).ok, false)
  assert.equal(applyPatch(p, { message: 'm', changes: [{ op: 'remove_action', element: 0, action_index: 5 }] }).ok, false)
  assert.equal(applyPatch(p, { message: 'm', changes: [{ op: 'replace_weekly', day: 9, area: '肌', task: 't', minutes: 1 }] }).ok, false)
})
test('適用後の検査(validatePlan)で、許可外の部位・行動の全削除が止まる', () => {
  const p = plan()
  const badArea = applyPatch(p, { message: 'm', changes: [{ op: 'replace_weekly', day: 1, area: '整形', task: 't', minutes: 1 }] })
  assert.equal(validatePlan(badArea.value).ok, false)
  const emptied = applyPatch(p, { message: 'm', changes: [{ op: 'remove_action', element: 1, action_index: 0 }] })
  assert.equal(validatePlan(emptied.value).ok, false) // 眉の行動が0件になる
})
test('行動が5つ以上になる追加は、検査で止まる', () => {
  const p = plan()
  const adds = Array.from({ length: 3 }, (_, i) => ({ op: 'add_action', element: 0, action: action(`追加${i}`) }))
  const r = applyPatch(p, { message: 'm', changes: adds }) // 2+3=5件
  assert.equal(validatePlan(r.value).ok, false)
})

console.log('diffPlans(変更前/変更後)')
test('差し替えは「変更」1件にまとまる', () => {
  const before = plan()
  const after = validatePlan(applyPatch(before, { message: 'm', changes: [
    { op: 'replace_action', element: 0, action_index: 0, action: action('夜だけ保湿', { minutes: 2 }) },
  ] }).value).value
  const diff = diffPlans(before, after)
  assert.equal(diff.length, 1)
  assert.equal(diff[0].kind, 'changed')
  assert.ok(diff[0].before.includes('保湿') && diff[0].after.includes('夜だけ保湿'))
})
test('同じ名前で内容だけ変えたものは「変更」、追加・削除はそれぞれ表示される', () => {
  const before = plan()
  const after = validatePlan(applyPatch(before, { message: 'm', changes: [
    { op: 'replace_action', element: 0, action_index: 0, action: action('保湿', { minutes: 1 }) },
    { op: 'add_action', element: 1, action: action('眉マスカラ') },
    { op: 'remove_action', element: 0, action_index: 1 },
  ] }).value).value
  const kinds = diffPlans(before, after).map((d) => d.kind).sort()
  assert.deepEqual(kinds, ['added', 'changed', 'removed'])
})
test('週間プランの変更が出る / 変更がなければ空', () => {
  const before = plan()
  const after = validatePlan(applyPatch(before, { message: 'm', changes: [
    { op: 'replace_weekly', day: 2, area: '眉', task: '眉を整える', minutes: 3 },
  ] }).value).value
  const diff = diffPlans(before, after)
  assert.equal(diff.length, 1)
  assert.equal(diff[0].label, '週間プラン 2日目')
  assert.deepEqual(diffPlans(before, before), [])
})

console.log('planWarnings(予算・時間の注意書き)')
test('予算内・時間内なら注意書きなし', () => {
  assert.deepEqual(planWarnings(plan(), { monthly_budget: '10000', daily_minutes: 15 }), [])
})
test('予算を超えると注意書きが出る / 「気にしない」なら出ない', () => {
  const expensive = basePlan()
  expensive.elements[0].actions[0].cost_yen = 4000 // 合計 4000+500+500 = 5000円
  const p = validatePlan(expensive).value
  const w = planWarnings(p, { monthly_budget: '3000', daily_minutes: null })
  assert.equal(w.length, 1)
  assert.ok(w[0].includes('5,000円') && w[0].includes('予算'))
  assert.deepEqual(planWarnings(p, { monthly_budget: 'none', daily_minutes: null }), [])
  assert.deepEqual(planWarnings(p, { monthly_budget: '10000', daily_minutes: null }), [])
})
test('毎日やる行動の合計が1日の時間を超えると出る', () => {
  const p = plan() // 毎日: 保湿5 + 日焼け止め5 = 10分
  assert.equal(planWarnings(p, { monthly_budget: null, daily_minutes: 5 }).length >= 1, true)
  assert.deepEqual(planWarnings(p, { monthly_budget: 'none', daily_minutes: null }), [])
})

console.log(`\n${passed} 件すべて成功`)
