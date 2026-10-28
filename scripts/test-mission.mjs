// mission.ts(今日のミッション・連続日数・今週の集計)の確認。実行: npm test
import assert from 'node:assert/strict'
import {
  addDays,
  computeProgress,
  cycleStartFor,
  dateOfDayInCycle,
  dayIndexFor,
  jstDateString,
  todaysMission,
} from '../src/lib/mission.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log('  ok  ' + name)
}

// 日本時間の「日付 時:分」から Date を作る(日本時間=UTC+9)
const jst = (s) => new Date(`${s.replace(' ', 'T')}:00+09:00`)

const created = jst('2026-10-20 23:30') // プラン作成:日本時間 10/20 の夜

console.log('日本時間の日付 / 何日目か')
test('UTCでは前日でも、日本時間の日付で数える', () => {
  assert.equal(jstDateString(new Date('2026-10-20T15:00:00Z')), '2026-10-21')
  assert.equal(jstDateString(new Date('2026-10-20T14:59:59Z')), '2026-10-20')
})
test('作成した日が1日目、翌日が2日目(夜に作っても翌0時で2日目)', () => {
  assert.equal(dayIndexFor(created, jst('2026-10-20 23:59')), 1)
  assert.equal(dayIndexFor(created, jst('2026-10-21 00:00')), 2)
})
test('7日目の次は、1日目に戻る', () => {
  assert.equal(dayIndexFor(created, jst('2026-10-26 12:00')), 7)
  assert.equal(dayIndexFor(created, jst('2026-10-27 00:00')), 1)
  assert.equal(dayIndexFor(created, jst('2026-11-03 12:00')), 1) // 15日目
})
test('時計がずれて作成日より前でも、1日目になる', () => {
  assert.equal(dayIndexFor(created, jst('2026-10-19 12:00')), 1)
})
test('月をまたぐ日付の計算', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})
test('サイクルの開始日と、N日目の日付', () => {
  assert.equal(cycleStartFor(created, jst('2026-10-22 10:00')), '2026-10-20')
  assert.equal(cycleStartFor(created, jst('2026-10-28 10:00')), '2026-10-27')
  assert.equal(dateOfDayInCycle(created, jst('2026-10-22 10:00'), 3), '2026-10-22')
})

console.log('今日のミッション')
const weekly = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, area: '肌', task: `タスク${day}`, minutes: 5 }))
test('その日の番号のタスクが出る', () => {
  const m = todaysMission(weekly, created, jst('2026-10-22 08:00'))
  assert.equal(m.dayIndex, 3)
  assert.equal(m.task.task, 'タスク3')
})
test('該当する日がなければ null', () => {
  assert.equal(todaysMission(weekly.slice(0, 2), created, jst('2026-10-26 08:00')), null)
})

console.log('進み具合(computeProgress)')
const log = (date, status = 'done', area = '肌') => ({ mission_date: date, status, area })

test('記録がなければすべて 0', () => {
  const p = computeProgress([], created, jst('2026-10-22 10:00'))
  assert.deepEqual(p, { weekDone: 0, weekRest: 0, streak: 0, totalDone: 0, byArea: {} })
})
test('連続日数:今日を含めて連続していれば数える', () => {
  const logs = [log('2026-10-20'), log('2026-10-21'), log('2026-10-22')]
  assert.equal(computeProgress(logs, created, jst('2026-10-22 10:00')).streak, 3)
})
test('今日が未記録でも、昨日までの連続は途切れない', () => {
  const logs = [log('2026-10-20'), log('2026-10-21')]
  assert.equal(computeProgress(logs, created, jst('2026-10-22 10:00')).streak, 2)
})
test('昨日も今日も未記録なら 0(途切れた)', () => {
  const logs = [log('2026-10-20')]
  assert.equal(computeProgress(logs, created, jst('2026-10-22 10:00')).streak, 0)
})
test('お休みは連続を途切れさせず、数は増えない', () => {
  const logs = [log('2026-10-20'), log('2026-10-21', 'rest'), log('2026-10-22')]
  assert.equal(computeProgress(logs, created, jst('2026-10-22 10:00')).streak, 2)
})
test('間が1日空くと、そこで途切れる', () => {
  const logs = [log('2026-10-20'), log('2026-10-22'), log('2026-10-23')]
  assert.equal(computeProgress(logs, created, jst('2026-10-23 10:00')).streak, 2)
})
test('今週の完了数は、今のサイクルの分だけ(前のサイクルは含めない)', () => {
  const logs = [log('2026-10-25'), log('2026-10-26'), log('2026-10-27'), log('2026-10-28', 'rest')]
  const p = computeProgress(logs, created, jst('2026-10-28 10:00')) // サイクル開始 10/27
  assert.equal(p.weekDone, 1)
  assert.equal(p.weekRest, 1)
  assert.equal(p.totalDone, 3)
})
test('部位ごとの完了数(お休みは数えない)', () => {
  const logs = [log('2026-10-20', 'done', '髪'), log('2026-10-21', 'done', '髪'), log('2026-10-22', 'done', '眉'), log('2026-10-23', 'rest', '眉')]
  assert.deepEqual(computeProgress(logs, created, jst('2026-10-23 10:00')).byArea, { 髪: 2, 眉: 1 })
})
test('月をまたぐ連続も数えられる', () => {
  const c = jst('2026-10-29 09:00')
  const logs = [log('2026-10-30'), log('2026-10-31'), log('2026-11-01'), log('2026-11-02')]
  assert.equal(computeProgress(logs, c, jst('2026-11-02 12:00')).streak, 4)
})

console.log(`\n${passed} 件すべて成功`)
