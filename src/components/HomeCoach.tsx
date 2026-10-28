'use client'

import FeatureCard from '@/components/FeatureCard'
import { GrowthIcon, PlanIcon, SlidersIcon, SparkleIcon } from '@/components/icons'
import MissionCard from '@/components/MissionCard'
import WeekProgress from '@/components/WeekProgress'
import { useActivePlan } from '@/lib/use-active-plan'
import { useMissionLogs } from '@/lib/use-missions'

// ホームの上半分:今日のミッション → 主要機能 → 今週の進捗。
// プランと記録を1か所で読み込み、ミッションを完了すると、進捗も同時に更新される
export default function HomeCoach() {
  const { active, loaded: planLoaded } = useActivePlan()
  const { logs, loaded: logsLoaded, error: logsError, reload } = useMissionLogs()

  return (
    <>
      <MissionCard
        planLoaded={planLoaded}
        active={active}
        logs={logs}
        logsLoaded={logsLoaded}
        logsError={logsError}
        onChanged={reload}
      />

      <section aria-label="あなたの垢抜けメニュー">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">あなたの垢抜けメニュー</h2>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Your plan
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FeatureCard
            href="/plan"
            title="マイプラン"
            description="理想への道筋を確認"
            Icon={PlanIcon}
            tone="lavender"
          />
          <FeatureCard
            href="/plan/consult"
            title="プランを調整"
            description="予算や悩みに合わせて変更"
            Icon={SlidersIcon}
            tone="coral"
          />
          <FeatureCard
            href="/beauty"
            title="AI美容相談"
            description="気になる部分を気軽に相談"
            Icon={SparkleIcon}
            tone="sage"
          />
          <FeatureCard
            href="/records"
            title="成長の記録"
            description="続けてきたことを振り返る"
            Icon={GrowthIcon}
            tone="sand"
          />
        </div>
      </section>

      {active && planLoaded && logsLoaded && (
        <WeekProgress logs={logs} cycleStart={active.cycleStart} />
      )}
    </>
  )
}
