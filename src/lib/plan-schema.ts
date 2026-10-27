// 「憧れ → 行動プラン」の型と検査。AIが返したJSONは、ここを通ったものだけを保存・表示する

export const AREAS = ['髪', '眉', '肌', 'メイク', '服', '姿勢', '体型', '清潔感'] as const
export type Area = (typeof AREAS)[number]

export const MONTHLY_BUDGETS = [
  { value: '3000', label: '3,000円以下', yen: 3000 },
  { value: '5000', label: '〜5,000円', yen: 5000 },
  { value: '10000', label: '〜10,000円', yen: 10000 },
  { value: '20000', label: '〜20,000円', yen: 20000 },
  { value: 'none', label: '気にしない', yen: null },
] as const
export type MonthlyBudget = (typeof MONTHLY_BUDGETS)[number]['value']

export const DAILY_MINUTES = [5, 15, 30, 60] as const

export const IDEAL_EXAMPLES = [
  'K-POPアイドルっぽい',
  '韓国っぽい透明感',
  '清潔感のある大人',
  'ナチュラルでおしゃれ',
] as const

export const IDEAL_LIMITS = { idealText: 100, concerns: 500, preferences: 500 } as const

// ---- ヒアリングの答え ----------------------------------------------------

export type IdealInput = {
  ideal_text: string
  focus_areas: Area[]
  concerns: string | null
  monthly_budget: MonthlyBudget | null
  daily_minutes: (typeof DAILY_MINUTES)[number] | null
  preferences: string | null
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

function optionalText(value: unknown, max: number, label: string): Result<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, error: `${label}の形式が正しくありません` }
  const text = value.trim()
  if (text.length > max) return { ok: false, error: `${label}は${max}文字以内で入力してください` }
  return { ok: true, value: text === '' ? null : text }
}

export function validateIdealInput(raw: unknown): Result<IdealInput> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '入力が正しくありません' }
  const r = raw as Record<string, unknown>

  if (typeof r.ideal_text !== 'string' || r.ideal_text.trim() === '') {
    return { ok: false, error: '憧れの雰囲気を入力してください' }
  }
  const idealText = r.ideal_text.trim()
  if (idealText.length > IDEAL_LIMITS.idealText) {
    return { ok: false, error: `憧れの雰囲気は${IDEAL_LIMITS.idealText}文字以内で入力してください` }
  }

  const focusRaw = r.focus_areas ?? []
  if (!Array.isArray(focusRaw) || focusRaw.length > AREAS.length) {
    return { ok: false, error: '取り組みたい部分の指定が正しくありません' }
  }
  const focusAreas: Area[] = []
  for (const a of focusRaw) {
    if (!(AREAS as readonly unknown[]).includes(a)) {
      return { ok: false, error: '取り組みたい部分の指定が正しくありません' }
    }
    if (!focusAreas.includes(a as Area)) focusAreas.push(a as Area)
  }

  const concerns = optionalText(r.concerns, IDEAL_LIMITS.concerns, '悩み')
  if (!concerns.ok) return concerns
  const preferences = optionalText(r.preferences, IDEAL_LIMITS.preferences, '好み・生活')
  if (!preferences.ok) return preferences

  let monthlyBudget: MonthlyBudget | null = null
  if (r.monthly_budget !== undefined && r.monthly_budget !== null) {
    if (!MONTHLY_BUDGETS.some((b) => b.value === r.monthly_budget)) {
      return { ok: false, error: '予算の指定が正しくありません' }
    }
    monthlyBudget = r.monthly_budget as MonthlyBudget
  }

  let dailyMinutes: IdealInput['daily_minutes'] = null
  if (r.daily_minutes !== undefined && r.daily_minutes !== null) {
    if (!(DAILY_MINUTES as readonly unknown[]).includes(r.daily_minutes)) {
      return { ok: false, error: '使える時間の指定が正しくありません' }
    }
    dailyMinutes = r.daily_minutes as IdealInput['daily_minutes']
  }

  return {
    ok: true,
    value: {
      ideal_text: idealText,
      focus_areas: focusAreas,
      concerns: concerns.value,
      monthly_budget: monthlyBudget,
      daily_minutes: dailyMinutes,
      preferences: preferences.value,
    },
  }
}

// ---- AIが作るプラン ------------------------------------------------------

export type PlanAction = {
  title: string
  detail: string
  minutes: number
  cost_yen: number | null // 1か月あたりの目安費用(円)。かからなければ0、不明ならnull
  frequency: string
}

export type PlanElement = {
  area: Area
  priority: 1 | 2 | 3 | null // 1が「まずここから」
  why: string
  actions: PlanAction[]
}

export type PlanWeeklyTask = {
  day: number // 1〜7
  area: Area
  task: string
  minutes: number
}

export type PlanContent = {
  summary: string
  vibe: { title: string; keywords: string[] }
  elements: PlanElement[]
  weekly: PlanWeeklyTask[]
  notes: string
}

function text(value: unknown, max: number, path: string): Result<string> {
  if (typeof value !== 'string') return { ok: false, error: `${path} が文字ではありません` }
  const t = value.trim()
  if (t === '') return { ok: false, error: `${path} が空です` }
  // AIの出力は長すぎても止めずに切り詰める(構造の誤りだけを不正として扱う)
  return { ok: true, value: t.length > max ? t.slice(0, max) : t }
}

function whole(value: unknown, min: number, max: number, path: string): Result<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: `${path} が数値ではありません` }
  }
  const n = Math.round(value)
  if (n < min || n > max) return { ok: false, error: `${path} が範囲外です` }
  return { ok: true, value: n }
}

