'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import FeatureCard from '@/components/FeatureCard'
import { MealsIcon, UserIcon, WeightIcon, WorkoutIcon } from '@/components/icons'
import { computeProgress } from '@/lib/mission'
import { supabase } from '@/lib/supabase'
import { useActivePlan } from '@/lib/use-active-plan'
import { useMissionLogs } from '@/lib/use-missions'

// 'YYYY-MM-DD' を「10/28(火)」の形にする(日本時間の日付として読む)
function formatDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00+09:00`)
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' })
}

// 記録の入口。成長の記録(ミッション)を上に、食事・体重・筋トレなどの記録を下にまとめる
export default function RecordsPage() {
  const { active, loaded: planLoaded } = useActivePlan()
  const { logs, loaded: logsLoaded } = useMissionLogs()
  const [useWorkout, setUseWorkout] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('profile').select('use_workout').maybeSingle()
      setUseWorkout(Boolean(data?.use_workout))
    }
    load()
  }, [])

  const ready = planLoaded && logsLoaded
  const progress = active ? computeProgress(logs, active.cycleStart, new Date()) : null
  const recent = logs.slice(0, 14)

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 pb-10 pt-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">記録</h1>
          <p className="mt-1 text-sm text-slate-500">続けてきたことを、ここで振り返ろう。</p>
        </header>

        <section aria-label="成長の記録" className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">成長の記録</h2>

          {!ready ? (
            <div className="h-40 animate-pulse rounded-3xl border border-slate-100 bg-white" aria-busy="true" />
          ) : !progress ? (
            <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
              <p className="text-sm leading-relaxed text-slate-500">
                プランを作ると、毎日のミッションの記録が、ここにたまっていきます。
              </p>
              <Link
                href="/onboarding"
                className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 text-base font-semibold text-white transition-colors active:bg-blue-700"
              >
                プランを作る
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '今週', value: `${progress.weekDone}/7`, unit: '日' },
                  { label: '連続', value: String(progress.streak), unit: '日' },
                  { label: 'これまで', value: String(progress.totalDone), unit: '回' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-3xl border border-slate-100 bg-white p-4 text-center shadow-sm"
                  >
                    <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                      {stat.value}
                      <span className="ml-0.5 text-xs font-medium text-slate-400">{stat.unit}</span>
                    </p>
                  </div>
                ))}
              </div>

              {Object.keys(progress.byArea).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(progress.byArea).map(([area, count]) => (
                    <span
                      key={area}
                      className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
                    >
                      {area} {count}回
                    </span>
                  ))}
                </div>
              )}

              <div className="rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
                <p className="px-4 pb-1 pt-3 text-xs font-medium text-slate-500">最近の記録</p>
                {recent.length === 0 ? (
                  <p className="px-4 pb-4 pt-1 text-sm text-slate-400">
                    まだ記録がありません。ホームのミッションから、はじめてみよう。
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {recent.map((log) => (
                      <li key={log.mission_date} className="flex items-start gap-3 px-4 py-3">
                        <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">
                          {formatDay(log.mission_date)}
                        </span>
                        <span className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700">
                          {log.task ?? log.area}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            log.status === 'done'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {log.status === 'done' ? '完了' : 'お休み'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>

        <section aria-label="記録する" className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">記録する</h2>
          <FeatureCard
            variant="row"
            href="/meals"
            title="食事を記録"
            description="写真から、カロリーとタンパク質を推定できます"
            Icon={MealsIcon}
            tone="sage"
          />
          <FeatureCard
            variant="row"
            href="/weight"
            title="体重の推移"
            description="グラフで、これまでの変化を見る"
            Icon={WeightIcon}
            tone="sand"
          />
          <FeatureCard
            variant="row"
            href="/profile"
            title="今日の体重を記録"
            description="プロフィールで、体重を入力して記録"
            Icon={WeightIcon}
            tone="sand"
          />
          {useWorkout && (
            <FeatureCard
              variant="row"
              href="/workout"
              title="筋トレを記録"
              description="種目・重さ・回数を残す"
              Icon={WorkoutIcon}
              tone="coral"
            />
          )}
        </section>

        <FeatureCard
          variant="row"
          href="/profile"
          title="プロフィール・設定"
          description="目標、使う機能、ログアウトなど"
          Icon={UserIcon}
          tone="lavender"
        />
      </div>
    </div>
  )
}
