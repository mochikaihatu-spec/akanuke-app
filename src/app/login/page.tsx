'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const inputClass =
  'rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'text-sm font-medium text-slate-600'

function translateError(message: string) {
  if (message.includes('Invalid login credentials')) {
    return 'メールアドレスまたはパスワードが違います'
  }
  if (message.includes('already registered')) {
    return 'このメールアドレスはすでに登録されています。ログインしてください'
  }
  if (message.includes('at least')) {
    return 'パスワードは6文字以上にしてください'
  }
  if (message.includes('Email not confirmed')) {
    return 'メールの確認が完了していません'
  }
  if (message.includes('valid email') || message.includes('invalid format')) {
    return 'メールアドレスの形式が正しくありません'
  }
  if (message.includes('rate limit')) {
    return '短時間に操作が多すぎます。少し待ってからお試しください'
  }
  return 'うまくいきませんでした。もう一度お試しください'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setSubmitting(false)
      if (error) {
        setError(translateError(error.message))
        return
      }
      router.push('/')
      router.refresh()
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)

    if (error) {
      setError(translateError(error.message))
      return
    }

    // メール確認をオフにしていれば、登録と同時にログイン状態になる
    if (data.session) {
      router.push('/')
      router.refresh()
      return
    }

    setNotice('確認メールを送りました。メール内のリンクを開いてからログインしてください')
    setMode('login')
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">アカヌケ</h1>
          <p className="mt-2 text-sm text-slate-500">
            ストイックに、自分を分析する。
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">
            {mode === 'login' ? 'ログイン' : 'アカウントを作成'}
          </h2>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>メールアドレス</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>パスワード(6文字以上)</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
          >
            {submitting ? '送信中...' : mode === 'login' ? 'ログイン' : '登録してはじめる'}
          </button>

          {notice && (
            <p className="text-center text-sm font-medium text-blue-600">{notice}</p>
          )}
          {error && (
            <p className="text-center text-sm font-medium text-red-600">{error}</p>
          )}
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
            setNotice('')
          }}
          className="mt-5 w-full text-center text-sm font-medium text-blue-600"
        >
          {mode === 'login'
            ? 'はじめての方はこちら(新規登録)'
            : 'すでにアカウントをお持ちの方はこちら(ログイン)'}
        </button>
      </div>
    </div>
  )
}
