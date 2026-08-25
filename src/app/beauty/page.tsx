'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import FaceDiagram, { type FaceIllustration, type FacePart } from '@/components/FaceDiagram'

const cardClass = 'rounded-3xl border border-slate-100 bg-white p-6 shadow-sm'

type IconProps = { className?: string }

function HairIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 11c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      <path d="M6.5 11v5.5M17.5 11v5.5" />
    </svg>
  )
}

function BrowIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4.5 14.5c2.2-3.4 5-5 7.5-5s5.3 1.6 7.5 5" />
    </svg>
  )
}

function SkinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3c3.2 4.2 6 7.8 6 11.2A6 6 0 1 1 6 14.2C6 10.8 8.8 7.2 12 3Z" />
    </svg>
  )
}

function FaceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.3 15.2c1.6 1.1 3.8 1.1 5.4 0" />
    </svg>
  )
}

function BodyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="5" r="2.3" />
      <path d="M9.3 13.2V9.6a2.7 2.7 0 0 1 5.4 0v3.6" />
      <path d="M8 20.5 9.3 13h5.4l1.3 7.5" />
    </svg>
  )
}

function PostureIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="4.3" r="2" />
      <path d="M12 6.3V15" />
      <path d="M9 9.8h6" />
      <path d="M9 20.5l3-5.5 3 5.5" />
    </svg>
  )
}

function OutfitIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 4 4.5 7.2l2 3 2-1.1V20h7V9.1l2 1.1 2-3L14 4l-2 2h-1L9 4Z" />
    </svg>
  )
}

function FreshIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9.5" cy="14.5" r="4" />
      <circle cx="17" cy="7.5" r="2" />
    </svg>
  )
}

function SparkleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
      <path d="M12 3c.6 2.7 1.4 4.5 2.5 5.6C15.6 9.6 17.3 10.4 20 11c-2.7.6-4.5 1.4-5.6 2.5C13.4 14.6 12.6 16.3 12 19c-.6-2.7-1.4-4.5-2.5-5.6C8.4 12.4 6.7 11.6 4 11c2.7-.6 4.5-1.4 5.6-2.5C10.6 7.5 11.4 5.7 12 3Z" />
    </svg>
  )
}

const CATEGORIES: { label: string; Icon: (p: IconProps) => React.JSX.Element }[] = [
  { label: '髪', Icon: HairIcon },
  { label: '眉', Icon: BrowIcon },
  { label: '肌', Icon: SkinIcon },
  { label: '顔', Icon: FaceIcon },
  { label: '体型', Icon: BodyIcon },
  { label: '姿勢', Icon: PostureIcon },
  { label: '服装', Icon: OutfitIcon },
  { label: '清潔感', Icon: FreshIcon },
]

const GOALS = [
  'もっと清潔感を出したい',
  '垢抜けたい',
  '顔をスッキリ見せたい',
  '大人っぽくなりたい',
  '自分に似合う髪型を知りたい',
  '第一印象を良くしたい',
]

type Consultation = {
  id: number
  categories: string[]
  concern: string | null
  answer: string
  created_at: string
}

type Plan = {
  title?: string
  items?: { part: string; advice: string }[]
  weeklyTasks?: string[]
}

function parsePlan(answer: string): Plan | null {
  try {
    const parsed = JSON.parse(answer)
    if (parsed && Array.isArray(parsed.items)) return parsed as Plan
    return null
  } catch {
    return null
  }
}

