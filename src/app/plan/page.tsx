'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUsage } from '@/lib/use-usage'
import { useMissionLogs } from '@/lib/use-missions'
import { computeProgress, dateOfDayInCycle, jstDateString } from '@/lib/mission'
import UsageNote from '@/components/UsageNote'
import {
  MONTHLY_BUDGETS,
  totalMonthlyCost,
  validatePlan,
  type PlanContent,
  type PlanElement,
} from '@/lib/plan-schema'

type SavedPlan = {
  id: number
  created_at: string
  plan: PlanContent
  monthlyBudget: string | null
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function yen(n: number) {
  return `${n.toLocaleString('ja-JP')}円`
}

// 「まずここから」(priority 1〜3)を先に、残りは元の順番で
function sortElements(elements: PlanElement[]) {
  return [...elements].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
}

export default function PlanPage() {
  const [saved, setSaved] = useState<SavedPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { usage } = useUsage()
  const { logs } = useMissionLogs()

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase
        .from('plans')
        .select('id, created_at, content, ideal_snapshot')
        .eq('status', 'active')
        .maybeSingle()

      if (loadError) {
        setError('プランの読み込みに失敗しました')
      } else if (data) {
        // 保存されていても、表示の前にもう一度、形を検査する
        const checked = validatePlan(data.content)
        if (checked.ok) {
          setSaved({
            id: data.id,
            created_at: data.created_at,
            plan: checked.value,
            monthlyBudget: data.ideal_snapshot?.monthly_budget ?? null,
          })
        } else {
          setError('プランの形式が正しくありません。作り直してください')
        }
      }
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400">読み込み中...</p>
      </div>
    )
  }

  if (!saved) {
    return (
      <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">マイプラン</h1>
          <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-slate-600">
              {error || '憧れの雰囲気を教えてくれたら、あなた専用の行動プランを作ります。'}
            </p>
            <Link
              href="/onboarding"
              className="mt-5 block rounded-xl bg-blue-600 py-3 text-base font-medium text-white"
            >
              プランを作る
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { plan } = saved
  const now = new Date()
  const today = jstDateString(now)
  const progress = computeProgress(logs, saved.created_at, now)
  const cost = totalMonthlyCost(plan)
  const budget = MONTHLY_BUDGETS.find((b) => b.value === saved.monthlyBudget)

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">マイプラン</h1>
        <p className="mt-1 text-xs text-slate-400">作成日: {formatDate(saved.created_at)}</p>

        <section className="mt-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium text-blue-600">目指す雰囲気</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{plan.vibe.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{plan.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.vibe.keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
              >
                {keyword}
              </span>
            ))}
          </div>
        </section>

        <h2 className="mb-3 mt-8 text-base font-semibold text-slate-900">取り組むこと</h2>
        <div className="flex flex-col gap-4">
          {sortElements(plan.elements).map((element) => (
            <section
              key={element.area}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {element.area}
                </span>
                {element.priority !== null && (
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                    {element.priority === 1 ? 'まずここから' : `優先 ${element.priority}`}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{element.why}</p>

              <ul className="mt-4 flex flex-col gap-3">
                {element.actions.map((action) => (
                  <li key={action.title} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{action.detail}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {action.frequency}・約{action.minutes}分・
                      {action.cost_yen === null
                        ? '費用は目安なし'
                        : action.cost_yen === 0
                          ? '無料'
                          : `月${yen(action.cost_yen)}`}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium text-slate-500">1か月の費用の目安</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {yen(cost.total)}
            {budget && budget.yen !== null && (
              <span className="ml-2 text-xs font-normal text-slate-400">
                (予算 {budget.label})
              </span>
            )}
          </p>
          {cost.unknown > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              費用が見積もれない行動が{cost.unknown}件あります(上の金額には含まれません)
            </p>
          )}
        </section>

        <h2 className="mb-3 mt-8 text-base font-semibold text-slate-900">今週のプラン</h2>

        <section className="mb-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-slate-500">今週の進み具合</p>
            <p className="text-sm font-semibold text-slate-900">{progress.weekDone}/7 完了</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${(progress.weekDone / 7) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            連続 {progress.streak}日 ・ これまで合計 {progress.totalDone}回
          </p>
          {Object.keys(progress.byArea).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(progress.byArea).map(([area, count]) => (
                <span
                  key={area}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {area} {count}回
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
          <ul className="divide-y divide-slate-100">
            {plan.weekly.map((item) => {
              const date = dateOfDayInCycle(saved.created_at, now, item.day)
              const log = logs.find((l) => l.mission_date === date)
              const isToday = date === today
              return (
                <li
                  key={item.day}
                  className={`flex gap-3 p-4 ${isToday ? 'rounded-2xl bg-blue-50/60' : ''}`}
                >
                  <span className="mt-0.5 w-12 shrink-0 text-xs font-semibold text-blue-600">
                    {item.day}日目
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-slate-700">{item.task}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.area}・約{item.minutes}分
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {isToday && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                        今日
                      </span>
                    )}
                    {log?.status === 'done' && (
                      <span className="text-xs font-semibold text-green-600">✓ 完了</span>
                    )}
                    {log?.status === 'rest' && (
                      <span className="text-xs font-medium text-slate-400">お休み</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">{plan.notes}</p>

        <div className="mt-6">
          <UsageNote item={usage?.items.plan} />
        </div>
        <Link
          href="/onboarding"
          className="mt-3 block rounded-xl border border-slate-200 bg-white py-3 text-center text-base font-medium text-slate-600"
        >
          答えを変えてプランを作り直す
        </Link>
        <p className="mt-3 text-center text-xs text-slate-400">
          作り直しても、今のプランは履歴として保存されます。作り直しは「プラン作成」の回数に数えます
        </p>
      </div>
    </div>
  )
}
