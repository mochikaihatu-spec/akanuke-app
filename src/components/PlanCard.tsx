'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type PlanSummary = { title: string; summary: string }

// ホームに出す、プランへの入口カード。自分で使用中のプランを読みに行く
export default function PlanCard() {
  const [loaded, setLoaded] = useState(false)
  const [plan, setPlan] = useState<PlanSummary | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('plans')
        .select('content')
        .eq('status', 'active')
        .maybeSingle()

      const content = data?.content
      if (content && typeof content.summary === 'string' && typeof content.vibe?.title === 'string') {
        setPlan({ title: content.vibe.title, summary: content.summary })
      }
      setLoaded(true)
    }

    load()
  }, [])

  if (!loaded) return null

  if (!plan) {
    return (
      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">憧れを、あなた専用の行動プランに。</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          なりたい雰囲気を教えると、無理なく続けられるプランをAIが作ります。
        </p>
        <Link
          href="/onboarding"
          className="mt-4 block rounded-xl bg-blue-600 py-3 text-center text-base font-medium text-white"
        >
          プランを作る
        </Link>
      </div>
    )
  }

  return (
    <Link
      href="/plan"
      className="block rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">マイプラン</p>
        <span className="text-xs font-medium text-blue-600">見る →</span>
      </div>
      <p className="mt-2 text-base font-semibold text-slate-900">{plan.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{plan.summary}</p>
    </Link>
  )
}
