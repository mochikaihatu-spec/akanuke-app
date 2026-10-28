'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { validatePlan, type PlanContent } from '@/lib/plan-schema'
import {
  computeProgress,
  doneMessage,
  jstDateString,
  REST_MESSAGE,
  todaysMission,
} from '@/lib/mission'
import { saveMission, undoMission, useMissionLogs } from '@/lib/use-missions'

type ActivePlan = { id: number; createdAt: string; plan: PlanContent }

// ホームに出す「今日のミッション」。プランの週間プランから、今日の分を取り出す(AIは使わない)
export default function MissionCard() {
  const [active, setActive] = useState<ActivePlan | null>(null)
  const [planLoaded, setPlanLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { logs, loaded: logsLoaded, error: logsError, reload } = useMissionLogs()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('plans')
        .select('id, created_at, content')
        .eq('status', 'active')
        .maybeSingle()

      if (data) {
        const checked = validatePlan(data.content)
        if (checked.ok) setActive({ id: data.id, createdAt: data.created_at, plan: checked.value })
      }
      setPlanLoaded(true)
    }

    load()
  }, [])

  if (!planLoaded || !logsLoaded || !active) return null

  const now = new Date()
  const today = jstDateString(now)
  const mission = todaysMission(active.plan.weekly, active.createdAt, now)
  if (!mission) return null

  const todayLog = logs.find((l) => l.mission_date === today)
  const progress = computeProgress(logs, active.createdAt, now)

  async function record(status: 'done' | 'rest') {
    if (!mission || busy) return
    setBusy(true)
    setError('')
    const failed = await saveMission({
      planId: active!.id,
      date: today,
      dayIndex: mission.dayIndex,
      area: mission.task.area,
      task: mission.task.task,
      minutes: mission.task.minutes,
      status,
    })
    if (failed) setError('保存に失敗しました。もう一度お試しください')
    await reload()
    setBusy(false)
  }

  async function undo() {
    if (busy) return
    setBusy(true)
    setError('')
    const failed = await undoMission(today)
    if (failed) setError('取り消しに失敗しました。もう一度お試しください')
    await reload()
    setBusy(false)
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">今日のミッション</p>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-600">
          プランの{mission.dayIndex}日目
        </span>
      </div>

      <div className="mt-3">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {mission.task.area}
        </span>
        <p className="mt-2 text-base font-semibold leading-relaxed text-slate-900">
          {mission.task.task}
        </p>
        <p className="mt-1 text-xs text-slate-400">約{mission.task.minutes}分</p>
      </div>

      {!todayLog ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => record('done')}
            disabled={busy}
            className="flex-1 rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
          >
            完了にする
          </button>
          <button
            type="button"
            onClick={() => record('rest')}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition-colors disabled:opacity-50"
          >
            今日はお休み
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">
            {todayLog.status === 'done'
              ? `✓ 完了 ${doneMessage(progress.streak)}`
              : REST_MESSAGE}
          </p>
          <button
            type="button"
            onClick={undo}
            disabled={busy}
            className="shrink-0 text-xs font-medium text-blue-600 disabled:opacity-50"
          >
            戻す
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        今週 {progress.weekDone}/7 完了
        {progress.streak > 0 && ` ・ 連続 ${progress.streak}日`}
      </p>

      {(error || logsError) && (
        <p className="mt-2 text-xs font-medium text-red-600">
          {error || '記録の読み込みに失敗しました'}
        </p>
      )}
    </div>
  )
}
