import { NextResponse } from 'next/server'
import { getTier } from '@/lib/ai-guard'
import {
  AI_KIND_LABELS,
  AI_QUOTAS,
  PAID_PLAN,
  periodStart,
  resetLabel,
  upgradeHint,
  type AiKind,
} from '@/lib/plans-config'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// 本人の契約状態と、AIの残り回数を返す(AIは呼ばないので、回数も料金もかからない)
export async function GET() {
  const supabase = await createSupabaseServerClient()

  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const tier = await getTier(supabase)
  const now = new Date()
  const kinds = Object.keys(AI_QUOTAS[tier]) as AiKind[]

  const starts = [...new Set(kinds.map((k) => periodStart(AI_QUOTAS[tier][k].period, now)))]
  const { data: rows, error } = await supabase
    .from('ai_usage')
    .select('kind, usage_date, count')
    .in('usage_date', starts)

  if (error) {
    console.error('Usage: failed to read ai_usage:', error.message)
    return NextResponse.json({ error: '利用状況の取得に失敗しました' }, { status: 500 })
  }

  const items = Object.fromEntries(
    kinds.map((kind) => {
      const quota = AI_QUOTAS[tier][kind]
      const start = periodStart(quota.period, now)
      const used = rows?.find((r) => r.kind === kind && r.usage_date === start)?.count ?? 0
      return [
        kind,
        {
          label: AI_KIND_LABELS[kind],
          period: quota.period,
          limit: quota.limit,
          used,
          remaining: Math.max(0, quota.limit - used),
          resetLabel: resetLabel(quota.period, now),
          hint: upgradeHint(kind, tier),
        },
      ]
    })
  )

  return NextResponse.json({
    tier,
    paidPlan: { priceYenPerMonth: PAID_PLAN.priceYenPerMonth, purchasable: PAID_PLAN.purchasable },
    items,
  })
}
