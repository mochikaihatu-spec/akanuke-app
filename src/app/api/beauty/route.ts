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

  const systemPrompt = `あなたは美容・垢抜けに関する相談に乗るアシスタントです。ユーザーが選んだカテゴリと気になる点をもとに、日本語でアドバイスしてください。

必ず守ること:
- 整形やコンプレックスを否定するような回答は避けてください
- バランスや顔立ち・体型に合った「似合わせ」の視点でアドバイスしてください
- 常に前向きなトーンで、具体的で実践しやすい提案を心がけてください`

  const userMessage = `相談カテゴリ: ${categories.join('、')}
${concern ? `気になる点: ${concern}` : '(気になる点の記入なし)'}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const answer = textBlock && 'text' in textBlock ? textBlock.text : ''

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('Anthropic API error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  }
}
