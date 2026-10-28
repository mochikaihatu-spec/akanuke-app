import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AI_FEATURES } from '@/lib/ai-config'
import {
  AI_QUOTAS,
  limitMessage,
  tierFromSubscription,
  type AiKind,
  type Tier,
} from '@/lib/plans-config'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// 入力サイズの上限(料金の水増し・プロンプト注入の足がかり対策)
export const AI_INPUT_LIMITS = {
  questionChars: 500,
  concernChars: 1000,
  categories: 10,
  categoryChars: 30,
  contextJsonChars: 8000,
  imageBase64Chars: 7_000_000,
} as const

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

// リクエスト本文をJSONとして読む。壊れていたらnull
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

// 本人の契約状態(無料/有料)をDBから読む。読めない・行がない場合は無料として扱う(安全側)
export async function getTier(supabase: SupabaseClient): Promise<Tier> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .maybeSingle()

  if (error) {
    console.error('Failed to read subscription:', error.message)
    return 'free'
  }
  return tierFromSubscription(data)
}

export type AiSession = {
  supabase: SupabaseClient
  kind: AiKind
  period: 'month' | 'day'
  token: string
}

export type AiOutcome = {
  success: boolean
  model?: string
  usage?: { input_tokens?: number | null; output_tokens?: number | null }
}

// AIを呼ぶ「前」に使う。ログイン確認 → 契約状態の判定 → 同時実行の鍵を取る → 今期の回数を確認。
// 通れるなら session を返し、止めるならそのまま返せるエラーレスポンスを返す。
// この時点では回数を減らさない。必ず最後に finishAiRequest を呼ぶこと(try/finally)
// (入力チェックを済ませてから呼ぶこと。不正な入力で鍵を取らないため)
export async function beginAiRequest(
  kind: AiKind
): Promise<{ ok: true; session: AiSession } | { ok: false; response: NextResponse }> {
  const supabase = await createSupabaseServerClient()

  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) {
    return { ok: false, response: NextResponse.json({ error: 'ログインが必要です' }, { status: 401 }) }
  }

  const tier = await getTier(supabase)
  const quota = AI_QUOTAS[tier][kind]

  const { data: result, error } = await supabase.rpc('begin_ai_request', {
    p_kind: kind,
    p_limit: quota.limit,
    p_period: quota.period,
    p_lock_seconds: AI_FEATURES[kind].lockSeconds,
  })

  // 確認できないときはAIを呼ばない(料金を守る側に倒す)
  if (error || !result) {
    console.error('AI quota check failed:', error?.message)
    return {
      ok: false,
      response: NextResponse.json(
        { error: '現在AIを利用できません。しばらくしてからお試しください' },
        { status: 503 }
      ),
    }
  }

  if (result.status === 'ok') {
    return { ok: true, session: { supabase, kind, period: quota.period, token: result.token } }
  }

  if (result.status === 'limit') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: limitMessage(kind, tier),
          code: 'limit',
          kind,
          tier,
          used: result.used,
          limit: result.limit,
          period: quota.period,
          nextReset: result.next_reset,
        },
        { status: 429 }
      ),
    }
  }

  if (result.status === 'busy') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: '前の処理が終わるまで、少し待ってからもう一度お試しください', code: 'busy' },
        { status: 429 }
      ),
    }
  }

  console.error('AI quota check returned an unexpected status:', result.status)
  return {
    ok: false,
    response: NextResponse.json(
      { error: '現在AIを利用できません。しばらくしてからお試しください' },
      { status: 503 }
    ),
  }
}

// AIを呼んだ「後」に必ず呼ぶ。成功したときだけ回数が1つ増える。失敗なら増えない。
// 使ったトークン数は成功・失敗どちらも記録する。ここで失敗しても、ユーザーへの応答は変えない
export async function finishAiRequest(session: AiSession, outcome: AiOutcome) {
  const { error } = await session.supabase.rpc('finish_ai_request', {
    p_kind: session.kind,
    p_token: session.token,
    p_period: session.period,
    p_success: outcome.success,
    p_model: outcome.model ?? null,
    p_input_tokens: outcome.usage?.input_tokens ?? null,
    p_output_tokens: outcome.usage?.output_tokens ?? null,
  })

  if (error) {
    console.error('Failed to record AI usage:', error.message)
  }
}
