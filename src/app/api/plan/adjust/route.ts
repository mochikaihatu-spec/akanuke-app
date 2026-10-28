import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { anthropicOptions } from '@/lib/ai-config'
import {
  badRequest,
  beginAiRequest,
  finishAiRequest,
  readJsonBody,
  type AiOutcome,
} from '@/lib/ai-guard'
import { withSafetyRules } from '@/lib/ai-safety'
import { addDays, jstDateString } from '@/lib/mission'
import { ADJUST_SYSTEM_PROMPT, buildAdjustUserMessage, summarizeMissions } from '@/lib/plan-adjust-prompt'
import { applyPatch, diffPlans, parsePatchReply } from '@/lib/plan-patch'
import { planWarnings, validateIdealInput, validatePlan } from '@/lib/plan-schema'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const REQUEST_MAX_CHARS = 500
const FAILED = 'プランの調整案の作成に失敗しました。もう一度お試しください(今回は回数に数えません)'

// 相談文から、プランの「調整案」を作る。ここではプランを変えない(承認は /api/plan/apply)
export async function POST(request: Request) {
  const body = await readJsonBody(request)
  const text = typeof body?.request === 'string' ? body.request.trim() : ''

  if (text === '') return badRequest('相談したいことを入力してください')
  if (text.length > REQUEST_MAX_CHARS) {
    return badRequest(`相談は${REQUEST_MAX_CHARS}文字以内で入力してください`)
  }

  const supabase = await createSupabaseServerClient()

  const { data: row, error: planError } = await supabase
    .from('plans')
    .select('id, content, ideal_snapshot')
    .eq('status', 'active')
    .maybeSingle()

  if (planError) {
    console.error('Adjust: failed to read plan:', planError.message)
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
  }
  if (!row) return badRequest('先にプランを作ってください')

  const current = validatePlan(row.content)
  if (!current.ok) {
    console.error('Adjust: stored plan is invalid:', current.error)
    return NextResponse.json({ error: 'プランの形式が正しくありません。作り直してください' }, { status: 409 })
  }
  const idealResult = validateIdealInput(row.ideal_snapshot)
  const ideal = idealResult.ok ? idealResult.value : {}

  // 直近14日のミッションの状況(AIに渡す量を小さくするため、集計して渡す)
  const since = addDays(jstDateString(new Date()), -14)
  const { data: logs } = await supabase
    .from('mission_logs')
    .select('status, area')
    .gte('mission_date', since)

  const access = await beginAiRequest('plan_adjust')
  if (!access.ok) return access.response

  // 成功と確定するまでは失敗扱い(失敗なら回数に数えない)
  let outcome: AiOutcome = { success: false }

  try {
    const options = anthropicOptions('plan_adjust')
    const message = await anthropic.messages.create({
      ...options,
      system: withSafetyRules(ADJUST_SYSTEM_PROMPT),
      messages: [
        {
          role: 'user',
          content: buildAdjustUserMessage({
            plan: current.value,
            ideal,
            missionSummary: summarizeMissions(logs ?? []),
            request: text,
          }),
        },
      ],
    })
    outcome = { success: false, model: options.model, usage: message.usage }

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const patch = parsePatchReply(rawText)
    if (!patch.ok) {
      console.error('Adjust: invalid AI reply:', patch.error, '| stop_reason:', message.stop_reason)
      return NextResponse.json({ error: FAILED }, { status: 502 })
    }

    // 変更なし(調整が不要・専門家への相談を促す、など):ひと言だけ返す。調整案は保存しない
    if (patch.value.changes.length === 0) {
      outcome = { ...outcome, success: true }
      return NextResponse.json({ proposalId: null, message: patch.value.message, diff: [], warnings: [] })
    }

    // 複製したプランに適用して検査する。ここで壊れる案は、ユーザーに見せない
    const applied = applyPatch(current.value, patch.value)
    const next = applied.ok ? validatePlan(applied.value) : applied
    if (!next.ok) {
      console.error('Adjust: patch could not be applied:', next.error)
      return NextResponse.json({ error: FAILED }, { status: 502 })
    }

    const diff = diffPlans(current.value, next.value)
    if (diff.length === 0) {
      outcome = { ...outcome, success: true }
      return NextResponse.json({ proposalId: null, message: patch.value.message, diff: [], warnings: [] })
    }

    // 前の「承認待ち」は取り下げて、新しい案だけを残す
    await supabase
      .from('plan_proposals')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
      .eq('plan_id', row.id)
      .eq('status', 'pending')

    const { data: saved, error: saveError } = await supabase
      .from('plan_proposals')
      .insert({
        plan_id: row.id,
        request_text: text,
        ai_message: patch.value.message,
        patch: patch.value,
        diff,
      })
      .select('id')
      .single()

    if (saveError || !saved) {
      console.error('Adjust: failed to save proposal:', saveError?.message)
      return NextResponse.json({ error: '調整案の保存に失敗しました' }, { status: 500 })
    }

    outcome = { ...outcome, success: true }
    return NextResponse.json({
      proposalId: saved.id,
      message: patch.value.message,
      diff,
      warnings: planWarnings(next.value, ideal),
    })
  } catch (error) {
    console.error('Adjust error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  } finally {
    await finishAiRequest(access.session, outcome)
  }
}
