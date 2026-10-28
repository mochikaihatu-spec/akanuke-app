'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AiApiError, aiErrorMessage } from '@/lib/ai-error'
import { useUsage } from '@/lib/use-usage'
import UsageNote from '@/components/UsageNote'
import type { DiffItem } from '@/lib/plan-patch'

type Proposal = {
  proposalId: number | null
  message: string
  diff: DiffItem[]
  warnings: string[]
}

const EXAMPLES = ['朝は時間がない', 'お金をかけたくない', 'この行動がつらい', 'もっと簡単にしたい']
const MAX_CHARS = 500

const KIND_LABEL: Record<DiffItem['kind'], string> = {
  changed: '変更',
  added: '追加',
  removed: '削除',
}

export default function ConsultPage() {
  const [text, setText] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [step, setStep] = useState<'input' | 'loading' | 'proposal' | 'applied' | 'dismissed'>('input')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { usage, reload: reloadUsage } = useUsage()

  const adjustUsage = usage?.items.plan_adjust
  const outOfTurns = adjustUsage !== undefined && adjustUsage.remaining === 0

  async function handleConsult(e: React.FormEvent) {
    e.preventDefault()
    if (text.trim() === '') {
      setError('相談したいことを入力してください')
      return
    }

    setError('')
    setStep('loading')

    try {
      const res = await fetch('/api/plan/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new AiApiError(data.error ?? '調整案の作成に失敗しました')

      setProposal(data)
      setStep('proposal')
    } catch (err) {
      setError(aiErrorMessage(err, '調整案の作成に失敗しました。もう一度お試しください'))
      setStep('input')
    } finally {
      reloadUsage()
    }
  }

  async function handleApply() {
    if (!proposal?.proposalId || busy) return
    setBusy(true)
    setError('')

    try {
      const res = await fetch('/api/plan/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.proposalId }),
      })
      const data = await res.json()
      if (!res.ok) throw new AiApiError(data.error ?? '変更に失敗しました')
      setStep('applied')
    } catch (err) {
      setError(aiErrorMessage(err, '変更に失敗しました。もう一度お試しください'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDismiss() {
    if (busy) return
    if (proposal?.proposalId) {
      setBusy(true)
      await supabase
        .from('plan_proposals')
        .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
        .eq('id', proposal.proposalId)
        .eq('status', 'pending')
      setBusy(false)
    }
    setStep('dismissed')
  }

  function reset() {
    setProposal(null)
    setError('')
    setStep('input')
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/plan" className="text-sm font-medium text-blue-600">
          ← マイプランにもどる
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          プランについて相談する
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          続けにくいところを教えてください。AIが調整案を出します。
          <strong className="font-semibold text-slate-700">あなたが「変更する」を押すまで、プランは変わりません。</strong>
        </p>

        {(step === 'input' || step === 'loading') && (
          <form
            onSubmit={handleConsult}
            className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">どうしたいですか?</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_CHARS}
                rows={4}
                disabled={step === 'loading'}
                placeholder="例: 朝は忙しくて保湿が続かないので、夜だけにしたい"
                className="rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <span className="text-right text-xs text-slate-400">
                {text.length}/{MAX_CHARS}
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText(example)}
                  disabled={step === 'loading'}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>

            <UsageNote item={adjustUsage} />

            <button
              type="submit"
              disabled={step === 'loading' || outOfTurns}
              className="rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
            >
              {step === 'loading' ? '調整案を考えています...(20秒ほど)' : '相談する'}
            </button>

            {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}
          </form>
        )}

        {step === 'proposal' && proposal && (
          <div className="mt-6 flex flex-col gap-4">
            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
              <p className="text-xs font-medium text-blue-700">AIからのひと言</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{proposal.message}</p>
            </section>

            {proposal.diff.length === 0 ? (
              <section className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
                <p className="text-sm leading-relaxed text-slate-600">
                  今回は、プランの変更はありません。
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 w-full rounded-xl border border-slate-200 py-3 text-base font-medium text-slate-600"
                >
                  別のことを相談する
                </button>
              </section>
            ) : (
              <>
                <h2 className="text-base font-semibold text-slate-900">変更の内容</h2>
                {proposal.diff.map((item, index) => (
                  <section
                    key={index}
                    className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {KIND_LABEL[item.kind]}
                      </span>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    </div>
                    {item.before && (
                      <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                        <p className="text-[10px] font-medium text-slate-400">変更前</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-500">
                          {item.before}
                        </p>
                      </div>
                    )}
                    {item.after && (
                      <div className="mt-2 rounded-2xl bg-blue-50 p-3">
                        <p className="text-[10px] font-medium text-blue-600">変更後</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-800">
                          {item.after}
                        </p>
                      </div>
                    )}
                  </section>
                ))}

                {proposal.warnings.length > 0 && (
                  <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <p className="text-xs font-semibold text-amber-700">ご確認ください</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-amber-800">
                      {proposal.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={busy}
                    className="rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {busy ? '変更しています...' : 'この内容で変更する'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-600 disabled:opacity-50"
                  >
                    やめる
                  </button>
                  <p className="text-center text-xs text-slate-400">
                    変更しても、今のプランは履歴として残ります
                  </p>
                </div>

                {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}
              </>
            )}
          </div>
        )}

        {step === 'applied' && (
          <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-900">プランを調整しました</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              元のプランは履歴に残っています。「何日目か」の数え方と、これまでの記録は、そのまま続きます。
            </p>
            <Link
              href="/plan"
              className="mt-4 block rounded-xl bg-blue-600 py-3 text-base font-medium text-white"
            >
              マイプランを見る
            </Link>
          </section>
        )}

        {step === 'dismissed' && (
          <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-900">プランは変更していません</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-slate-200 py-3 text-base font-medium text-slate-600"
              >
                もう一度相談する
              </button>
              <Link
                href="/plan"
                className="rounded-xl bg-blue-600 py-3 text-base font-medium text-white"
              >
                マイプランにもどる
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
