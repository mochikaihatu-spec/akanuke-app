'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const inputClass =
  'rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'text-sm font-medium text-slate-600'
const cardClass = 'rounded-3xl border border-slate-100 bg-white p-6 shadow-sm'

type WorkoutRecord = {
  id: number
  exercise_name: string
  weight: number | null
  reps: number | null
  sets: number | null
  created_at: string
}

export default function WorkoutPage() {
  const [exerciseName, setExerciseName] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const { data, error } = await supabase
      .from('workout_records')
      .select('id, exercise_name, weight, reps, sets, created_at')
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: true })

    if (data) setWorkouts(data)
    if (error) setError('データの読み込みに失敗しました')
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error } = await supabase.from('workout_records').insert({
      exercise_name: exerciseName,
      weight: weight === '' ? null : Number(weight),
      reps: reps === '' ? null : Number(reps),
      sets: sets === '' ? null : Number(sets),
    })

    setSaving(false)

    if (error) {
      setError('記録に失敗しました。もう一度お試しください')
      return
    }

    setExerciseName('')
    setWeight('')
    setReps('')
    setSets('')
    await loadData()
  }

  const totalSets = workouts.reduce((sum, w) => sum + Number(w.sets ?? 0), 0)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">
          筋トレ記録
        </h1>

        <form onSubmit={handleSubmit} className={`flex flex-col gap-5 ${cardClass}`}>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>種目名</span>
            <input
              type="text"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              placeholder="例: ベンチプレス"
              required
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>重量 (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="例: 60"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>回数</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="例: 10"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>セット数</span>
            <input
              type="number"
              inputMode="numeric"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              placeholder="例: 3"
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
          >
            {saving ? '記録中...' : '記録する'}
          </button>

          {error && (
            <p className="text-center text-sm font-medium text-red-600">{error}</p>
          )}
        </form>

        <div className={`mt-6 ${cardClass}`}>
          <h2 className="mb-4 text-base font-semibold text-slate-900">今日の記録</h2>

          {workouts.length === 0 ? (
            <p className="text-sm text-slate-400">まだ記録がありません</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {workouts.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
                >
                  <span className="text-slate-900">{w.exercise_name}</span>
                  <span className="text-slate-400">
                    {w.weight ?? '-'} kg × {w.reps ?? '-'} 回 × {w.sets ?? '-'} セット
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-xs font-medium text-slate-500">今日の合計</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {workouts.length}
              <span className="text-sm font-medium text-slate-400"> 種目</span>
              <span className="ml-3 text-2xl">
                {totalSets}
                <span className="text-sm font-medium text-slate-400"> セット</span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
