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
  const [workoutCountToday, setWorkoutCountToday] = useState(0)
  const [lastExerciseName, setLastExerciseName] = useState<string | null>(null)
  const [useWorkout, setUseWorkout] = useState(false)
  const [useBeauty, setUseBeauty] = useState(false)
  const [latestBeautyCategories, setLatestBeautyCategories] = useState<string[] | null>(null)
  const [todos, setTodos] = useState<string[]>([])
  const [todosLoading, setTodosLoading] = useState(true)
  const [todosError, setTodosError] = useState('')

  useEffect(() => {
    async function loadData() {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(startOfDay)
      endOfDay.setDate(endOfDay.getDate() + 1)

      const [
        mealsResult,
        profileResult,
        workoutsTodayResult,
        lastWorkoutResult,
        lastBeautyResult,
      ] = await Promise.all([
        supabase
          .from('meal_records')
          .select('calories, protein_g')
          .gte('eaten_at', startOfDay.toISOString())
          .lt('eaten_at', endOfDay.toISOString()),
        supabase
          .from('profile')
          .select(
            'weight_kg, target_weight_kg, target_calories, target_protein_g, use_workout, use_beauty'
          )
          .eq('id', 1)
          .single(),
        supabase
          .from('workout_records')
          .select('id')
          .gte('created_at', startOfDay.toISOString())
          .lt('created_at', endOfDay.toISOString()),
        supabase
          .from('workout_records')
          .select('exercise_name, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('beauty_consultations')
          .select('categories, concern, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const totalCaloriesValue = (mealsResult.data ?? []).reduce(
        (sum, m) => sum + Number(m.calories ?? 0),
        0
      )
      const totalProteinValue = (mealsResult.data ?? []).reduce(
        (sum, m) => sum + Number(m.protein_g ?? 0),
        0
      )
      setTotalCalories(totalCaloriesValue)
      setTotalProtein(totalProteinValue)

      const p = profileResult.data
      const targetCaloriesValue = p?.target_calories ?? null
      const targetProteinGValue = p?.target_protein_g ?? null
      const targetWeightKgValue = p?.target_weight_kg ?? null
      const useWorkoutValue = Boolean(p?.use_workout)
      const useBeautyValue = Boolean(p?.use_beauty)

      if (p) {
        setWeightKg(p.weight_kg === null ? null : Number(p.weight_kg))
        setTargetWeightKg(targetWeightKgValue === null ? null : Number(targetWeightKgValue))
        setTargetCalories(targetCaloriesValue === null ? null : Number(targetCaloriesValue))
        setTargetProteinG(targetProteinGValue === null ? null : Number(targetProteinGValue))
        setUseWorkout(useWorkoutValue)
        setUseBeauty(useBeautyValue)
      }
      if (workoutsTodayResult.data) {
        setWorkoutCountToday(workoutsTodayResult.data.length)
      }
      if (lastWorkoutResult.data) {
        setLastExerciseName(lastWorkoutResult.data.exercise_name)
      }
      if (lastBeautyResult.data) {
        setLatestBeautyCategories(lastBeautyResult.data.categories)
      }
      if (
        mealsResult.error ||
        profileResult.error ||
        workoutsTodayResult.error ||
        lastWorkoutResult.error
      ) {
        setError('データの読み込みに失敗しました')
      }
      setLoading(false)

      await loadTodos({
        todayDateStr: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        profile: {
          targetWeightKg: targetWeightKgValue,
          currentWeightKg: p?.weight_kg ?? null,
          targetCalories: targetCaloriesValue,
          targetProteinG: targetProteinGValue,
        },
        today: {
          totalCalories: totalCaloriesValue,
          totalProtein: totalProteinValue,
          remainingCalories:
            targetCaloriesValue !== null ? targetCaloriesValue - totalCaloriesValue : null,
          remainingProtein:
            targetProteinGValue !== null ? targetProteinGValue - totalProteinValue : null,
        },
        workout:
          useWorkoutValue && lastWorkoutResult.data
            ? {
                lastExerciseName: lastWorkoutResult.data.exercise_name,
                daysSinceLast: Math.floor(
                  (now.getTime() - new Date(lastWorkoutResult.data.created_at).getTime()) /
                    86400000
                ),
              }
            : useWorkoutValue
              ? { lastExerciseName: null, daysSinceLast: null }
              : null,
        beauty:
          useBeautyValue && lastBeautyResult.data
            ? {
                categories: lastBeautyResult.data.categories,
                concern: lastBeautyResult.data.concern,
              }
            : useBeautyValue
              ? { categories: null, concern: null }
              : null,
      })
    }

    async function loadTodos(context: {
      todayDateStr: string
      profile: unknown
      today: unknown
      workout: unknown
      beauty: unknown
    }) {
      setTodosLoading(true)
      setTodosError('')

      const { data: cached } = await supabase
        .from('daily_todos')
        .select('items')
        .eq('todo_date', context.todayDateStr)
        .maybeSingle()

      if (cached) {
        setTodos(cached.items as string[])
        setTodosLoading(false)
        return
      }

      try {
        const res = await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              profile: context.profile,
              today: context.today,
              workout: context.workout,
              beauty: context.beauty,
            },
          }),
        })

        const data = await res.json()

        if (!res.ok) throw new Error(data.error ?? 'ToDoの生成に失敗しました')

        setTodos(data.items)

        await supabase
          .from('daily_todos')
          .upsert({ todo_date: context.todayDateStr, items: data.items })
      } catch {
        setTodosError('ToDoの取得に失敗しました')
      } finally {
        setTodosLoading(false)
      }
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
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">今日のToDo</p>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-600">
              AI提案
            </span>
          </div>

          {todosLoading ? (
            <p className="mt-3 text-sm text-slate-400">考え中...</p>
          ) : todosError ? (
            <p className="mt-3 text-sm text-red-600">{todosError}</p>
          ) : todos.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              今日はこれといってやることはなさそうです
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {todos.map((todo, index) => (
                <li key={index} className="flex items-start gap-2.5 text-sm text-slate-900">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                  <span className="leading-relaxed">{todo}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

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

          {useWorkout && (
            <div className="col-span-2 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">筋トレ</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {workoutCountToday}
                <span className="text-sm font-medium text-slate-400"> 種目</span>
              </p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {lastExerciseName
                  ? `直近の記録: ${lastExerciseName}`
                  : 'まだ記録がありません'}
              </p>
            </div>
          )}

          {useBeauty && (
            <div className="col-span-2 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">美容</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {latestBeautyCategories ? latestBeautyCategories.join('・') : '—'}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {latestBeautyCategories ? '最近のプラン' : 'まだ相談していません'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/meals"
            className="rounded-xl bg-blue-600 py-3 text-center text-base font-medium text-white transition-colors"
          >
            食事を記録する
          </Link>
          {useWorkout && (
            <Link
              href="/workout"
              className="rounded-xl border border-slate-200 py-3 text-center text-base font-medium text-slate-700 transition-colors"
            >
              筋トレを記録する
            </Link>
          )}
          <Link
            href="/profile"
            className="rounded-xl border border-slate-200 py-3 text-center text-base font-medium text-slate-700 transition-colors"
          >
            体重を記録する
          </Link>
          {useBeauty && (
            <Link
              href="/beauty"
              className="rounded-xl border border-slate-200 py-3 text-center text-base font-medium text-slate-700 transition-colors"
            >
              美容相談をする
            </Link>
          )}
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