function area(value: unknown, path: string): Result<Area> {
  if (!(AREAS as readonly unknown[]).includes(value)) {
    return { ok: false, error: `${path} が許可された部位ではありません` }
  }
  return { ok: true, value: value as Area }
}

export function validatePlan(raw: unknown): Result<PlanContent> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'プランがオブジェクトではありません' }
  const r = raw as Record<string, unknown>

  const summary = text(r.summary, 80, 'summary')
  if (!summary.ok) return summary
  const notes = text(r.notes, 150, 'notes')
  if (!notes.ok) return notes

  // vibe
  const vibeRaw = r.vibe as Record<string, unknown> | undefined
  if (!vibeRaw || typeof vibeRaw !== 'object') return { ok: false, error: 'vibe がありません' }
  const vibeTitle = text(vibeRaw.title, 40, 'vibe.title')
  if (!vibeTitle.ok) return vibeTitle
  if (!Array.isArray(vibeRaw.keywords) || vibeRaw.keywords.length < 3 || vibeRaw.keywords.length > 5) {
    return { ok: false, error: 'vibe.keywords は3〜5個にしてください' }
  }
  const keywords: string[] = []
  for (const [i, k] of vibeRaw.keywords.entries()) {
    const kw = text(k, 20, `vibe.keywords[${i}]`)
    if (!kw.ok) return kw
    keywords.push(kw.value)
  }

  // elements
  if (!Array.isArray(r.elements) || r.elements.length < 2 || r.elements.length > 5) {
    return { ok: false, error: 'elements は2〜5件にしてください' }
  }
  const elements: PlanElement[] = []
  for (const [i, e] of r.elements.entries()) {
    const p = `elements[${i}]`
    if (!e || typeof e !== 'object') return { ok: false, error: `${p} が正しくありません` }
    const er = e as Record<string, unknown>

    const a = area(er.area, `${p}.area`)
    if (!a.ok) return a
    const why = text(er.why, 200, `${p}.why`)
    if (!why.ok) return why

    let priority: PlanElement['priority'] = null
    if (er.priority !== null && er.priority !== undefined) {
      const pr = whole(er.priority, 1, 3, `${p}.priority`)
      if (!pr.ok) return pr
      priority = pr.value as 1 | 2 | 3
    }

    if (!Array.isArray(er.actions) || er.actions.length < 1 || er.actions.length > 4) {
      return { ok: false, error: `${p}.actions は1〜4件にしてください` }
    }
    const actions: PlanAction[] = []
    for (const [j, act] of er.actions.entries()) {
      const ap = `${p}.actions[${j}]`
      if (!act || typeof act !== 'object') return { ok: false, error: `${ap} が正しくありません` }
      const ar = act as Record<string, unknown>

      const title = text(ar.title, 40, `${ap}.title`)
      if (!title.ok) return title
      const detail = text(ar.detail, 200, `${ap}.detail`)
      if (!detail.ok) return detail
      const frequency = text(ar.frequency, 40, `${ap}.frequency`)
      if (!frequency.ok) return frequency
      const minutes = whole(ar.minutes, 0, 240, `${ap}.minutes`)
      if (!minutes.ok) return minutes

      let cost: number | null = null
      if (ar.cost_yen !== null && ar.cost_yen !== undefined) {
        const c = whole(ar.cost_yen, 0, 200000, `${ap}.cost_yen`)
        if (!c.ok) return c
        cost = c.value
      }

      actions.push({
        title: title.value,
        detail: detail.value,
        minutes: minutes.value,
        cost_yen: cost,
        frequency: frequency.value,
      })
    }

    elements.push({ area: a.value, priority, why: why.value, actions })
  }

  // weekly(1〜7日を1回ずつ)
  if (!Array.isArray(r.weekly) || r.weekly.length !== 7) {
    return { ok: false, error: 'weekly は7件にしてください' }
  }
  const weekly: PlanWeeklyTask[] = []
  const seenDays = new Set<number>()
  for (const [i, w] of r.weekly.entries()) {
    const p = `weekly[${i}]`
    if (!w || typeof w !== 'object') return { ok: false, error: `${p} が正しくありません` }
    const wr = w as Record<string, unknown>

    const day = whole(wr.day, 1, 7, `${p}.day`)
    if (!day.ok) return day
    if (seenDays.has(day.value)) return { ok: false, error: `${p}.day が重複しています` }
    seenDays.add(day.value)

    const a = area(wr.area, `${p}.area`)
    if (!a.ok) return a
    const task = text(wr.task, 100, `${p}.task`)
    if (!task.ok) return task
    const minutes = whole(wr.minutes, 0, 240, `${p}.minutes`)
    if (!minutes.ok) return minutes

    weekly.push({ day: day.value, area: a.value, task: task.value, minutes: minutes.value })
  }
  weekly.sort((x, y) => x.day - y.day)

  return {
    ok: true,
    value: {
      summary: summary.value,
      vibe: { title: vibeTitle.value, keywords },
      elements,
      weekly,
      notes: notes.value,
    },
  }
}

// 1か月あたりの目安費用の合計(円)。cost_yen が null の行動は含めず、いくつ不明だったかも返す
export function totalMonthlyCost(plan: PlanContent) {
  let total = 0
  let unknown = 0
  for (const el of plan.elements) {
    for (const act of el.actions) {
      if (act.cost_yen === null) unknown++
      else total += act.cost_yen
    }
  }
  return { total, unknown }
}
