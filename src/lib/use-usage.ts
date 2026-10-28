'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AiKind, Period, Tier } from '@/lib/plans-config'

export type UsageItem = {
  label: string
  period: Period
  limit: number
  used: number
  remaining: number
  resetLabel: string
  hint: string | null
}

export type UsageSummary = {
  tier: Tier
  items: Partial<Record<AiKind, UsageItem>>
}

// AIの残り回数をサーバーから取る。reload() で取り直せる(取れなくても画面は普通に使える)
export function useUsage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null)

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/usage')
      if (!res.ok) return
      setUsage(await res.json())
    } catch {
      // 表示用の情報なので、失敗しても何もしない
    }
  }, [])

  useEffect(() => {
    async function load() {
      await reload()
    }
    load()
  }, [reload])

  return { usage, reload }
}
