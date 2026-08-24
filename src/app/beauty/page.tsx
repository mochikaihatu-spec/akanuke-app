'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import FaceDiagram, { type FacePart } from '@/components/FaceDiagram'

const CATEGORIES = ['肌', '眉', '髪型', '輪郭', '体型', '姿勢', '服装']

type Consultation = {
  id: number
  categories: string[]
  concern: string | null
  answer: string
  created_at: string
}

export default function BeautyPage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [concern, setConcern] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const [history, setHistory] = useState<Consultation[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [activePart, setActivePart] = useState<FacePart | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

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
  }, [])

  function toggleCategory(category: string) {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  function getLatestForPart(part: FacePart) {
    return history.find((item) => item.categories.includes(part)) ?? null
  }

  function handleConsultFromDiagram(part: FacePart) {
    setSelectedCategories([part])
    setActivePart(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedCategories.length === 0 || sending) {
      setError('カテゴリを1つ以上選んでください')
      return
    }

    setSending(true)
    setError('')

    try {
      const res = await fetch('/api/beauty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: selectedCategories,
          concern: concern.trim() === '' ? null : concern.trim(),
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
          concern: concern.trim() === '' ? null : concern.trim(),
          answer: data.answer,
        })

      if (insertError) {
        setError('回答は取得できましたが、保存に失敗しました')
      }

      setSelectedCategories([])
      setConcern('')
      await loadHistory()
    } catch {
      setError('回答の取得に失敗しました。もう一度お試しください')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-zinc-50 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-center text-xl font-semibold text-zinc-900">
          美容・垢抜け相談
        </h1>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <FaceDiagram activePart={activePart} onTapPart={setActivePart} />

          {activePart && (
            <div className="mt-4 rounded-xl bg-zinc-50 p-4">
              <p className="mb-2 text-sm font-semibold text-zinc-900">
                {activePart}について
              </p>

              {(() => {
                if (loadingHistory) {
                  return <p className="text-sm text-zinc-500">読み込み中...</p>
                }

                const latest = getLatestForPart(activePart)

                if (!latest) {
                  return (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-zinc-500">まだ相談していません</p>
                      <button
                        type="button"
                        onClick={() => handleConsultFromDiagram(activePart)}
                        className="rounded-xl bg-zinc-900 py-2 text-sm font-medium text-white transition-colors"
                      >
                        相談する
                      </button>
                    </div>
                  )
                }

                return (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-zinc-400">
                      {new Date(latest.created_at).toLocaleDateString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                      の相談
                    </span>
                    {latest.concern && (
                      <p className="text-sm text-zinc-600">
                        気になる点: {latest.concern}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-900">
                      {latest.answer}
                    </p>
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">
              気になるカテゴリ(複数選択可)
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category)
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-300 text-zinc-700'
                    }`}
                  >
                    {category}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">
              気になる点(任意)
            </span>
            <textarea
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="例: 丸顔に似合う髪型が知りたい"
              rows={3}
              className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-zinc-900 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
          >
            {sending ? '相談中...' : '相談する'}
          </button>

          {error && (
            <p className="text-center text-sm font-medium text-red-600">{error}</p>
          )}
        </form>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            過去の相談
          </h2>

          {loadingHistory ? (
            <p className="text-sm text-zinc-500">読み込み中...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-zinc-500">まだ相談履歴がありません</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 border-b border-zinc-100 pb-4 last:border-none last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {item.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                      >
                        {category}
                      </span>
                    ))}
                    <span className="ml-auto text-xs text-zinc-400">
                      {new Date(item.created_at).toLocaleDateString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {item.concern && (
                    <p className="text-sm text-zinc-600">気になる点: {item.concern}</p>
                  )}
                  <p className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-900">
                    {item.answer}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
