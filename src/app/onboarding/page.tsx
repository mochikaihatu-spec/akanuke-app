'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserId, supabase } from '@/lib/supabase'
import { AiApiError, aiErrorMessage } from '@/lib/ai-error'
import {
  AREAS,
  DAILY_MINUTES,
  IDEAL_EXAMPLES,
  IDEAL_LIMITS,
  MONTHLY_BUDGETS,
  validateIdealInput,
  type Area,
  type MonthlyBudget,
} from '@/lib/plan-schema'

const inputClass =
  'rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'text-sm font-medium text-slate-600'

function chipClass(selected: boolean) {
  return `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
    selected
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-slate-200 bg-white text-slate-600'
  }`
}

export default function OnboardingPage() {
  const router = useRouter()

  const [idealText, setIdealText] = useState('')
  const [focusAreas, setFocusAreas] = useState<Area[]>([])
  const [concerns, setConcerns] = useState('')
  const [budget, setBudget] = useState<MonthlyBudget | null>(null)
  const [minutes, setMinutes] = useState<number | null>(null)
  const [preferences, setPreferences] = useState('')

  const [hasPlan, setHasPlan] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 前に答えた内容があれば復元する
  useEffect(() => {
    async function load() {
      const [idealResult, planResult] = await Promise.all([
        supabase.from('ideal_profiles').select('*').maybeSingle(),
        supabase.from('plans').select('id').eq('status', 'active').maybeSingle(),
      ])

      const data = idealResult.data
      if (data) {
        setIdealText(data.ideal_text ?? '')
        setFocusAreas(((data.focus_areas ?? []) as string[]).filter((a): a is Area =>
          (AREAS as readonly string[]).includes(a)
        ))
        setConcerns(data.concerns ?? '')
        setBudget((data.monthly_budget as MonthlyBudget | null) ?? null)
        setMinutes(data.daily_minutes ?? null)
        setPreferences(data.preferences ?? '')
      }
      setHasPlan(Boolean(planResult.data))
      setLoading(false)
    }

    load()
  }, [])

  function toggleArea(area: Area) {
    setFocusAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const checked = validateIdealInput({
      ideal_text: idealText,
      focus_areas: focusAreas,
      concerns,
      monthly_budget: budget,
      daily_minutes: minutes,
      preferences,
    })
    if (!checked.ok) {
      setError(checked.error)
      return
    }

    if (
      hasPlan &&
      !window.confirm(
        '今のプランは「履歴」に残り、新しいプランが表示されます。\nAIで新しくプランを作りますか?'
      )
    ) {
      return
    }

    setSubmitting(true)

    try {
      const userId = await getUserId()
      if (!userId) throw new Error('not logged in')

      const { error: saveError } = await supabase.from('ideal_profiles').upsert(
        { user_id: userId, ...checked.value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      if (saveError) throw saveError

      const res = await fetch('/api/plan', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new AiApiError(data.error ?? 'プランの作成に失敗しました')

      router.push('/plan')
      router.refresh()
    } catch (err) {
      setError(aiErrorMessage(err, 'プランの作成に失敗しました。もう一度お試しください'))
      setSubmitting(false)
    }
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          憧れを、あなた専用のプランに
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          いくつか教えてください。AIが、無理なく続けられる行動プランを作ります。
          必須なのは最初の1つだけで、あとは答えられる範囲で大丈夫です。
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="ideal" className={labelClass}>
              どんな雰囲気に憧れますか? <span className="text-red-500">*</span>
            </label>
            <input
              id="ideal"
              type="text"
              value={idealText}
              onChange={(e) => setIdealText(e.target.value)}
              maxLength={IDEAL_LIMITS.idealText}
              placeholder="例: K-POPアイドルっぽい"
              className={inputClass}
            />
            <div className="flex flex-wrap gap-2">
              {IDEAL_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setIdealText(example)}
                  className={chipClass(idealText === example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelClass}>取り組みたい部分(複数OK・全部やらなくて大丈夫)</span>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  className={chipClass(focusAreas.includes(area))}
                >
                  {area}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">選ばなければ、AIがおすすめを選びます</p>
          </div>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>気になっていること(任意)</span>
            <textarea
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              maxLength={IDEAL_LIMITS.concerns}
              rows={3}
              placeholder="例: 肌荒れが続く、髪がまとまらない"
              className={inputClass}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className={labelClass}>1か月に使える予算(任意)</span>
            <div className="flex flex-wrap gap-2">
              {MONTHLY_BUDGETS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setBudget(budget === b.value ? null : b.value)}
                  className={chipClass(budget === b.value)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelClass}>1日に使える時間(任意)</span>
            <div className="flex flex-wrap gap-2">
              {DAILY_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(minutes === m ? null : m)}
                  className={chipClass(minutes === m)}
                >
                  {m === 60 ? '1時間' : `${m}分`}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>好み・生活のこと(任意)</span>
            <textarea
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              maxLength={IDEAL_LIMITS.preferences}
              rows={3}
              placeholder="例: 学生、メイクは最小限がいい、朝が弱い"
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
          >
            {submitting ? 'プランを作っています...(30秒ほど)' : hasPlan ? 'プランを作り直す' : 'プランを作る'}
          </button>

          {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
          AIの提案は一般的な情報で、医療や診断ではありません。
        </p>
      </div>
    </div>
  )
}
