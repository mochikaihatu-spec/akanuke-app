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

type MealAnswer = { name: string; calories: number | null; protein_g: number | null }

// AIの答えから「料理名・カロリー・タンパク質」を取り出す。
// 正しい JSON ならそのまま使う。「500〜600」「約550」のように数字が崩れていて JSON として読めないときは、
// 項目ごとに最初の数字を拾う。何も拾えなければ null(=失敗。回数には数えない)
function parseMealAnswer(rawText: string): MealAnswer | null {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      calories: typeof parsed.calories === 'number' ? parsed.calories : null,
      protein_g: typeof parsed.protein_g === 'number' ? parsed.protein_g : null,
    }
  } catch {
    const name = jsonMatch[0].match(/"name"\s*:\s*"([^"]*)"/)?.[1] ?? ''
    const firstNumber = (key: string) => {
      const m = jsonMatch[0].match(new RegExp(`"${key}"\\s*:\\s*[^0-9\\-,}]*(\\d+(?:\\.\\d+)?)`))
      return m ? Number(m[1]) : null
    }
    const calories = firstNumber('calories')
    const protein_g = firstNumber('protein_g')
    if (!name && calories === null && protein_g === null) return null
    return { name, calories, protein_g }
  }
}

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
{"name": "料理名", "calories": 数値, "protein_g": 数値}
calories と protein_g は、範囲(500〜600)や「約」を使わず、必ず1つの数字だけで書いてください。`)

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

    const parsed = parseMealAnswer(rawText)
    if (!parsed) {
      // 原因調べ用: 読めなかった答えの先頭だけ残す(料理名と数字程度)
      console.error('Meal photo answer unreadable:', message.stop_reason, rawText.slice(0, 200))
      throw new Error('AIの応答を解析できませんでした')
    }

    outcome = { ...outcome, success: true }
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Meal photo analysis error:', error)
    return NextResponse.json({ error: '写真の解析に失敗しました' }, { status: 500 })
  } finally {
    await finishAiRequest(access.session, outcome)
  }
}
