import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const body = await request.json()
  const categories = body?.categories
  const concern = body?.concern

  if (!Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json(
      { error: 'カテゴリを1つ以上選んでください' },
      { status: 400 }
    )
  }

  const systemPrompt = `あなたは美容・垢抜けに関する相談に乗るアシスタントです。ユーザーが選んだ気になる部分や、なりたい印象・気になる点をもとに、日本語で具体的な行動につながるアドバイスをしてください。

必ず守ること:
- 整形やコンプレックスを否定するような回答は避けてください
- バランスや顔立ち・体型に合った「似合わせ」の視点でアドバイスしてください
- 常に前向きなトーンで、具体的で実践しやすい提案を心がけてください

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{
  "title": "プラン全体の見出し(例: あなたの垢抜けプラン)",
  "items": [
    { "part": "対象(例: 眉、髪、肌など。選ばれたカテゴリの中から)", "advice": "具体的なアドバイスを1〜2文で" }
  ],
  "weeklyTasks": ["今週やることを体言止めで2〜4個"]
}
items は2〜4件にしてください。`

  const userMessage = `気になる部分: ${categories.join('、')}
${concern ? concern : '(詳細の記入なし)'}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const answer = jsonMatch ? jsonMatch[0] : rawText

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('Anthropic API error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  }
}
