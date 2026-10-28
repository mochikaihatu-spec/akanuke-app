import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { anthropicOptions } from '@/lib/ai-config'
import { badRequest, beginAiRequest, finishAiRequest, type AiOutcome } from '@/lib/ai-guard'
import { withSafetyRules } from '@/lib/ai-safety'
import { buildPlanUserMessage, parsePlanReply, PLAN_SYSTEM_PROMPT } from '@/lib/plan-prompt'
import { validateIdealInput } from '@/lib/plan-schema'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ヒアリングの答え(DBに保存済みのもの)から、あなた専用のプランを作って保存する
export async function POST() {
  const supabase = await createSupabaseServerClient()

  // 入力はクライアントから受け取らず、DBに保存された本人の答えを使う
  const { data: row, error: readError } = await supabase
    .from('ideal_profiles')
    .select('*')
    .maybeSingle()

  if (readError) {
    console.error('Plan: failed to read ideal_profiles:', readError.message)
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
  }
  if (!row) {
    return badRequest('先に「憧れ」についての質問に答えてください')
  }

  const ideal = validateIdealInput(row)
  if (!ideal.ok) return badRequest(ideal.error)

  const access = await beginAiRequest('plan')
  if (!access.ok) return access.response

  // 成功したと確定するまでは失敗扱い(失敗なら回数に数えない)
  let outcome: AiOutcome = { success: false }

  try {
    const options = anthropicOptions('plan')
    const message = await anthropic.messages.create({
      ...options,
      system: withSafetyRules(PLAN_SYSTEM_PROMPT),
      messages: [{ role: 'user', content: buildPlanUserMessage(ideal.value) }],
    })
    outcome = { success: false, model: options.model, usage: message.usage }

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const plan = parsePlanReply(rawText)
    if (!plan.ok) {
      console.error('Plan: invalid AI reply:', plan.error, '| stop_reason:', message.stop_reason)
      return NextResponse.json(
        { error: 'プランの作成に失敗しました。もう一度お試しください(今回は回数に数えません)' },
        { status: 502 }
      )
    }

    const { data: planId, error: saveError } = await supabase.rpc('save_new_plan', {
      p_ideal_snapshot: ideal.value,
      p_content: plan.value,
    })

    if (saveError) {
      console.error('Plan: failed to save:', saveError.message)
      return NextResponse.json({ error: 'プランの保存に失敗しました' }, { status: 500 })
    }

    outcome = { ...outcome, success: true }
    return NextResponse.json({ id: planId })
  } catch (error) {
    console.error('Plan generation error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  } finally {
    await finishAiRequest(access.session, outcome)
  }
}
