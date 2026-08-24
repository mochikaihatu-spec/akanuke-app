import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const body = await request.json()
  const image = body?.image
  const mediaType = body?.mediaType

  if (!image || typeof image !== 'string' || !mediaType) {
    return NextResponse.json({ error: '画像が見つかりません' }, { status: 400 })
  }

  const systemPrompt = `あなたは食事の写真から料理を分析する栄養士アシスタントです。与えられた画像を見て、料理名・推定カロリー(kcal)・推定タンパク質量(g)を判定してください。

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{"name": "料理名", "calories": 数値, "protein_g": 数値}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: 'text',
              text: 'この料理を分析してください。',
            },
          ],
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AIの応答を解析できませんでした')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      name: typeof parsed.name === 'string' ? parsed.name : '',
      calories: typeof parsed.calories === 'number' ? parsed.calories : null,
      protein_g: typeof parsed.protein_g === 'number' ? parsed.protein_g : null,
    })
  } catch (error) {
    console.error('Meal photo analysis error:', error)
    return NextResponse.json({ error: '写真の解析に失敗しました' }, { status: 500 })
  }
}
