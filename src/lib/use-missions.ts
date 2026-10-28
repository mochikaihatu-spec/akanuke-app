'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUserId, supabase } from '@/lib/supabase'
import { addDays, jstDateString, type MissionLog, type MissionStatus } from '@/lib/mission'

// 自分のミッション記録を読む(直近400日分。連続日数と合計の計算に使う)
export function useMissionLogs() {
  const [logs, setLogs] = useState<MissionLog[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    const since = addDays(jstDateString(new Date()), -400)
    const { data, error: loadError } = await supabase
      .from('mission_logs')
      .select('mission_date, status, area')
      .gte('mission_date', since)
      .order('mission_date', { ascending: false })

    if (loadError) {
      setError(true)
    } else {
      setError(false)
      setLogs((data ?? []) as MissionLog[])
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    async function load() {
      await reload()
    }
    load()
  }, [reload])

  return { logs, loaded, error, reload }
}

export type SaveMissionInput = {
  planId: number
  date: string // 日本時間の日付 'YYYY-MM-DD'
  dayIndex: number
  area: string
  task: string
  minutes: number
  status: MissionStatus
}

// 完了 / お休み を保存する(同じ日にすでにあれば上書き)。失敗したら true を返す
export async function saveMission(input: SaveMissionInput) {
  const userId = await getUserId()
  if (!userId) return true

  const { error } = await supabase.from('mission_logs').upsert(
    {
      user_id: userId,
      plan_id: input.planId,
      mission_date: input.date,
      day_index: input.dayIndex,
      area: input.area,
      task: input.task,
      minutes: input.minutes,
      status: input.status,
    },
    { onConflict: 'user_id,mission_date' }
  )
  return Boolean(error)
}

// 記録を取り消す(戻す)。失敗したら true を返す
export async function undoMission(date: string) {
  const { error } = await supabase.from('mission_logs').delete().eq('mission_date', date)
  return Boolean(error)
}
