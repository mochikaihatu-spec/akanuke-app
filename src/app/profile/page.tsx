'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [targetCalories, setTargetCalories] = useState('')
  const [targetProteinG, setTargetProteinG] = useState('')
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
        .eq('id', 1)
        .single()

      if (data) {
        setHeightCm(data.height_cm?.toString() ?? '')
        setWeightKg(data.weight_kg?.toString() ?? '')
        setTargetWeightKg(data.target_weight_kg?.toString() ?? '')
        setTargetCalories(data.target_calories?.toString() ?? '')
        setTargetProteinG(data.target_protein_g?.toString() ?? '')
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

    const { error } = await supabase
      .from('profile')
      .update({
        height_cm: heightCm === '' ? null : Number(heightCm),
        weight_kg: weightKg === '' ? null : Number(weightKg),
        target_weight_kg: targetWeightKg === '' ? null : Number(targetWeightKg),
        target_calories: targetCalories === '' ? null : Number(targetCalories),
        target_protein_g: targetProteinG === '' ? null : Number(targetProteinG),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    setSaving(false)

    if (error) {
      setError('保存に失敗しました。もう一度お試しください')
      return
    }

    setSaved(true)
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-zinc-900">
          プロフィール
        </h1>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm"
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">身長 (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="例: 165.0"
              className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">現在の体重 (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="例: 60.0"
              className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleRecordWeight}
              disabled={recordingWeight}
              className="rounded-xl border border-zinc-300 py-3 text-base font-medium text-zinc-900 transition-colors disabled:opacity-50"
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
            <span className="text-sm font-medium text-zinc-700">目標体重 (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={targetWeightKg}
              onChange={(e) => setTargetWeightKg(e.target.value)}
              placeholder="例: 55.0"
              className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">目標カロリー (kcal/日)</span>
            <input
              type="number"
              inputMode="numeric"
              value={targetCalories}
              onChange={(e) => setTargetCalories(e.target.value)}
              placeholder="例: 1800"
              className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">目標タンパク質量 (g/日)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={targetProteinG}
              onChange={(e) => setTargetProteinG(e.target.value)}
              placeholder="例: 90"
              className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-xl bg-zinc-900 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
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
      </div>
    </div>
  )
}
