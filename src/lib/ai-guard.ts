import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// 1人あたり・1日あたり(日本時間)のAI利用上限。機能ごとに数える
export const AI_DAILY_LIMITS = {
  chat: 20,
  beauty: 10,
  todos: 5,
  meal_photo: 10,
  plan: 3,
} as const

export type AiKind = keyof typeof AI_DAILY_LIMITS

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

// ログイン確認 + 今日の利用回数を1回消費する。
// 通れるなら null、止めるならそのまま返せるエラーレスポンスを返す
// (入力チェックを済ませてから呼ぶこと。不正な入力で回数を消費しないため)
export async function checkAiAccess(kind: AiKind): Promise<NextResponse | null> {
  const supabase = await createSupabaseServerClient()

  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: allowed, error } = await supabase.rpc('consume_ai_quota', {
    p_kind: kind,
    p_limit: AI_DAILY_LIMITS[kind],
  })

  // 確認できないときはAIを呼ばない(料金を守る側に倒す)
  if (error) {
    console.error('AI quota check failed:', error.message)
    return NextResponse.json(
      { error: '現在AIを利用できません。しばらくしてからお試しください' },
      { status: 503 }
    )
  }

  if (allowed !== true) {
    return NextResponse.json(
      { error: '今日のAI利用回数の上限に達しました。明日またお試しください' },
      { status: 429 }
    )
  }

  return null
}
