'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type MealRecord = {
  id: number
  description: string
  calories: number | null
  protein_g: number | null
  eaten_at: string
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadMealPhoto(file: File) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from('meal-photos').upload(path, file)
  if (error) throw error

  const { data } = supabase.storage.from('meal-photos').getPublicUrl(path)
  return data.publicUrl
}

export default function MealsPage() {
  const [foodName, setFoodName] = useState('')
  const [calories, setCalories] = useState('')
  const [proteinG, setProteinG] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [meals, setMeals] = useState<MealRecord[]>([])
  const [targetCalories, setTargetCalories] = useState<number | null>(null)
  const [targetProteinG, setTargetProteinG] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [draftMode, setDraftMode] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftCalories, setDraftCalories] = useState('')
  const [draftProteinG, setDraftProteinG] = useState('')
  const [draftPhotoUrl, setDraftPhotoUrl] = useState<string | null>(null)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')

  const loadData = useCallback(async () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const [mealsResult, profileResult] = await Promise.all([
      supabase
        .from('meal_records')
        .select('id, description, calories, protein_g, eaten_at')
        .gte('eaten_at', startOfDay.toISOString())
        .lt('eaten_at', endOfDay.toISOString())
        .order('eaten_at', { ascending: true }),
      supabase
        .from('profile')
        .select('target_calories, target_protein_g')
        .eq('id', 1)
        .single(),
    ])

    if (mealsResult.data) setMeals(mealsResult.data)
    if (profileResult.data) {
      setTargetCalories(profileResult.data.target_calories)
      setTargetProteinG(profileResult.data.target_protein_g)
    }
    if (mealsResult.error || profileResult.error) {
      setError('データの読み込みに失敗しました')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error } = await supabase.from('meal_records').insert({
      description: foodName,
      calories: calories === '' ? null : Number(calories),
      protein_g: proteinG === '' ? null : Number(proteinG),
      eaten_at: new Date().toISOString(),
    })

    setSaving(false)

    if (error) {
      setError('記録に失敗しました。もう一度お試しください')
      return
    }

    setFoodName('')
    setCalories('')
    setProteinG('')
    await loadData()
  }

  function resetPhotoState() {
    setDraftMode(false)
    setDraftName('')
    setDraftCalories('')
    setDraftProteinG('')
    setDraftPhotoUrl(null)
    setPhotoPreviewUrl(null)
    setPhotoError('')
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setPhotoError('')
    setAnalyzing(true)
    setPhotoPreviewUrl(URL.createObjectURL(file))

    try {
      const base64 = await fileToBase64(file)

      const [uploadedUrl, analysis] = await Promise.all([
        uploadMealPhoto(file),
        fetch('/api/analyze-meal-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType: file.type }),
        }).then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? '解析に失敗しました')
          return data
        }),
      ])

      setDraftPhotoUrl(uploadedUrl)
      setDraftName(analysis.name ?? '')
      setDraftCalories(analysis.calories !== null ? String(analysis.calories) : '')
      setDraftProteinG(
        analysis.protein_g !== null ? String(analysis.protein_g) : ''
      )
      setDraftMode(true)
    } catch {
      setPhotoError('写真の解析に失敗しました。もう一度お試しください')
      setPhotoPreviewUrl(null)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleConfirmPhotoMeal() {
    if (draftName.trim() === '') {
      setPhotoError('食品名を入力してください')
      return
    }

    setSavingPhoto(true)
    setPhotoError('')

    const { error } = await supabase.from('meal_records').insert({
      description: draftName.trim(),
      calories: draftCalories === '' ? null : Number(draftCalories),
      protein_g: draftProteinG === '' ? null : Number(draftProteinG),
      photo_url: draftPhotoUrl,
      eaten_at: new Date().toISOString(),
    })

    setSavingPhoto(false)

    if (error) {
      setPhotoError('記録に失敗しました。もう一度お試しください')
      return
    }

    resetPhotoState()
    await loadData()
  }

  const totalCalories = meals.reduce((sum, m) => sum + Number(m.calories ?? 0), 0)
  const totalProtein = meals.reduce((sum, m) => sum + Number(m.protein_g ?? 0), 0)

  const remainingCalories =
    targetCalories !== null ? Number(targetCalories) - totalCalories : null
  const remainingProtein =
    targetProteinG !== null ? Number(targetProteinG) - totalProtein : null

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-zinc-900">
          食事記録
        </h1>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            写真から記録
          </h2>

          {!draftMode ? (
            <div className="flex flex-col items-center gap-3">
              {photoPreviewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreviewUrl}
                  alt="選択した写真"
                  className="h-40 w-40 rounded-xl object-cover"
                />
              )}
              <label className="w-full cursor-pointer rounded-xl border border-zinc-300 py-3 text-center text-base font-medium text-zinc-900 transition-colors">
                {analyzing ? '解析中...' : '写真から記録する'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  disabled={analyzing}
                  className="hidden"
                />
              </label>
              {photoError && (
                <p className="text-center text-sm font-medium text-red-600">
                  {photoError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {photoPreviewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreviewUrl}
                  alt="選択した写真"
                  className="mx-auto h-40 w-40 rounded-xl object-cover"
                />
              )}

              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                AIの推定です。内容を確認・修正してから記録してください
              </p>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">食品名</span>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">
                  カロリー (kcal)
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={draftCalories}
                  onChange={(e) => setDraftCalories(e.target.value)}
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">
                  タンパク質量 (g)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={draftProteinG}
                  onChange={(e) => setDraftProteinG(e.target.value)}
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetPhotoState}
                  className="flex-1 rounded-xl border border-zinc-300 py-3 text-base font-medium text-zinc-900 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPhotoMeal}
                  disabled={savingPhoto}
                  className="flex-1 rounded-xl bg-zinc-900 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
                >
                  {savingPhoto ? '記録中...' : 'この内容で記録する'}
                </button>
              </div>

              {photoError && (
                <p className="text-center text-sm font-medium text-red-600">
                  {photoError}
                </p>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm"
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">食品名</span>
            <input
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="例: 鶏胸肉のサラダ"
              required
              className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">カロリー (kcal)</span>
            <input
              type="number"
              inputMode="numeric"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="例: 350"
              className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">タンパク質量 (g)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={proteinG}
              onChange={(e) => setProteinG(e.target.value)}
              placeholder="例: 30"
              className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-xl bg-zinc-900 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
          >
            {saving ? '記録中...' : '記録する'}
          </button>

          {error && (
            <p className="text-center text-sm font-medium text-red-600">{error}</p>
          )}
        </form>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">今日の記録</h2>

          {meals.length === 0 ? (
            <p className="text-sm text-zinc-500">まだ記録がありません</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {meals.map((meal) => (
                <li
                  key={meal.id}
                  className="flex items-center justify-between border-b border-zinc-100 pb-2 text-sm"
                >
                  <span className="text-zinc-900">{meal.description}</span>
                  <span className="text-zinc-500">
                    {meal.calories ?? '-'} kcal / {meal.protein_g ?? '-'} g
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-col gap-2 border-t border-zinc-200 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-700">今日の合計カロリー</span>
              <span className="font-medium text-zinc-900">{totalCalories} kcal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-700">今日の合計タンパク質</span>
              <span className="font-medium text-zinc-900">
                {totalProtein.toFixed(1)} g
              </span>
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
      </div>
    </div>
  )
}