function PlanAnswer({ answer }: { answer: string }) {
  const plan = parsePlan(answer)

  if (!plan) {
    return <p className="whitespace-pre-wrap text-sm text-slate-700">{answer}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {plan.title && (
        <p className="text-sm font-semibold text-slate-900">{plan.title}</p>
      )}

      {plan.items && plan.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {plan.items.map((item, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[11px] font-semibold text-amber-700">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{item.part}</p>
                <p className="text-sm leading-relaxed text-slate-600">{item.advice}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {plan.weeklyTasks && plan.weeklyTasks.length > 0 && (
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">今週やること</p>
          <ul className="flex flex-col gap-2">
            {plan.weeklyTasks.map((task, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="h-4 w-4 shrink-0 rounded border border-slate-300" />
                {task}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function BeautyPage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [concern, setConcern] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const [history, setHistory] = useState<Consultation[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [activePart, setActivePart] = useState<FacePart | null>(null)
  const ctaRef = useRef<HTMLDivElement>(null)

  const [illustration, setIllustration] = useState<FaceIllustration>('female')

  async function loadHistory() {
    const { data, error } = await supabase
      .from('beauty_consultations')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setHistory(data)
    if (error) setError('過去の相談履歴の読み込みに失敗しました')
    setLoadingHistory(false)
  }

  useEffect(() => {
    loadHistory()

    supabase
      .from('profile')
      .select('face_illustration')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data?.face_illustration === 'male' || data?.face_illustration === 'female') {
          setIllustration(data.face_illustration)
        }
      })
  }, [])

  function toggleCategory(category: string) {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  function toggleGoal(goal: string) {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    )
  }

  function getLatestForPart(part: FacePart) {
    return history.find((item) => item.categories.includes(part)) ?? null
  }

  function handleConsultFromDiagram(part: FacePart) {
    setSelectedCategories((prev) => (prev.includes(part) ? prev : [...prev, part]))
    setActivePart(null)
    ctaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function buildConcernText() {
    const goalsLine =
      selectedGoals.length > 0 ? `なりたい印象: ${selectedGoals.join('、')}` : ''
    const freeText = concern.trim()
    return [goalsLine, freeText].filter(Boolean).join('\n') || null
  }

  async function handleSubmit() {
    if (selectedCategories.length === 0 || sending) {
      setError('気になるところを1つ以上選んでください')
      return
    }

    setSending(true)
    setError('')

    const finalConcern = buildConcernText()

    try {
      const res = await fetch('/api/beauty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: selectedCategories,
          concern: finalConcern,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? '回答の取得に失敗しました')
      }

      const { error: insertError } = await supabase
        .from('beauty_consultations')
        .insert({
          categories: selectedCategories,
          concern: finalConcern,
          answer: data.answer,
        })

      if (insertError) {
        setError('回答は取得できましたが、保存に失敗しました')
      }

      setSelectedCategories([])
      setSelectedGoals([])
      setConcern('')
      await loadHistory()
    } catch {
      setError('回答の取得に失敗しました。もう一度お試しください')
    } finally {
      setSending(false)
    }
  }

  const selectionCount = selectedCategories.length

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            今日の垢抜け
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            気になるところを選ぶだけ。あなたに合った垢抜け方法をAIが提案します。
          </p>
        </div>

        <div className={cardClass}>
          <FaceDiagram
            illustration={illustration}
            activePart={activePart}
            onTapPart={setActivePart}
          />

          {activePart && (
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-900">
                {activePart}について
              </p>

              {(() => {
                if (loadingHistory) {
                  return <p className="text-sm text-slate-400">読み込み中...</p>
                }

                const latest = getLatestForPart(activePart)

                if (!latest) {
                  return (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-slate-500">
                        まだ相談していません。タップして提案をもらいましょう。
                      </p>
                      <button
                        type="button"
                        onClick={() => handleConsultFromDiagram(activePart)}
                        className="rounded-xl bg-blue-600 py-2 text-sm font-medium text-white transition-colors"
                      >
                        この部分を相談に追加する
                      </button>
                    </div>
                  )
                }

                return (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-slate-400">
                      {new Date(latest.created_at).toLocaleDateString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                      の提案
                    </span>
                    <div className="rounded-xl bg-white/80 p-3">
                      <PlanAnswer answer={latest.answer} />
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        <div className={cardClass}>
          <p className="text-base font-semibold text-slate-900">どこを変えたい?</p>
          <p className="mt-0.5 mb-4 text-xs text-slate-400">複数選べます</p>

          <div className="grid grid-cols-4 gap-2.5">
            {CATEGORIES.map(({ label, Icon }) => {
              const isSelected = selectedCategories.includes(label)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleCategory(label)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition-colors ${
                    isSelected
                      ? 'border-violet-200 bg-violet-50 text-violet-700'
                      : 'border-slate-100 bg-slate-50 text-slate-500'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className={cardClass}>
          <p className="text-base font-semibold text-slate-900">
            どんな印象になりたい?
          </p>
          <p className="mt-0.5 mb-4 text-xs text-slate-400">
            当てはまるものを選んでください(複数可)
          </p>

          <div className="flex flex-col gap-2">
            {GOALS.map((goal) => {
              const isSelected = selectedGoals.includes(goal)
              return (
                <button
                  key={goal}
                  type="button"
                  onClick={() => toggleGoal(goal)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-slate-100 bg-slate-50 text-slate-600'
                  }`}
                >
                  {goal}
                </button>
              )
            })}
          </div>

          <label className="mt-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-slate-500">
              具体的に気になることがあれば(任意)
            </span>
            <textarea
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="例: 丸顔に似合う髪型が知りたい"
              rows={2}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div
          ref={ctaRef}
          className="rounded-3xl bg-gradient-to-br from-blue-600 to-violet-500 p-6 shadow-sm"
        >
          <p className="text-sm font-medium text-white/80">
            AIがあなたに合った改善方法を提案します
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-white">
            あなた専用の垢抜けプランを作る
          </p>

          {selectionCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedCategories.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending}
            className="mt-4 w-full rounded-xl bg-white py-3 text-base font-semibold text-blue-700 transition-opacity disabled:opacity-60"
          >
            {sending ? 'プランを作成中...' : 'プランを作成する'}
          </button>

          {error && (
            <p className="mt-3 text-center text-sm font-medium text-rose-100">
              {error}
            </p>
          )}
        </div>

        <div className={cardClass}>
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            これまでのプラン
          </h2>

          {loadingHistory ? (
            <p className="text-sm text-slate-400">読み込み中...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-400">
              まだプランがありません。上から作ってみましょう。
            </p>
          ) : (
            <ul className="flex flex-col gap-5">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 border-b border-slate-100 pb-5 last:border-none last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-600"
                      >
                        {category}
                      </span>
                    ))}
                    <span className="ml-auto text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleDateString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <PlanAnswer answer={item.answer} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
