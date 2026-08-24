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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-zinc-50 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-center text-xl font-semibold text-zinc-900">
          今日のサマリー
        </h1>

        {error && (
          <p className="text-center text-sm font-medium text-red-600">{error}</p>
        )}

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">食事</h2>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-700">今日の合計カロリー</span>
              <span className="font-medium text-zinc-900">{totalCalories} kcal</span>
            </div>

            {remainingCalories !== null && (
              <div className="flex justify-between">
                <span className="text-zinc-700">カロリー目標まで</span>
                <span
                  className={`font-medium ${
                    remainingCalories < 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {remainingCalories < 0
                    ? `${Math.abs(remainingCalories)} kcal オーバー`
                    : `あと ${remainingCalories} kcal`}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-zinc-700">今日の合計タンパク質</span>
              <span className="font-medium text-zinc-900">
                {totalProtein.toFixed(1)} g
              </span>
            </div>

            {remainingProtein !== null && (
              <div className="flex justify-between">
                <span className="text-zinc-700">タンパク質目標まで</span>
                <span
                  className={`font-medium ${
                    remainingProtein < 0 ? 'text-green-600' : 'text-zinc-900'
                  }`}
                >
                  {remainingProtein < 0
                    ? `目標達成 (+${Math.abs(remainingProtein).toFixed(1)} g)`
                    : `あと ${remainingProtein.toFixed(1)} g`}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">体重</h2>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-700">現在の体重</span>
              <span className="font-medium text-zinc-900">
                {weightKg !== null ? `${weightKg} kg` : '未設定'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-700">目標体重</span>
              <span className="font-medium text-zinc-900">
                {targetWeightKg !== null ? `${targetWeightKg} kg` : '未設定'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/meals"
            className="rounded-xl bg-zinc-900 py-3 text-center text-base font-medium text-white transition-colors"
          >
            食事を記録する
          </Link>
          <Link
            href="/profile"
            className="rounded-xl border border-zinc-300 py-3 text-center text-base font-medium text-zinc-900 transition-colors"
          >
            体重を記録する
          </Link>
          <Link
            href="/chat"
            className="rounded-xl border border-zinc-300 py-3 text-center text-base font-medium text-zinc-900 transition-colors"
          >
            AIに相談する
          </Link>
        </div>
      </div>
    </div>
  )
}
