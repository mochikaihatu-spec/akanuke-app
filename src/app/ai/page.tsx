'use client'

import FeatureCard from '@/components/FeatureCard'
import { ChatIcon, SlidersIcon, SparkleIcon } from '@/components/icons'
import type { AiKind } from '@/lib/plans-config'
import { useUsage } from '@/lib/use-usage'

// AI相談の入口。どの相談も、残り回数を見ながら選べる
export default function AiHubPage() {
  const { usage } = useUsage()

  function remaining(kind: AiKind) {
    const item = usage?.items[kind]
    if (!item) return undefined
    return `${item.period === 'month' ? '今月' : '今日'}あと${item.remaining}回`
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 pb-10 pt-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">AIに相談</h1>
          <p className="mt-1 text-sm text-slate-500">迷ったことを、気軽に聞いてみよう。</p>
        </header>

        <div className="flex flex-col gap-3">
          <FeatureCard
            variant="row"
            href="/plan/consult"
            title="プランを調整"
            description="続けにくいところを、予算や悩みに合わせて変更"
            Icon={SlidersIcon}
            tone="coral"
            note={remaining('plan_adjust')}
          />
          <FeatureCard
            variant="row"
            href="/beauty"
            title="AI美容相談"
            description="気になる部分を選んで、アドバイスをもらう"
            Icon={SparkleIcon}
            tone="sage"
            note={remaining('beauty')}
          />
          <FeatureCard
            variant="row"
            href="/chat"
            title="食事のAI相談"
            description="今日の食事や、カロリーのことを質問"
            Icon={ChatIcon}
            tone="lavender"
            note={remaining('chat')}
          />
        </div>

        <p className="text-center text-xs leading-relaxed text-slate-400">
          AIの提案は一般的な情報で、医療や診断ではありません。
          プランは、あなたが承認するまで変わりません。
        </p>
      </div>
    </div>
  )
}
