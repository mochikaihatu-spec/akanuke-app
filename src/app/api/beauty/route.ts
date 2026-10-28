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
  const categories = body?.categories
  const concern = body?.concern

  if (!Array.isArray(categories) || categories.length === 0) {
    return badRequest('カテゴリを1つ以上選んでください')
  }
  if (
    categories.length > AI_INPUT_LIMITS.categories ||
    categories.some((c) => typeof c !== 'string' || c.length > AI_INPUT_LIMITS.categoryChars)
  ) {
    return badRequest('カテゴリの指定が正しくありません')
  }
  if (concern !== undefined && concern !== null && typeof concern !== 'string') {
    return badRequest('相談内容の形式が正しくありません')
  }
  if (typeof concern === 'string' && concern.length > AI_INPUT_LIMITS.concernChars) {
    return badRequest(`相談内容は${AI_INPUT_LIMITS.concernChars}文字以内で入力してください`)
  }

  const access = await beginAiRequest('beauty')
  if (!access.ok) return access.response

  const systemPrompt = withSafetyRules(`あなたは美容・垢抜けに関する相談に乗るアシスタントです。ユーザーが選んだ気になる部分や、なりたい印象・気になる点をもとに、日本語で具体的な行動につながるアドバイスをしてください。

必ず守ること:
- 整形やコンプレックスを否定するような回答は避けてください
- バランスや顔立ち・体型に合った「似合わせ」の視点でアドバイスしてください
- 常に前向きなトーンで、具体的で実践しやすい提案を心がけてください

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{
  "summary": "プラン全体の要約を1〜2行(40文字程度)で。例: 眉と髪型を整えると、顔全体が一気に垢抜けます",
  "title": "プラン全体の見出し(例: あなたの垢抜けプラン)",
  "items": [
    { "part": "対象(例: 眉、髪、肌など。選ばれたカテゴリの中から)", "advice": "具体的なアドバイスを1〜2文で" }
  ],
  "weeklyTasks": ["今週やることを体言止めで2〜4個"]
}
items は2〜4件にしてください。`)

  const userMessage = `気になる部分: ${categories.join('、')}
${concern ? concern : '(詳細の記入なし)'}`

  // 成功と確定するまでは失敗扱い(失敗なら回数に数えない)
  let outcome: AiOutcome = { success: false }

  try {
    const options = anthropicOptions('beauty')
    const message = await anthropic.messages.create({
      ...options,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    outcome = { success: false, model: options.model, usage: message.usage }

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    // 空、または途中で切れた回答は失敗として扱う
    if (rawText.trim() === '' || message.stop_reason === 'max_tokens') {
      console.error('Beauty: unusable AI reply | stop_reason:', message.stop_reason)
      return NextResponse.json(
        { error: '回答の作成に失敗しました。もう一度お試しください(今回は回数に数えません)' },
        { status: 502 }
      )
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const answer = jsonMatch ? jsonMatch[0] : rawText

    outcome = { ...outcome, success: true }
    return NextResponse.json({ answer })
  } catch (error) {
    console.error('Anthropic API error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  } finally {
    await finishAiRequest(access.session, outcome)
  }
}
