'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SnsPlatform, SnsPost } from '@/lib/notion'

const inputClass =
  'rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'text-sm font-medium text-slate-600'
const cardClass = 'rounded-3xl border border-slate-100 bg-white p-6 shadow-sm'

const PLATFORMS: SnsPlatform[] = ['TikTok', 'X', 'Instagram', 'note']
const FINAL_STATUSES = ['投稿済み', '分析済み', 'ボツ']

type RefineDraft = {
  title: string
  theme: string
  hook: string
  script: string
  telop: string
  materials: string
  cta: string
  reason: string
}

export default function SnsPage() {
  const [instruction, setInstruction] = useState('')
  const [platform, setPlatform] = useState<SnsPlatform>('TikTok')
  const [count, setCount] = useState('5')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const [allPosts, setAllPosts] = useState<SnsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [refineTargetId, setRefineTargetId] = useState('')
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState('')
  const [refineCurrent, setRefineCurrent] = useState<SnsPost | null>(null)
  const [refineDraft, setRefineDraft] = useState<RefineDraft | null>(null)
  const [applyingRefine, setApplyingRefine] = useState(false)

  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState('')
  const [analyzeResult, setAnalyzeResult] = useState<{ id: string; text: string } | null>(null)

  const loadPosts = useCallback(async () => {
    setListError('')
    try {
      const res = await fetch('/api/sns/posts')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '取得に失敗しました')
      setAllPosts(data.posts)
    } catch {
      setListError('投稿一覧を取得できませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  const proposals = useMemo(() => allPosts.filter((p) => p.status === 'AI提案'), [allPosts])
  const refineCandidates = useMemo(
    () => allPosts.filter((p) => p.status && !FINAL_STATUSES.includes(p.status)),
    [allPosts]
  )
  const postedCandidates = useMemo(() => allPosts.filter((p) => p.status === '投稿済み'), [allPosts])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setGenerateError('')

    try {
      const res = await fetch('/api/sns/generate-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, platform, count: Number(count) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '生成に失敗しました')
      setInstruction('')
      await loadPosts()
    } catch {
      setGenerateError('AIによる提案生成に失敗しました。もう一度お試しください')
    } finally {
      setGenerating(false)
    }
  }

  async function handleStatusChange(id: string, status: '採用' | 'ボツ') {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/sns/posts/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      await loadPosts()
    } catch {
      setListError('ステータスの更新に失敗しました')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleRefine(e: React.FormEvent) {
    e.preventDefault()
    setRefining(true)
    setRefineError('')
    setRefineCurrent(null)
    setRefineDraft(null)

    try {
      const res = await fetch('/api/sns/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: refineTargetId, instruction: refineInstruction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '生成に失敗しました')
      setRefineCurrent(data.current)
      setRefineDraft(data.draft)
    } catch {
      setRefineError('AIによる修正案の作成に失敗しました。もう一度お試しください')
    } finally {
      setRefining(false)
    }
  }

  async function handleApplyRefine() {
    if (!refineDraft || !refineTargetId) return
    setApplyingRefine(true)
    setRefineError('')

    try {
      const res = await fetch('/api/sns/apply-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: refineTargetId, fields: refineDraft }),
      })
      if (!res.ok) throw new Error()
      setRefineCurrent(null)
      setRefineDraft(null)
      setRefineInstruction('')
      await loadPosts()
    } catch {
      setRefineError('Notionへの反映に失敗しました')
    } finally {
      setApplyingRefine(false)
    }
  }

  function handleCancelRefine() {
    setRefineCurrent(null)
    setRefineDraft(null)
  }

  async function handleAnalyze(id: string) {
    setAnalyzingId(id)
    setAnalyzeError('')
    setAnalyzeResult(null)

    try {
      const res = await fetch('/api/sns/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '分析に失敗しました')
      setAnalyzeResult({ id, text: data.post.aiAnalysis })
      await loadPosts()
    } catch {
      setAnalyzeError('AIによる分析に失敗しました。もう一度お試しください')
    } finally {
      setAnalyzingId(null)
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">
          SNS投稿管理
        </h1>

        <form onSubmit={handleGenerate} className={`mb-6 flex flex-col gap-5 ${cardClass}`}>
          <h2 className="text-base font-semibold text-slate-900">AIに投稿案を提案してもらう</h2>

          <label className="flex flex-col gap-2">
            <span className={labelClass}>指示</span>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="例: 今週のTikTok投稿案を5個考えて"
              required
              rows={3}
              className={inputClass}
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-2">
              <span className={labelClass}>SNS</span>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SnsPlatform)}
                className={inputClass}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex w-24 flex-col gap-2">
              <span className={labelClass}>件数</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            生成された案はNotionに「AI提案」ステータスで保存されるだけで、自動的には採用されません
          </p>

          <button
            type="submit"
            disabled={generating}
            className="rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
          >
            {generating ? '生成中...' : 'AIに提案してもらう'}
          </button>

          {generateError && (
            <p className="text-center text-sm font-medium text-red-600">{generateError}</p>
          )}
        </form>

        <div className={`mb-6 ${cardClass}`}>
          <h2 className="mb-4 text-base font-semibold text-slate-900">AI提案(未採用)</h2>

          {loading ? (
            <p className="text-sm text-slate-400">読み込み中...</p>
          ) : proposals.length === 0 ? (
            <p className="text-sm text-slate-400">現在AI提案はありません</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {proposals.map((post) => {
                const expanded = expandedId === post.id
                return (
                  <li key={post.id} className="rounded-2xl border border-slate-100 p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : post.id)}
                      className="flex w-full flex-col items-start gap-1 text-left"
                    >
                      <span className="text-xs font-medium text-blue-600">{post.platform}</span>
                      <span className="text-sm font-semibold text-slate-900">{post.title}</span>
                      <span className="text-xs text-slate-400">{post.hook}</span>
                    </button>

                    {expanded && (
                      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                        <p>
                          <span className="font-medium text-slate-700">台本: </span>
                          {post.script}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">テロップ: </span>
                          {post.telop}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">撮影素材: </span>
                          {post.materials}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">CTA: </span>
                          {post.cta}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">理由: </span>
                          {post.reason}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-xl border border-slate-200 py-2 text-center text-xs font-medium text-slate-700"
                      >
                        Notionで開く
                      </a>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(post.id, 'ボツ')}
                        disabled={updatingId === post.id}
                        className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-500 disabled:opacity-50"
                      >
                        却下
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(post.id, '採用')}
                        disabled={updatingId === post.id}
                        className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-medium text-white disabled:opacity-50"
                      >
                        採用
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {listError && (
            <p className="mt-3 text-center text-sm font-medium text-red-600">{listError}</p>
          )}
        </div>

        <div className={`mb-6 ${cardClass}`}>
          <h2 className="mb-1 text-base font-semibold text-slate-900">投稿案をブラッシュアップ</h2>
          <p className="mb-4 text-xs text-slate-400">
            自分のアイデアでもAI提案でも、自然文で修正を依頼できます
          </p>

          {refineCandidates.length === 0 ? (
            <p className="text-sm text-slate-400">対象の投稿案がありません</p>
          ) : (
            <form onSubmit={handleRefine} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className={labelClass}>対象</span>
                <select
                  value={refineTargetId}
                  onChange={(e) => {
                    setRefineTargetId(e.target.value)
                    setRefineCurrent(null)
                    setRefineDraft(null)
                  }}
                  required
                  className={inputClass}
                >
                  <option value="">選択してください</option>
                  {refineCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.platform ?? '未設定'}] {p.title || '(無題)'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className={labelClass}>指示</span>
                <textarea
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  placeholder="例: 宣伝っぽくならないようにして"
                  required
                  rows={2}
                  className={inputClass}
                />
              </label>

              <button
                type="submit"
                disabled={refining || !refineTargetId}
                className="rounded-xl bg-blue-600 py-3 text-base font-medium text-white transition-colors disabled:opacity-50"
              >
                {refining ? '修正案を作成中...' : 'AIに修正してもらう'}
              </button>

              {refineError && (
                <p className="text-center text-sm font-medium text-red-600">{refineError}</p>
              )}
            </form>
          )}

          {refineCurrent && refineDraft && (
            <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-5">
              <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                内容を確認・編集してから「適用」を押してください。押すまではNotionは変更されません
              </p>

              {(
                [
                  ['title', 'タイトル'],
                  ['theme', 'テーマ/企画名'],
                  ['hook', '冒頭のフック'],
                  ['script', '台本'],
                  ['telop', 'テロップ案'],
                  ['materials', '撮影する素材'],
                  ['cta', 'CTA'],
                  ['reason', '投稿する理由'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-2">
                  <span className={labelClass}>{label}</span>
                  <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-400 line-through">
                    {refineCurrent[key]}
                  </p>
                  <textarea
                    value={refineDraft[key]}
                    onChange={(e) =>
                      setRefineDraft((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))
                    }
                    rows={key === 'script' ? 4 : 2}
                    className={inputClass}
                  />
                </label>
              ))}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelRefine}
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-base font-medium text-slate-700"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleApplyRefine}
                  disabled={applyingRefine}
                  className="flex-1 rounded-xl bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-50"
                >
                  {applyingRefine ? '適用中...' : '適用する'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={cardClass}>
          <h2 className="mb-1 text-base font-semibold text-slate-900">投稿後の分析</h2>
          <p className="mb-4 text-xs text-slate-400">
            再生数などの数字と、あなたの感想・気づきを合わせてAIが分析します
          </p>

          {postedCandidates.length === 0 ? (
            <p className="text-sm text-slate-400">
              「投稿済み」ステータスの投稿がありません(Notion側で数字を入力してください)
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {postedCandidates.map((post) => (
                <li key={post.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium text-blue-600">{post.platform}</span>
                      <p className="text-sm font-semibold text-slate-900">{post.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAnalyze(post.id)}
                      disabled={analyzingId === post.id}
                      className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {analyzingId === post.id ? '分析中...' : '分析する'}
                    </button>
                  </div>

                  {analyzeResult?.id === post.id && (
                    <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                      {analyzeResult.text}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {analyzeError && (
            <p className="mt-3 text-center text-sm font-medium text-red-600">{analyzeError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
