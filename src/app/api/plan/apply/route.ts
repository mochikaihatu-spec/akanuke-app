import { NextResponse } from 'next/server'
import { badRequest, readJsonBody } from '@/lib/ai-guard'
import { applyPatch, validatePatch } from '@/lib/plan-patch'
import { validatePlan } from '@/lib/plan-schema'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ユーザーが「この内容で変更する」を押した調整案を、新しいプランとして保存する。AIは使わない。
// 保存済みの調整案(patch)を、いまの使用中プランにもう一度適用して検査してから保存する
export async function POST(request: Request) {
  const body = await readJsonBody(request)
  const proposalId = body?.proposalId

  if (typeof proposalId !== 'number' || !Number.isInteger(proposalId)) {
    return badRequest('調整案が指定されていません')
  }

  const supabase = await createSupabaseServerClient()

  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { data: proposal, error: proposalError } = await supabase
    .from('plan_proposals')
    .select('id, plan_id, ai_message, patch, status')
    .eq('id', proposalId)
    .maybeSingle()

  if (proposalError) {
    console.error('Apply: failed to read proposal:', proposalError.message)
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
  }
  if (!proposal) return NextResponse.json({ error: '調整案が見つかりません' }, { status: 404 })
  if (proposal.status !== 'pending') {
    return NextResponse.json({ error: 'この調整案は、すでに適用済みか、取りやめになっています' }, { status: 409 })
  }

  const { data: active, error: planError } = await supabase
    .from('plans')
    .select('id, content')
    .eq('status', 'active')
    .maybeSingle()

  if (planError) {
    console.error('Apply: failed to read plan:', planError.message)
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
  }
  if (!active || active.id !== proposal.plan_id) {
    return NextResponse.json(
      { error: 'プランが変わったため、この調整案は使えません。もう一度相談してください' },
      { status: 409 }
    )
  }

  const current = validatePlan(active.content)
  const patch = validatePatch(proposal.patch)
  if (!current.ok || !patch.ok) {
    console.error('Apply: invalid stored data:', current.ok ? '' : current.error, patch.ok ? '' : patch.error)
    return NextResponse.json({ error: '調整案を適用できませんでした。もう一度相談してください' }, { status: 422 })
  }

  const applied = applyPatch(current.value, patch.value)
  const next = applied.ok ? validatePlan(applied.value) : applied
  if (!next.ok) {
    console.error('Apply: patch could not be applied:', next.error)
    return NextResponse.json({ error: '調整案を適用できませんでした。もう一度相談してください' }, { status: 422 })
  }

  const { data: newId, error: saveError } = await supabase.rpc('save_adjusted_plan', {
    p_proposal_id: proposal.id,
    p_content: next.value,
    p_note: proposal.ai_message,
  })

  if (saveError) {
    if (saveError.message.includes('proposal_not_pending') || saveError.message.includes('plan_not_active')) {
      return NextResponse.json(
        { error: 'プランが変わったか、すでに適用済みのため、この調整案は使えません' },
        { status: 409 }
      )
    }
    console.error('Apply: failed to save:', saveError.message)
    return NextResponse.json({ error: 'プランの保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ id: newId })
}
