import type { AiKind } from '@/lib/plans-config'

// 機能ごとのAIの設定。コストや品質に合わせて、機能ごとにモデルや処理方法を変えられる
//  - model: 使うモデル(例: 軽い機能は小さいモデルに替えると安くなる)
//  - maxTokens: 返答の長さの上限
//  - thinking: 'disabled' にすると「考える」文章を出さない(速く・安くなるが、複雑な推論は弱まる)
//  - lockSeconds: 同じ人の同じ機能が同時に走らないようにする鍵の有効秒数(AIの最大所要時間より長く)
export type AiFeatureConfig = {
  model: string
  maxTokens: number
  thinking: 'default' | 'disabled'
  lockSeconds: number
}

const DEFAULT_MODEL = 'claude-sonnet-5'

export const AI_FEATURES: Record<AiKind, AiFeatureConfig> = {
  plan: { model: DEFAULT_MODEL, maxTokens: 3000, thinking: 'disabled', lockSeconds: 120 },
  plan_adjust: { model: DEFAULT_MODEL, maxTokens: 1500, thinking: 'disabled', lockSeconds: 90 },
  beauty: { model: DEFAULT_MODEL, maxTokens: 1200, thinking: 'default', lockSeconds: 90 },
  chat: { model: DEFAULT_MODEL, maxTokens: 1200, thinking: 'default', lockSeconds: 90 },
  todos: { model: DEFAULT_MODEL, maxTokens: 400, thinking: 'default', lockSeconds: 60 },
  meal_photo: { model: DEFAULT_MODEL, maxTokens: 300, thinking: 'default', lockSeconds: 60 },
}

// anthropic.messages.create に渡す共通の設定
export function anthropicOptions(kind: AiKind) {
  const config = AI_FEATURES[kind]
  return {
    model: config.model,
    max_tokens: config.maxTokens,
    ...(config.thinking === 'disabled' ? { thinking: { type: 'disabled' as const } } : {}),
  }
}
