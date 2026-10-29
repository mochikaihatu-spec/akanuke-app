'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUserId, supabase } from '@/lib/supabase'
import { AiApiError, aiErrorMessage } from '@/lib/ai-error'
import { useUsage } from '@/lib/use-usage'

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

// AIに送る写真の長辺の上限(px)。食事の判定には十分で、送信サイズ(Vercel は約4.5MBまで)と利用料も抑えられる
const MAX_PHOTO_EDGE = 1568

// スマートフォンの写真は数MBあるので、送る前に縮小してJPEGにする。
// 縮小できない(読み込めない)ときや、元のほうが小さいときは、元の写真をそのまま使う
async function prepareMealPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], 'meal.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
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

// 非公開バケットに「自分のユーザーIDのフォルダ」へ保存し、保存先のパスを返す
async function uploadMealPhoto(file: File) {
  const userId = await getUserId()
  if (!userId) throw new Error('ログインが必要です')

  // 保存先の名前に使えるのは英数字だけ(ファイル名に「.」がない・日本語などのときは jpg にする)
  const ext = file.name.match(/\.([A-Za-z0-9]{1,5})$/)?.[1].toLowerCase() ?? 'jpg'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from('meal-photos').upload(path, file)
  if (error) throw error

  return path
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
  const [photoNotice, setPhotoNotice] = useState('')

  // 写真解析の残り回数(数えるのはサーバー。ここは表示と、上限に達したときの無効化だけ)
  const { usage, reload: reloadUsage } = useUsage()
  const photoUsage = usage?.items.meal_photo
  const photoLimitReached = photoUsage?.remaining === 0

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
        .maybeSingle(),
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
    // データ取得後(await の後)に state を更新するだけなので問題ない。ルールの誤検知
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setPhotoNotice('')
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || photoLimitReached) return

    setPhotoError('')
    setPhotoNotice('')
    setAnalyzing(true)
    setPhotoPreviewUrl(URL.createObjectURL(file))

    try {
      const photo = await prepareMealPhoto(file)
      const base64 = await fileToBase64(photo)

      const [uploaded, analysis] = await Promise.all([
        // 写真の保存に失敗しても、解析の結果は使えるようにする(解析はすでに1回として数えられるため)
        uploadMealPhoto(photo).then(
          (path) => ({ path, reason: '' }),
          (e: unknown) => {
            console.error('Meal photo upload failed:', e)
            return { path: null, reason: e instanceof Error ? e.message : '' }
          }
        ),
        fetch('/api/analyze-meal-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType: photo.type }),
        }).then(async (res) => {
          // サーバーに届く前に断られたとき(413 など)は JSON ではないので、読めなくても落とさない
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new AiApiError(
              data.error ??
                (res.status === 413 ? '写真が大きすぎます。別の写真でお試しください' : '解析に失敗しました')
            )
          }
          return data
        }),
      ])

      setDraftPhotoUrl(uploaded.path)
      if (uploaded.path === null) {
        setPhotoNotice(`写真の保存に失敗したため、写真なしで記録されます${uploaded.reason ? `(理由: ${uploaded.reason})` : ''}`)
      }
      setDraftName(analysis.name ?? '')
      setDraftCalories(analysis.calories !== null ? String(analysis.calories) : '')
      setDraftProteinG(
        analysis.protein_g !== null ? String(analysis.protein_g) : ''
      )
      setDraftMode(true)
    } catch (e) {
      setPhotoError(aiErrorMessage(e, '写真の解析に失敗しました。もう一度お試しください'))
      setPhotoPreviewUrl(null)
    } finally {
      setAnalyzing(false)
      // 成功で1回減った/上限(429)だった、どちらも最新の残り回数に取り直す
      reloadUsage()
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
              {photoUsage && (
                <div className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
                  <p className="font-semibold text-slate-900">
                    {photoUsage.period === 'month' ? '今月' : '本日'}あと{photoUsage.remaining}回
                    <span className="ml-1 text-xs font-normal text-slate-500">(全{photoUsage.limit}回)</span>
                  </p>
                  {photoLimitReached ? (
                    <>
                      <p className="mt-1 text-xs text-slate-600">
                        上限に達しました。{photoUsage.resetLabel}にリセットされます。
                      </p>
                      {photoUsage.hint && <p className="mt-1 text-xs text-slate-500">{photoUsage.hint}</p>}
                    </>
                  ) : (
                    <p className="mt-0.5 text-xs text-slate-500">{photoUsage.resetLabel}にリセットされます</p>
                  )}
                </div>
              )}
              <label
                aria-disabled={analyzing || photoLimitReached}
                className={`w-full rounded-xl border py-3 text-center text-base font-medium transition-colors ${
                  photoLimitReached
                    ? 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-500'
                    : 'cursor-pointer border-slate-200 text-slate-700'
                }`}
              >
                {analyzing ? '解析中...' : photoLimitReached ? '上限に達しました' : '写真から記録する'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  disabled={analyzing || photoLimitReached}
                  className="hidden"
                />
              </label>
              <p className="text-center text-xs text-slate-500">
                カメラで撮影するか、アルバム(フォルダ)の写真を選べます。手入力は回数に関係なくいつでもできます
              </p>
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
              {photoNotice && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  {photoNotice}
                </p>
              )}

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
