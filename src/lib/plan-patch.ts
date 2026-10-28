// AIが返す「プランの調整案(差分)」の読み取り・適用・変更前後の比較。
// ここは形の確認と適用だけ。適用した結果のプランは、呼び出し側で必ず validatePlan にかけること。
import type { PlanAction, PlanContent } from '@/lib/plan-schema'

export type PatchChange =
  | { op: 'replace_action'; element: number; action_index: number; action: Record<string, unknown> }
  | { op: 'add_action'; element: number; action: Record<string, unknown> }
  | { op: 'remove_action'; element: number; action_index: number }
  | { op: 'replace_weekly'; day: number; area: string; task: string; minutes: number }

export type Patch = { message: string; changes: PatchChange[] }

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export const PATCH_LIMITS = { message: 120, maxChanges: 6 } as const

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v)

// 保存済みの patch(JSON)や、AIの返事を解析した結果を検査する
export function validatePatch(raw: unknown): Result<Patch> {
  if (!isObject(raw)) return { ok: false, error: 'patch がオブジェクトではありません' }

  if (typeof raw.message !== 'string' || raw.message.trim() === '') {
    return { ok: false, error: 'message がありません' }
  }
  const message = raw.message.trim().slice(0, PATCH_LIMITS.message)

  if (!Array.isArray(raw.changes) || raw.changes.length > PATCH_LIMITS.maxChanges) {
    return { ok: false, error: `changes は${PATCH_LIMITS.maxChanges}件以内の配列にしてください` }
  }

  const changes: PatchChange[] = []
  for (const [i, c] of raw.changes.entries()) {
    const p = `changes[${i}]`
    if (!isObject(c)) return { ok: false, error: `${p} が正しくありません` }

    switch (c.op) {
      case 'replace_action':
        if (!isInt(c.element) || !isInt(c.action_index) || !isObject(c.action)) {
          return { ok: false, error: `${p} (replace_action) の指定が正しくありません` }
        }
        changes.push({ op: 'replace_action', element: c.element, action_index: c.action_index, action: c.action })
        break
      case 'add_action':
        if (!isInt(c.element) || !isObject(c.action)) {
          return { ok: false, error: `${p} (add_action) の指定が正しくありません` }
        }
        changes.push({ op: 'add_action', element: c.element, action: c.action })
        break
      case 'remove_action':
        if (!isInt(c.element) || !isInt(c.action_index)) {
          return { ok: false, error: `${p} (remove_action) の指定が正しくありません` }
        }
        changes.push({ op: 'remove_action', element: c.element, action_index: c.action_index })
        break
      case 'replace_weekly':
        if (!isInt(c.day) || typeof c.area !== 'string' || typeof c.task !== 'string' || typeof c.minutes !== 'number') {
          return { ok: false, error: `${p} (replace_weekly) の指定が正しくありません` }
        }
        changes.push({ op: 'replace_weekly', day: c.day, area: c.area, task: c.task, minutes: c.minutes })
        break
      default:
        return { ok: false, error: `${p} の op が許可されていません` }
    }
  }

  return { ok: true, value: { message, changes } }
}

// AIの返事(文字)から patch を取り出す(コードブロックや前置きがあっても、最初の { から最後の } までを読む)
export function parsePatchReply(rawText: string): Result<Patch> {
  const start = rawText.indexOf('{')
  const end = rawText.lastIndexOf('}')
  if (start === -1 || end <= start) return { ok: false, error: 'JSONが見つかりません' }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText.slice(start, end + 1))
  } catch {
    return { ok: false, error: 'JSONとして読めません' }
  }
  return validatePatch(parsed)
}

// プランの複製に patch を適用する(元のプランは変えない)。結果は未検査なので validatePlan にかけること
export function applyPatch(plan: PlanContent, patch: Patch): Result<unknown> {
  const next = JSON.parse(JSON.stringify(plan)) as {
    elements: { actions: unknown[] }[]
    weekly: { day: number; area: string; task: string; minutes: number }[]
  }

  for (const [i, c] of patch.changes.entries()) {
    const p = `changes[${i}]`

    if (c.op === 'replace_weekly') {
      const target = next.weekly.find((w) => w.day === c.day)
      if (!target) return { ok: false, error: `${p}: ${c.day}日目が見つかりません` }
      target.area = c.area
      target.task = c.task
      target.minutes = c.minutes
      continue
    }

    const element = next.elements[c.element]
    if (!element) return { ok: false, error: `${p}: element ${c.element} が見つかりません` }

    if (c.op === 'add_action') {
      element.actions.push(c.action)
      continue
    }

    if (c.action_index < 0 || c.action_index >= element.actions.length) {
      return { ok: false, error: `${p}: action_index ${c.action_index} が見つかりません` }
    }
    if (c.op === 'replace_action') element.actions[c.action_index] = c.action
    else element.actions.splice(c.action_index, 1)
  }

  return { ok: true, value: next }
}

// ---- 変更前/変更後の比較(画面に出す) -----------------------------------------

export type DiffItem = {
  kind: 'changed' | 'added' | 'removed'
  label: string
  before: string | null
  after: string | null
}

function costText(a: PlanAction) {
  return a.cost_yen === null ? '費用は目安なし' : a.cost_yen === 0 ? '無料' : `月${a.cost_yen.toLocaleString('ja-JP')}円`
}

export function describeAction(a: PlanAction) {
  return `${a.title}\n${a.detail}\n${a.frequency}・約${a.minutes}分・${costText(a)}`
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function diffPlans(before: PlanContent, after: PlanContent): DiffItem[] {
  const items: DiffItem[] = []

  for (const [i, afterEl] of after.elements.entries()) {
    const beforeEl = before.elements[i]
    if (!beforeEl) continue

    const beforeByTitle = new Map(beforeEl.actions.map((a) => [a.title, a]))
    const afterByTitle = new Map(afterEl.actions.map((a) => [a.title, a]))

    const changed: DiffItem[] = []
    const removed = beforeEl.actions.filter((a) => !afterByTitle.has(a.title))
    const added = afterEl.actions.filter((a) => !beforeByTitle.has(a.title))

    for (const a of afterEl.actions) {
      const old = beforeByTitle.get(a.title)
      if (old && !same(old, a)) {
        changed.push({ kind: 'changed', label: `${afterEl.area}｜${a.title}`, before: describeAction(old), after: describeAction(a) })
      }
    }

    // 1つ消えて1つ増えたときは、「差し替え」として1つにまとめて見せる
    if (removed.length === 1 && added.length === 1) {
      changed.push({
        kind: 'changed',
        label: `${afterEl.area}｜${removed[0].title}`,
        before: describeAction(removed[0]),
        after: describeAction(added[0]),
      })
    } else {
      for (const a of removed) {
        changed.push({ kind: 'removed', label: `${afterEl.area}｜${a.title}`, before: describeAction(a), after: null })
      }
      for (const a of added) {
        changed.push({ kind: 'added', label: `${afterEl.area}｜${a.title}`, before: null, after: describeAction(a) })
      }
    }
    items.push(...changed)
  }

  for (const w of after.weekly) {
    const old = before.weekly.find((b) => b.day === w.day)
    if (old && !same(old, w)) {
      items.push({
        kind: 'changed',
        label: `週間プラン ${w.day}日目`,
        before: `${old.task}(${old.area}・約${old.minutes}分)`,
        after: `${w.task}(${w.area}・約${w.minutes}分)`,
      })
    }
  }

  return items
}
