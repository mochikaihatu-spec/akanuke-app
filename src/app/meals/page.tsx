'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const inputClass =
  'rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'text-sm font-medium text-slate-600'
const cardClass = 'rounded-3xl border border-slate-100 bg-white p-6 shadow-sm'

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">
          食事記録
        </h1>

        <div className={`mb-6 ${cardClass}`}>
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            写真から記録
          </h2>

          {!draftMode ? (
            <div className="flex flex-col items-center gap-3">
              {photoPreviewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreviewUrl}
                  alt="選択した写真"
                  className="h-40 w-40 rounded-2xl object-cover"
                />
              )}
              <label className="w-full cursor-pointer rounded-xl border border-slate-200 py-3 text-center text-base font-medium text-slate-700 transition-colors">
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
                  className="mx-auto h-40 w-40 rounded-2xl object-cover"
                />
              )}

              <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                AIの推定です。内容を確認・修正してから記録してください
              </p>

              <label className="flex flex-col gap-2">
                <span className={labelClass}>食品名</span>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className={labelClass}>カロリー (kcal)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={draftCalories}
                  onChange={(e) => setDraftCalories(e.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className={labelClass}>タンパク質量 (g)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={draftProteinG}
                  onChange={(e) => setDraftProteinG(e.target.value)}
                  className={inputClass}
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetPhotoState}
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-base font-medium text-slate-700 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPhotoMeal}
                  disabled={savingPhoto}
                  className="flex-1 rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
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

        <form onSubmit={handleSubmit} className={`flex flex-col gap-5 ${cardClass}`}>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>食品名</span>
            <input
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="例: 鶏胸肉のサラダ"
              required
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>カロリー (kcal)</span>
            <input
              type="number"
              inputMode="numeric"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="例: 350"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>タンパク質量 (g)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={proteinG}
              onChange={(e) => setProteinG(e.target.value)}
              placeholder="例: 30"
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

          {meals.length === 0 ? (
            <p className="text-sm text-slate-400">まだ記録がありません</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {meals.map((meal) => (
                <li
                  key={meal.id}
                  className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
                >
                  <span className="text-slate-900">{meal.description}</span>
                  <span className="text-slate-400">
                    {meal.calories ?? '-'} kcal / {meal.protein_g ?? '-'} g
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
            <div>
              <p className="text-xs font-medium text-slate-500">カロリー</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {totalCalories}
                <span className="text-sm font-medium text-slate-400"> kcal</span>
              </p>
              <p
                className={`mt-1 text-xs font-medium ${
                  remainingCalories !== null && remainingCalories < 0
                    ? 'text-red-600'
                    : 'text-slate-400'
                }`}
              >
                {remainingCalories === null
                  ? '目標未設定'
                  : remainingCalories < 0
                    ? `${Math.abs(remainingCalories)} kcal オーバー`
                    : `あと ${remainingCalories} kcal`}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">タンパク質</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {totalProtein.toFixed(1)}
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
                    ? `目標達成 +${Math.abs(remainingProtein).toFixed(1)}g`
                    : `あと ${remainingProtein.toFixed(1)}g`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
