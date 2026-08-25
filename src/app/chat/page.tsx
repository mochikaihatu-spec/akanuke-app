'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

async function getTodayContext() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)

  const [mealsResult, profileResult] = await Promise.all([
    supabase
      .from('meal_records')
      .select('description, calories, protein_g')
      .gte('eaten_at', startOfDay.toISOString())
      .lt('eaten_at', endOfDay.toISOString())
      .order('eaten_at', { ascending: true }),
    supabase
      .from('profile')
      .select('target_calories, target_protein_g')
      .eq('id', 1)
      .single(),
  ])

  const meals = mealsResult.data ?? []
  const totalCalories = meals.reduce((sum, m) => sum + Number(m.calories ?? 0), 0)
  const totalProtein = meals.reduce((sum, m) => sum + Number(m.protein_g ?? 0), 0)

  return {
    meals,
    totalCalories,
    totalProtein,
    targetCalories: profileResult.data?.target_calories ?? null,
    targetProteinG: profileResult.data?.target_protein_g ?? null,
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (question === '' || sending) return

    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setSending(true)
    setError('')

    try {
      const context = await getTodayContext()

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? '回答の取得に失敗しました')
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }])
    } catch {
      setError('回答の取得に失敗しました。もう一度お試しください')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          食事のAI相談
        </h1>

        <div className="flex min-h-[50vh] flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          {messages.length === 0 ? (
            <p className="m-auto max-w-[80%] text-center text-sm text-slate-400">
              今日の食事や栄養について、なんでも聞いてみましょう
              <br />
              例:「今日あとどれくらいタンパク質摂ればいい?」
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-400">
                考え中...
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-center text-sm font-medium text-red-600">{error}</p>
        )}

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="質問を入力"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            disabled={sending || input.trim() === ''}
            className="rounded-xl bg-blue-600 px-5 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  )
}
