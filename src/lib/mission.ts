// 今日のミッションと進み具合の計算(純粋な関数だけ。日付はすべて日本時間)
// AIは使わない。ミッションは保存済みプランの weekly(7日分)から取り出す

export type MissionStatus = 'done' | 'rest'

export type WeeklyTask = { day: number; area: string; task: string; minutes: number }

export type MissionLog = {
  mission_date: string // 'YYYY-MM-DD'(日本時間)
  status: MissionStatus
  area: string
  task?: string // 記録した時点のやること(履歴の表示用)
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// 日本時間の日付('YYYY-MM-DD')
export function jstDateString(date: Date): string {
  const d = new Date(date.getTime() + JST_OFFSET_MS)
  return d.toISOString().slice(0, 10)
}

// 'YYYY-MM-DD' を、その日の0時(UTC)の通し日数にする(日数の差を数えるため)
function dayNumber(dateStr: string): number {
  return Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / DAY_MS)
}

export function addDays(dateStr: string, days: number): string {
  return new Date((dayNumber(dateStr) + days) * DAY_MS).toISOString().slice(0, 10)
}

// プラン作成日を1日目として、今日が何日目か(1〜7。8日目は1日目に戻る)
export function dayIndexFor(planCreatedAt: string | Date, now: Date): number {
  const start = dayNumber(jstDateString(new Date(planCreatedAt)))
  const today = dayNumber(jstDateString(now))
  const elapsed = Math.max(0, today - start) // 時計のずれで負になっても1日目にする
  return (elapsed % 7) + 1
}

// 今のサイクル(7日)の開始日('YYYY-MM-DD')
export function cycleStartFor(planCreatedAt: string | Date, now: Date): string {
  const start = jstDateString(new Date(planCreatedAt))
  const elapsed = Math.max(0, dayNumber(jstDateString(now)) - dayNumber(start))
  return addDays(start, Math.floor(elapsed / 7) * 7)
}

// 今日のミッション(weekly の中から、今日の日番号のもの)。なければ null
export function todaysMission(
  weekly: WeeklyTask[],
  planCreatedAt: string | Date,
  now: Date
): { dayIndex: number; task: WeeklyTask } | null {
  const dayIndex = dayIndexFor(planCreatedAt, now)
  const task = weekly.find((w) => w.day === dayIndex)
  return task ? { dayIndex, task } : null
}

export type MissionProgress = {
  weekDone: number // 今のサイクルで「完了」した日数(0〜7)
  weekRest: number // 今のサイクルで「お休み」にした日数
  streak: number // 連続日数(お休みは途切れさせないが増えない)
  totalDone: number // これまでの完了の合計
  byArea: Record<string, number> // 部位ごとの完了数
}

export function computeProgress(logs: MissionLog[], planCreatedAt: string | Date, now: Date): MissionProgress {
  const byDate = new Map(logs.map((l) => [l.mission_date, l]))
  const today = jstDateString(now)

  // 今のサイクル
  const cycleStart = cycleStartFor(planCreatedAt, now)
  let weekDone = 0
  let weekRest = 0
  for (let i = 0; i < 7; i++) {
    const log = byDate.get(addDays(cycleStart, i))
    if (log?.status === 'done') weekDone++
    if (log?.status === 'rest') weekRest++
  }

  // 連続日数:今日が未記録なら昨日から数える(まだ今日が終わっていないので途切れ扱いにしない)
  let cursor = byDate.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (byDate.has(cursor)) {
    if (byDate.get(cursor)?.status === 'done') streak++
    cursor = addDays(cursor, -1)
  }

  const byArea: Record<string, number> = {}
  let totalDone = 0
  for (const l of logs) {
    if (l.status !== 'done') continue
    totalDone++
    byArea[l.area] = (byArea[l.area] ?? 0) + 1
  }

  return { weekDone, weekRest, streak, totalDone, byArea }
}

// 今のサイクルの、N日目(1〜7)の日付
export function dateOfDayInCycle(planCreatedAt: string | Date, now: Date, day: number): string {
  return addDays(cycleStartFor(planCreatedAt, now), day - 1)
}

// 完了したときの一言(固定文。AIではない)
const DONE_MESSAGES = ['いいスタートです!', '今日もひとつ積み上がりました', 'その調子です', 'おつかれさまでした']
export function doneMessage(streak: number) {
  return DONE_MESSAGES[Math.max(0, streak - 1) % DONE_MESSAGES.length]
}
export const REST_MESSAGE = '休むのも大事です。また明日'
