import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { anthropicOptions } from '@/lib/ai-config'
import {
  AI_INPUT_LIMITS,
  badRequest,
  beginAiRequest,
  finishAiRequest,
  readJsonBody,
  type AiOutcome,
} from '@/lib/ai-guard'
import { withSafetyRules } from '@/lib/ai-safety'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const body = await readJsonBody(request)
  const context = body?.context

  if (!context || typeof context !== 'object') {
    return badRequest('データが見つかりません')
  }
  if (JSON.stringify(context).length > AI_INPUT_LIMITS.contextJsonChars) {
    return badRequest('データが大きすぎます')
  }

  const access = await beginAiRequest('todos')
  if (!access.ok) return access.response

  const systemPrompt = withSafetyRules(`あなたは健康管理アプリのアシスタントです。ユーザーの今日のデータ(JSON)をもとに、今日の「ToDo」を考えてください。

必ず守ること:
- 情報を全部列挙するのではなく、今日この人が一番やった方がいいことを優先順位をつけて1〜3個だけ選んでください
- 各項目は短く(20〜30文字程度)、理由+具体的な行動が伝わる一文にしてください
  例: 「今日はタンパク質があと20g足りません。鶏肉や豆腐を一品足しましょう」
- 渡されたデータに含まれていないジャンル(例: workoutのデータが無いのに筋トレの提案をする)には触れないでください
- 特に問題がなければ、無理に3個埋めず1個や2個でも構いません

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{"items": ["短い行動提案1", "短い行動提案2"]}`)

  // 成功と確定するまでは失敗扱い(失敗なら回数に数えない)
  let outcome: AiOutcome = { success: false }

  try {
    const options = anthropicOptions('todos')
    const message = await anthropic.messages.create({
      ...options,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(context) }],
    })
    outcome = { success: false, model: options.model, usage: message.usage }

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AIの応答を解析できませんでした')
    }

    const parsed = JSON.parse(jsonMatch[0])
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((i: unknown) => typeof i === 'string').slice(0, 3)
      : []

    outcome = { ...outcome, success: true }
    return NextResponse.json({ items })
  } catch (error) {
    console.error('Todo generation error:', error)
    return NextResponse.json({ error: 'ToDoの生成に失敗しました' }, { status: 500 })
  } finally {
    await finishAiRequest(access.session, outcome)
  }
}
