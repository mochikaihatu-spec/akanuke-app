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

type MealItem = {
  description: string
  calories: number | null
  protein_g: number | null
}

type ChatContext = {
  meals: MealItem[]
  totalCalories: number
  totalProtein: number
  targetCalories: number | null
  targetProteinG: number | null
}

function buildSummary(context: ChatContext) {
  const mealLines =
    context.meals.length === 0
      ? '(まだ記録なし)'
      : context.meals
          .map(
            (m) =>
              `- ${m.description}(${m.calories ?? '?'} kcal, タンパク質 ${m.protein_g ?? '?'} g)`
          )
          .join('\n')

  return `【今日の食事記録】
${mealLines}

【今日の合計】
カロリー: ${context.totalCalories} kcal
タンパク質: ${context.totalProtein.toFixed(1)} g

【1日の目標】
目標カロリー: ${context.targetCalories !== null ? `${context.targetCalories} kcal` : '未設定'}
目標タンパク質: ${context.targetProteinG !== null ? `${context.targetProteinG} g` : '未設定'}`
}

// JSONの文字列部分(途中で切れていてもよい)を読み取る
function readJsonString(raw: string) {
  try {
    return JSON.parse(`"${raw.replace(/\\$/, '')}"`) as string
  } catch {
    return raw
  }
}

// AIの返事から summary / detail を取り出す。JSONとして読めなければ、読める部分だけ使う
function extractReply(rawText: string) {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (typeof parsed.summary === 'string') {
        return {
          summary: parsed.summary,
          detail: typeof parsed.detail === 'string' ? parsed.detail : '',
        }
      }
    } catch {
      // 下の取り出し方に進む
    }
  }

  const summary = rawText.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)/)
  const detail = rawText.match(/"detail"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (summary) {
    return {
      summary: readJsonString(summary[1]),
      detail: detail ? readJsonString(detail[1]) : '',
    }
  }

  const text = rawText.trim()
  if (!text) throw new Error('AIの応答が空でした')
  return { summary: text.slice(0, 60), detail: text }
}

export async function POST(request: Request) {
  const body = await readJsonBody(request)
  const question = body?.question
  const context = body?.context as ChatContext | undefined

  if (!question || typeof question !== 'string') {
    return badRequest('質問を入力してください')
  }
  if (question.length > AI_INPUT_LIMITS.questionChars) {
    return badRequest(`質問は${AI_INPUT_LIMITS.questionChars}文字以内で入力してください`)
  }
  if (
    !context ||
    typeof context !== 'object' ||
    !Array.isArray(context.meals) ||
    typeof context.totalCalories !== 'number' ||
    typeof context.totalProtein !== 'number' ||
    JSON.stringify(context).length > AI_INPUT_LIMITS.contextJsonChars
  ) {
    return badRequest('データの取得に失敗しました')
  }

  const access = await beginAiRequest('chat')
  if (!access.ok) return access.response

  const systemPrompt = withSafetyRules(`あなたはダイエット・食事管理をサポートするアシスタントです。ユーザーの今日の食事記録と目標が以下の通り与えられます。この情報をもとに、質問にわかりやすい日本語で答えてください。

${buildSummary(context)}

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{
  "summary": "回答の要約を1〜2行(40文字程度)で。例: タンパク質があと20g足りません。鶏肉や豆腐を一品足しましょう",
  "detail": "詳しいアドバイス。長くなりすぎないよう400文字程度まで"
}`)

  // 成功と確定するまでは失敗扱い(失敗なら回数に数えない)
  let outcome: AiOutcome = { success: false }

  try {
    const options = anthropicOptions('chat')
    const message = await anthropic.messages.create({
      ...options,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    })
    outcome = { success: false, model: options.model, usage: message.usage }

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const { summary, detail } = extractReply(rawText)

    outcome = { ...outcome, success: true }
    return NextResponse.json({ summary, detail })
  } catch (error) {
    console.error('Anthropic API error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  } finally {
    await finishAiRequest(access.session, outcome)
  }
}
