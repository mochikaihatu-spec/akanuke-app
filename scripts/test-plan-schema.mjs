// plan-schema の検査が正しく働くかの確認。実行: npm test
import assert from 'node:assert/strict'
import { validateIdealInput, validatePlan, totalMonthlyCost } from '../src/lib/plan-schema.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log('  ok  ' + name)
}

const goodPlan = () => ({
  summary: '眉と肌を整えるだけで、透明感のある雰囲気に近づきます',
  vibe: { title: '透明感のある清潔感スタイル', keywords: ['透明感', '清潔感', 'ナチュラル'] },
  elements: [
    {
      area: '眉',
      priority: 1,
      why: '眉の形が整うと、顔全体の印象が引き締まります',
      actions: [
        { title: '眉の余分な毛を整える', detail: 'まずは眉の下側だけを軽く整えます', minutes: 5, cost_yen: 500, frequency: '週1回' },
      ],
    },
    {
      area: '肌',
      priority: 2,
      why: '肌のうるおいは、透明感の土台になります',
      actions: [
        { title: '保湿を朝晩続ける', detail: '化粧水と乳液で保湿します', minutes: 5, cost_yen: null, frequency: '毎日' },
        { title: '日焼け止めを塗る', detail: '外出前に顔と首に塗ります', minutes: 2, cost_yen: 800, frequency: '毎日' },
      ],
    },
  ],
  weekly: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, area: '肌', task: '保湿を丁寧に行う', minutes: 5 })),
  notes: '肌トラブルが続く場合は皮膚科などの専門家に相談してください',
})

console.log('validatePlan')
test('正しいプランは通る', () => {
  const r = validatePlan(goodPlan())
  assert.equal(r.ok, true)
  assert.equal(r.value.weekly.length, 7)
})
test('文字列は前後の空白が消え、長すぎる文字は切り詰められる', () => {
  const p = goodPlan()
  p.summary = '  ' + 'あ'.repeat(200) + '  '
  const r = validatePlan(p)
  assert.equal(r.ok, true)
  assert.equal(r.value.summary.length, 80)
})
test('数値は四捨五入される', () => {
  const p = goodPlan()
  p.elements[0].actions[0].minutes = 4.6
  const r = validatePlan(p)
  assert.equal(r.ok, true)
  assert.equal(r.value.elements[0].actions[0].minutes, 5)
})
test('nullやオブジェクトでない値は止まる', () => {
  assert.equal(validatePlan(null).ok, false)
  assert.equal(validatePlan('文字').ok, false)
  assert.equal(validatePlan([]).ok, false)
})
test('許可されていない部位は止まる(整形などを混ぜられない)', () => {
  const p = goodPlan()
  p.elements[0].area = '整形'
  assert.equal(validatePlan(p).ok, false)
})
test('weeklyが7件でない/日が重複すると止まる', () => {
  const p = goodPlan()
  p.weekly.pop()
  assert.equal(validatePlan(p).ok, false)
  const q = goodPlan()
  q.weekly[1].day = 1
  assert.equal(validatePlan(q).ok, false)
})
test('elementsが1件、actionsが0件だと止まる', () => {
  const p = goodPlan()
  p.elements.pop()
  assert.equal(validatePlan(p).ok, false)
  const q = goodPlan()
  q.elements[0].actions = []
  assert.equal(validatePlan(q).ok, false)
})
test('キーワードが2個だと止まる', () => {
  const p = goodPlan()
  p.vibe.keywords = ['透明感', '清潔感']
  assert.equal(validatePlan(p).ok, false)
})
test('費用が範囲外/文字だと止まる', () => {
  const p = goodPlan()
  p.elements[0].actions[0].cost_yen = 9999999
  assert.equal(validatePlan(p).ok, false)
  const q = goodPlan()
  q.elements[0].actions[0].cost_yen = '500円'
  assert.equal(validatePlan(q).ok, false)
})
test('priorityが範囲外だと止まる(nullは通る)', () => {
  const p = goodPlan()
  p.elements[0].priority = 5
  assert.equal(validatePlan(p).ok, false)
  const q = goodPlan()
  q.elements[0].priority = null
  assert.equal(validatePlan(q).ok, true)
})
test('余計なキー(<script>など)は結果に残らない', () => {
  const p = goodPlan()
  p.evil = '<script>alert(1)</script>'
  p.elements[0].evil = 'x'
  const r = validatePlan(p)
  assert.equal(r.ok, true)
  assert.equal('evil' in r.value, false)
  assert.equal('evil' in r.value.elements[0], false)
})

console.log('totalMonthlyCost')
test('費用の合計と、不明な件数を数える', () => {
  const r = validatePlan(goodPlan())
  assert.deepEqual(totalMonthlyCost(r.value), { total: 1300, unknown: 1 })
})

console.log('validateIdealInput')
const goodIdeal = () => ({
  ideal_text: 'K-POPアイドルっぽい',
  focus_areas: ['髪', '眉'],
  concerns: '  肌荒れが気になる ',
  monthly_budget: '5000',
  daily_minutes: 15,
  preferences: '',
})
test('正しい入力は通り、空文字はnullになる', () => {
  const r = validateIdealInput(goodIdeal())
  assert.equal(r.ok, true)
  assert.equal(r.value.concerns, '肌荒れが気になる')
  assert.equal(r.value.preferences, null)
})
test('憧れが空/101文字だと止まる', () => {
  assert.equal(validateIdealInput({ ...goodIdeal(), ideal_text: '   ' }).ok, false)
  assert.equal(validateIdealInput({ ...goodIdeal(), ideal_text: 'あ'.repeat(101) }).ok, false)
})
test('許可されていない部位・予算・時間は止まる', () => {
  assert.equal(validateIdealInput({ ...goodIdeal(), focus_areas: ['整形'] }).ok, false)
  assert.equal(validateIdealInput({ ...goodIdeal(), monthly_budget: '999999' }).ok, false)
  assert.equal(validateIdealInput({ ...goodIdeal(), daily_minutes: 999 }).ok, false)
})
test('悩みが501文字だと止まる', () => {
  assert.equal(validateIdealInput({ ...goodIdeal(), concerns: 'あ'.repeat(501) }).ok, false)
})
test('部位の重複は1つにまとまる', () => {
  const r = validateIdealInput({ ...goodIdeal(), focus_areas: ['髪', '髪', '眉'] })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.focus_areas, ['髪', '眉'])
})

console.log(`\n${passed} 件すべて成功`)
