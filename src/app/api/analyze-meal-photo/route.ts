import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { anthropicOptions } from '@/lib/ai-config'
import {
  ALLOWED_IMAGE_TYPES,
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
  const image = body?.image
  const mediaType = body?.mediaType

  if (!image || typeof image !== 'string' || typeof mediaType !== 'string') {
    return badRequest('画像が見つかりません')
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(mediaType)) {
    return badRequest('対応していない画像形式です(JPEG・PNG・GIF・WebPのみ)')
  }
  if (image.length > AI_INPUT_LIMITS.imageBase64Chars) {
    return badRequest('画像が大きすぎます')
  }

  const access = await beginAiRequest('meal_photo')
  if (!access.ok) return access.response

  const systemPrompt = withSafetyRules(`あなたは食事の写真から料理を分析する栄養士アシスタントです。与えられた画像を見て、料理名・推定カロリー(kcal)・推定タンパク質量(g)を判定してください。

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{"name": "料理名", "calories": 数値, "protein_g": 数値}`)

  // 成功と確定するまでは失敗扱い(失敗なら回数に数えない)
  let outcome: AiOutcome = { success: false }

  try {
    const options = anthropicOptions('meal_photo')
    const message = await anthropic.messages.create({
      ...options,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as (typeof ALLOWED_IMAGE_TYPES)[number],
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
    outcome = { success: false, model: options.model, usage: message.usage }

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AIの応答を解析できませんでした')
    }

    const parsed = JSON.parse(jsonMatch[0])

    outcome = { ...outcome, success: true }
    return NextResponse.json({
      name: typeof parsed.name === 'string' ? parsed.name : '',
      calories: typeof parsed.calories === 'number' ? parsed.calories : null,
      protein_g: typeof parsed.protein_g === 'number' ? parsed.protein_g : null,
    })
  } catch (error) {
    console.error('Meal photo analysis error:', error)
    return NextResponse.json({ error: '写真の解析に失敗しました' }, { status: 500 })
  } finally {
    await finishAiRequest(access.session, outcome)
  }
}
