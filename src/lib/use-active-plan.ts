'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { validatePlan, type PlanContent } from '@/lib/plan-schema'

export type ActivePlan = {
  id: number
  createdAt: string
  cycleStart: string // 「1日目」の日付。調整しても引き継がれる
  changeNote: string | null
  plan: PlanContent
}

// いま使用中のプランを読む。保存されていても、使う前にもう一度、形を検査する
export function useActivePlan() {
  const [active, setActive] = useState<ActivePlan | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase
        .from('plans')
        .select('id, created_at, cycle_start, change_note, content')
        .eq('status', 'active')
        .maybeSingle()

      if (loadError) {
        setError(true)
      } else if (data) {
        const checked = validatePlan(data.content)
        if (checked.ok) {
          setActive({
            id: data.id,
            createdAt: data.created_at,
            cycleStart: data.cycle_start ?? data.created_at,
            changeNote: data.change_note ?? null,
            plan: checked.value,
          })
        } else {
          setError(true)
        }
      }
      setLoaded(true)
    }

    load()
  }, [])

  return { active, loaded, error }
}
