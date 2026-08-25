'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [totalCalories, setTotalCalories] = useState(0)
  const [totalProtein, setTotalProtein] = useState(0)
  const [targetCalories, setTargetCalories] = useState<number | null>(null)
  const [targetProteinG, setTargetProteinG] = useState<number | null>(null)
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null)

  useEffect(() => {
    async function loadData() {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(startOfDay)
      endOfDay.setDate(endOfDay.getDate() + 1)

      const [mealsResult, profileResult] = await Promise.all([
        supabase
          .from('meal_records')
          .select('calories, protein_g')
          .gte('eaten_at', startOfDay.toISOString())
          .lt('eaten_at', endOfDay.toISOString()),
        supabase
          .from('profile')
          .select('weight_kg, target_weight_kg, target_calories, target_protein_g')
          .eq('id', 1)
          .single(),
      ])

      if (mealsResult.data) {
        setTotalCalories(
          mealsResult.data.reduce((sum, m) => sum + Number(m.calories ?? 0), 0)
        )
        setTotalProtein(
          mealsResult.data.reduce((sum, m) => sum + Number(m.protein_g ?? 0), 0)
        )
      }
      if (profileResult.data) {
        const p = profileResult.data
        setWeightKg(p.weight_kg === null ? null : Number(p.weight_kg))
        setTargetWeightKg(
          p.target_weight_kg === null ? null : Number(p.target_weight_kg)
        )
        setTargetCalories(
          p.target_calories === null ? null : Number(p.target_calories)
        )
        setTargetProteinG(
          p.target_protein_g === null ? null : Number(p.target_protein_g)
        )
      }
      if (mealsResult.error || profileResult.error) {
        setError('データの読み込みに失敗しました')
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const remainingCalories =
    targetCalories !== null ? targetCalories - totalCalories : null
  const remainingProtein =
    targetProteinG !== null ? targetProteinG - totalProtein : null
  const caloriesOver = remainingCalories !== null && remainingCalories < 0
  const calorieProgress =
    targetCalories !== null && targetCalories > 0
      ? Math.min(100, (totalCalories / targetCalories) * 100)
      : 0

  const todayLabel = new Date().toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-slate-400">{todayLabel}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            今日の進み具合
          </h1>
        </div>

        {error && (
          <p className="text-center text-sm font-medium text-red-600">{error}</p>
        )}

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            {targetCalories === null
              ? '今日の摂取カロリー'
              : caloriesOver
                ? '目標カロリーをオーバーしています'
                : '今日、あと食べられるカロリー'}
          </p>

          <p
            className={`mt-1 text-5xl font-bold tracking-tight ${
              caloriesOver ? 'text-red-600' : 'text-blue-600'
            }`}
          >
            {targetCalories === null
              ? totalCalories
              : caloriesOver
                ? Math.abs(remainingCalories ?? 0)
                : remainingCalories}
            <span className="ml-1 text-lg font-medium text-slate-400">kcal</span>
          </p>

          {targetCalories !== null ? (
            <>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    caloriesOver ? 'bg-red-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${calorieProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                摂取 {totalCalories} / 目標 {targetCalories} kcal
              </p>
            </>
          ) : (
            <Link href="/profile" className="mt-3 inline-block text-xs font-medium text-blue-600">
              目標カロリーを設定する →
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">タンパク質</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {totalProtein.toFixed(0)}
              <span className="text-sm font-medium text-slate-400"> g</span>
            </p>
            <p
              className={`mt-1 text-xs font-medium ${
                remainingProtein !== null && remainingProtein < 0
                  ? 'text-blue-600'
                  : 'text-slate-400'
              }`}
            >
              {remainingProtein === null
                ? '目標未設定'
                : remainingProtein < 0
                  ? `目標達成 +${Math.abs(remainingProtein).toFixed(0)}g`
                  : `あと ${remainingProtein.toFixed(0)}g`}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">体重</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {weightKg !== null ? weightKg : '—'}
              <span className="text-sm font-medium text-slate-400"> kg</span>
            </p>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {targetWeightKg !== null ? `目標 ${targetWeightKg} kg` : '目標未設定'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/meals"
            className="rounded-xl bg-blue-600 py-3 text-center text-base font-medium text-white transition-colors"
          >
            食事を記録する
          </Link>
          <Link
            href="/profile"
            className="rounded-xl border border-slate-200 py-3 text-center text-base font-medium text-slate-700 transition-colors"
          >
            体重を記録する
          </Link>
          <Link
            href="/chat"
            className="rounded-xl border border-slate-200 py-3 text-center text-base font-medium text-slate-700 transition-colors"
          >
            AIに相談する
          </Link>
        </div>
      </div>
    </div>
  )
}
