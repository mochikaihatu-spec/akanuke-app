import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getPost } from '@/lib/notion'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type RefineDraft = {
  title: string
  theme: string
  hook: string
  script: string
  telop: string
  materials: string
  cta: string
  reason: string
}

function isValidDraft(value: unknown): value is RefineDraft {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.title === 'string' &&
    typeof v.theme === 'string' &&
    typeof v.hook === 'string' &&
    typeof v.script === 'string' &&
    typeof v.telop === 'string' &&
    typeof v.materials === 'string' &&
    typeof v.cta === 'string' &&
    typeof v.reason === 'string'
  )
}

export async function POST(request: Request) {
  const body = await request.json()
  const pageId = body?.pageId
  const instruction = body?.instruction

  if (!pageId || typeof pageId !== 'string') {
    return NextResponse.json({ error: '対象の投稿案を選択してください' }, { status: 400 })
  }
  if (!instruction || typeof instruction !== 'string') {
    return NextResponse.json({ error: '修正指示を入力してください' }, { status: 400 })
  }

  try {
    const current = await getPost(pageId)

    const systemPrompt = `あなたはSNS投稿案のブラッシュアップを手伝うアシスタントです。以下の現在の投稿案(${current.platform ?? ''})に対して、ユーザーの指示に沿って修正案を作成してください。

必ず守ること:
- ユーザーの指示を最優先で反映すること
- 指示にない項目は基本的に現状を維持しつつ、全体の一貫性のために自然な範囲で調整してよい
- 宣伝臭が強くならないようにし、視聴者目線を保つこと
- これはあくまで「提案」であり、ユーザーが確認してから適用するかどうかを決める

【現在の投稿案】
タイトル: ${current.title}
テーマ: ${current.theme}
冒頭のフック: ${current.hook}
台本: ${current.script}
テロップ案: ${current.telop}
撮影する素材: ${current.materials}
CTA: ${current.cta}
投稿する理由: ${current.reason}

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{
  "title": "修正後のタイトル",
  "theme": "修正後のテーマ/企画名",
  "hook": "修正後の冒頭のフック",
  "script": "修正後の台本",
  "telop": "修正後のテロップ案",
  "materials": "修正後の撮影する素材",
  "cta": "修正後のCTA",
  "reason": "修正後の投稿する理由"
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: instruction }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AIの応答を解析できませんでした')
    }

    const draft = JSON.parse(jsonMatch[0])
    if (!isValidDraft(draft)) {
      throw new Error('AIの応答を解析できませんでした')
    }

    // ここではNotionに書き込まない。ユーザーが確認して適用するまで下書きのまま返すだけ
    return NextResponse.json({ current, draft })
  } catch (error) {
    console.error('SNS refine error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  }
}
