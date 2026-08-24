import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

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
  const body = await request.json()
  const question = body?.question
  const context = body?.context as ChatContext | undefined

  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: '質問を入力してください' }, { status: 400 })
  }
  if (!context) {
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 400 })
  }

  const systemPrompt = `あなたはダイエット・食事管理をサポートするアシスタントです。ユーザーの今日の食事記録と目標が以下の通り与えられます。この情報をもとに、質問に簡潔でわかりやすい日本語で答えてください。

${buildSummary(context)}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const answer = textBlock && 'text' in textBlock ? textBlock.text : ''

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('Anthropic API error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  }
}
