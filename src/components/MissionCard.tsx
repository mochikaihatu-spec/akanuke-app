'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckIcon, ClockIcon, SunIcon } from '@/components/icons'
import {
  computeProgress,
  doneMessage,
  jstDateString,
  REST_MESSAGE,
  todaysMission,
  type MissionLog,
} from '@/lib/mission'
import type { ActivePlan } from '@/lib/use-active-plan'
import { saveMission, undoMission } from '@/lib/use-missions'

type Props = {
  planLoaded: boolean
  active: ActivePlan | null
  logs: MissionLog[]
  logsLoaded: boolean
  logsError: boolean
  onChanged: () => Promise<void>
}

const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700'

// ホームの「今日のミッション」。プランの週間プランから今日の分を取り出す(AIは使わない)
export default function MissionCard({ planLoaded, active, logs, logsLoaded, logsError, onChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 読み込み中:場所を空けておく(表示が飛ばないように)
  if (!planLoaded || !logsLoaded) {
    return (
      <div className="h-52 animate-pulse rounded-3xl border border-blue-200 bg-blue-100/70" aria-busy="true" />
    )
  }

  // プラン未作成:最初の一歩への入口
  if (!active) {
    return (
      <div className="rounded-3xl border border-blue-200 bg-blue-100 p-6">
        <p className={eyebrow}>Start here</p>
        <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-900">
          憧れを、あなた専用の行動プランに。
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          なりたい雰囲気を教えると、無理なく続けられるプランと、毎日のミッションをAIが作ります。
        </p>
        <Link
          href="/onboarding"
          className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 text-base font-semibold text-white transition-colors active:bg-blue-700"
        >
          プランを作る
        </Link>
      </div>
    )
  }

  const now = new Date()
  const today = jstDateString(now)
  const mission = todaysMission(active.plan.weekly, active.cycleStart, now)

  if (!mission) {
    return (
      <div className="rounded-3xl border border-blue-200 bg-blue-100 p-6">
        <p className={eyebrow}>Today&apos;s mission</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          今日のミッションが見つかりませんでした。マイプランを確認してみてください。
        </p>
        <Link href="/plan" className="mt-3 inline-block text-sm font-semibold text-blue-600">
          マイプランを見る →
        </Link>
      </div>
    )
  }

  const todayLog = logs.find((l) => l.mission_date === today)
  const progress = computeProgress(logs, active.cycleStart, now)

  async function record(status: 'done' | 'rest') {
    if (!mission || !active || busy) return
    setBusy(true)
    setError('')
    const failed = await saveMission({
      planId: active.id,
      date: today,
      dayIndex: mission.dayIndex,
      area: mission.task.area,
      task: mission.task.task,
      minutes: mission.task.minutes,
      status,
    })
    if (failed) setError('保存に失敗しました。もう一度お試しください')
    await onChanged()
    setBusy(false)
  }

  async function undo() {
    if (busy) return
    setBusy(true)
    setError('')
    const failed = await undoMission(today)
    if (failed) setError('取り消しに失敗しました。もう一度お試しください')
    await onChanged()
    setBusy(false)
  }

  return (
    <section aria-label="今日のミッション" className="rounded-3xl border border-blue-200 bg-blue-100 p-5">
      <div className="flex items-center justify-between">
        <p className={`${eyebrow} flex items-center gap-1.5`}>
          <span className="h-4 w-4">
            <SunIcon />
          </span>
          Today&apos;s mission
        </p>
        <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
          プランの{mission.dayIndex}日目
        </span>
      </div>

      <h2 className="mt-2 text-xl font-semibold text-slate-900">今日のミッション</h2>
      <p className="mt-1 text-sm text-slate-600">理想に近づくために、今日やることを1つだけ。</p>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
          {mission.task.area}
        </span>
        <p className="mt-2 text-base font-semibold leading-relaxed text-slate-900">{mission.task.task}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="h-3.5 w-3.5">
            <ClockIcon />
          </span>
          目安 {mission.task.minutes}分
        </p>
      </div>

      {!todayLog ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => record('done')}
            disabled={busy}
            className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-blue-600 text-base font-semibold text-white transition-colors active:bg-blue-700 disabled:opacity-50"
          >
            完了にする
          </button>
          <button
            type="button"
            onClick={() => record('rest')}
            disabled={busy}
            className="min-h-12 rounded-2xl border border-blue-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors active:bg-blue-50 disabled:opacity-50"
          >
            今日はお休み
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {todayLog.status === 'done' ? (
              <>
                <span className="h-4 w-4 text-blue-600">
                  <CheckIcon />
                </span>
                完了 {doneMessage(progress.streak)}
              </>
            ) : (
              REST_MESSAGE
            )}
          </p>
          <button
            type="button"
            onClick={undo}
            disabled={busy}
            className="min-h-10 shrink-0 px-1 text-sm font-semibold text-blue-600 disabled:opacity-50"
          >
            戻す
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">
          今週 {progress.weekDone}/7 完了
          {progress.streak > 0 && ` ・ 連続 ${progress.streak}日`}
        </p>
        <Link href="/plan/consult" className="text-xs font-semibold text-blue-600">
          このミッションを調整する
        </Link>
      </div>

      {(error || logsError) && (
        <p className="mt-2 text-xs font-medium text-red-600">{error || '記録の読み込みに失敗しました'}</p>
      )}
    </section>
  )
}
