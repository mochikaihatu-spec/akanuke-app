import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { AI_INPUT_LIMITS, badRequest, checkAiAccess, readJsonBody } from '@/lib/ai-guard'
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

  const blocked = await checkAiAccess('chat')
  if (blocked) return blocked

  const systemPrompt = withSafetyRules(`あなたはダイエット・食事管理をサポートするアシスタントです。ユーザーの今日の食事記録と目標が以下の通り与えられます。この情報をもとに、質問にわかりやすい日本語で答えてください。

${buildSummary(context)}

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{
  "summary": "回答の要約を1〜2行(40文字程度)で。例: タンパク質があと20g足りません。鶏肉や豆腐を一品足しましょう",
  "detail": "これまで通りの詳しいアドバイス全文"
}`)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AIの応答を解析できませんでした')
    }

    const parsed = JSON.parse(jsonMatch[0])
    const summary = typeof parsed.summary === 'string' ? parsed.summary : rawText
    const detail = typeof parsed.detail === 'string' ? parsed.detail : ''

    return NextResponse.json({ summary, detail })
  } catch (error) {
    console.error('Anthropic API error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  }
}
