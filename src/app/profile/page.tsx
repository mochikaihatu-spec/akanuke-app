'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserId, supabase } from '@/lib/supabase'
import Toggle from '@/components/Toggle'

// ログイン中の自分のプロフィール行だけを更新する。失敗したらtrueを返す
async function updateMyProfile(values: Record<string, unknown>) {
  const userId = await getUserId()
  if (!userId) return true

  const { data, error } = await supabase
    .from('profile')
    .update(values)
    .eq('user_id', userId)
    .select('user_id')

  return Boolean(error) || !data || data.length === 0
}

function broadcastFeatureFlag(key: 'use_workout' | 'use_beauty', value: boolean) {
  window.dispatchEvent(
    new CustomEvent('akanuke:feature-flags-changed', { detail: { key, value } })
  )
}

const inputClass =
  'rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'text-sm font-medium text-slate-600'

export default function ProfilePage() {
  const router = useRouter()
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [targetCalories, setTargetCalories] = useState('')
  const [targetProteinG, setTargetProteinG] = useState('')
  const [faceIllustration, setFaceIllustration] = useState<'male' | 'female'>('female')
  const [useWorkout, setUseWorkout] = useState(false)
  const [useBeauty, setUseBeauty] = useState(false)
  const [featureError, setFeatureError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [recordingWeight, setRecordingWeight] = useState(false)
  const [weightRecorded, setWeightRecorded] = useState(false)
  const [weightRecordError, setWeightRecordError] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase
        .from('profile')
        .select('*')
        .maybeSingle()

      if (data) {
        setHeightCm(data.height_cm?.toString() ?? '')
        setWeightKg(data.weight_kg?.toString() ?? '')
        setTargetWeightKg(data.target_weight_kg?.toString() ?? '')
        setTargetCalories(data.target_calories?.toString() ?? '')
        setTargetProteinG(data.target_protein_g?.toString() ?? '')
        if (data.face_illustration === 'male' || data.face_illustration === 'female') {
          setFaceIllustration(data.face_illustration)
        }
        setUseWorkout(Boolean(data.use_workout))
        setUseBeauty(Boolean(data.use_beauty))
      }
      if (error) {
        setError('プロフィールの読み込みに失敗しました')
      }
      setLoading(false)
    }

    loadProfile()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')

    const failed = await updateMyProfile({
      height_cm: heightCm === '' ? null : Number(heightCm),
      weight_kg: weightKg === '' ? null : Number(weightKg),
      target_weight_kg: targetWeightKg === '' ? null : Number(targetWeightKg),
      target_calories: targetCalories === '' ? null : Number(targetCalories),
      target_protein_g: targetProteinG === '' ? null : Number(targetProteinG),
      face_illustration: faceIllustration,
      updated_at: new Date().toISOString(),
    })

    setSaving(false)

    if (failed) {
      setError('保存に失敗しました。もう一度お試しください')
      return
    }

    setSaved(true)
  }

  async function handleToggleUseWorkout(value: boolean) {
    setUseWorkout(value)
    setFeatureError('')

    const failed = await updateMyProfile({ use_workout: value })

    if (failed) {
      setUseWorkout(!value)
      setFeatureError('設定の保存に失敗しました')
      return
    }

    broadcastFeatureFlag('use_workout', value)
  }

  async function handleToggleUseBeauty(value: boolean) {
    setUseBeauty(value)
    setFeatureError('')

    const failed = await updateMyProfile({ use_beauty: value })

    if (failed) {
      setUseBeauty(!value)
      setFeatureError('設定の保存に失敗しました')
      return
    }

    broadcastFeatureFlag('use_beauty', value)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleRecordWeight() {
    if (weightKg === '') {
      setWeightRecordError('体重を入力してください')
      return
    }

    setRecordingWeight(true)
    setWeightRecorded(false)
    setWeightRecordError('')

    const { error } = await supabase.from('weight_records').insert({
      weight_kg: Number(weightKg),
      recorded_at: new Date().toISOString(),
    })

    setRecordingWeight(false)

    if (error) {
      setWeightRecordError('記録に失敗しました。もう一度お試しください')
      return
    }

    setWeightRecorded(true)
  }

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
          プロフィール
        </h1>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
        >
          <label className="flex flex-col gap-2">
            <span className={labelClass}>身長 (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="例: 165.0"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>現在の体重 (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="例: 60.0"
              className={inputClass}
            />
          </label>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleRecordWeight}
              disabled={recordingWeight}
              className="rounded-xl border border-slate-200 py-3 text-base font-medium text-slate-700 transition-colors disabled:opacity-50"
            >
              {recordingWeight ? '記録中...' : '今日の体重を記録する'}
            </button>

            {weightRecorded && (
              <p className="text-center text-sm font-medium text-green-600">
                記録しました
              </p>
            )}
            {weightRecordError && (
              <p className="text-center text-sm font-medium text-red-600">
                {weightRecordError}
              </p>
            )}
          </div>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>目標体重 (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={targetWeightKg}
              onChange={(e) => setTargetWeightKg(e.target.value)}
              placeholder="例: 55.0"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>目標カロリー (kcal/日)</span>
            <input
              type="number"
              inputMode="numeric"
              value={targetCalories}
              onChange={(e) => setTargetCalories(e.target.value)}
              placeholder="例: 1800"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>目標タンパク質量 (g/日)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={targetProteinG}
              onChange={(e) => setTargetProteinG(e.target.value)}
              placeholder="例: 90"
              className={inputClass}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className={labelClass}>美容相談で表示するイラスト</span>
            <div className="flex gap-2">
              {(
                [
                  { value: 'female' as const, label: '女性用' },
                  { value: 'male' as const, label: '男性用' },
                ]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFaceIllustration(option.value)}
                  className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                    faceIllustration === option.value
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <span className={labelClass}>使う機能を選ぶ</span>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">筋トレ管理を使う</span>
              <Toggle checked={useWorkout} onChange={handleToggleUseWorkout} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">美容相談を使う</span>
              <Toggle checked={useBeauty} onChange={handleToggleUseBeauty} />
            </div>

            {featureError && (
              <p className="text-center text-xs font-medium text-red-600">
                {featureError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存する'}
          </button>

          {saved && (
            <p className="text-center text-sm font-medium text-green-600">
              保存しました
            </p>
          )}
          {error && (
            <p className="text-center text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 w-full rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-600 transition-colors"
        >
          ログアウト
        </button>
      </div>
    </div>
  )
}
