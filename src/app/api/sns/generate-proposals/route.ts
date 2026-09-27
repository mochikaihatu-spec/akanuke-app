import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createPost, type SnsPlatform } from '@/lib/notion'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PLATFORMS: SnsPlatform[] = ['TikTok', 'X', 'Instagram', 'note']

type ProposalDraft = {
  title: string
  theme: string
  hook: string
  script: string
  telop: string
  materials: string
  cta: string
  reason: string
}

function isValidDraft(value: unknown): value is ProposalDraft {
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
  const instruction = body?.instruction
  const platform = body?.platform
  const count = body?.count

  if (!instruction || typeof instruction !== 'string') {
    return NextResponse.json({ error: '指示内容を入力してください' }, { status: 400 })
  }
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'SNSを選択してください' }, { status: 400 })
  }
  const n = Number(count)
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    return NextResponse.json({ error: '件数は1〜10で指定してください' }, { status: 400 })
  }

  const systemPrompt = `あなたはSNS(${platform})の投稿企画をサポートするアシスタントです。ユーザーの指示に沿って投稿案を${n}件考えてください。

必ず守ること:
- 宣伝臭が強すぎる内容は避け、視聴者にとって価値のある切り口にすること
- ${platform}の特性(尺・トーン・フォーマット)に合わせること
- 台本は実際に読み上げられる自然な口語体で書くこと
- ここで作るのはあくまで「案」であり、採用するかどうかはユーザーが判断する

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{
  "proposals": [
    {
      "title": "投稿タイトル",
      "theme": "テーマ/企画名(短く)",
      "hook": "冒頭2秒のフック",
      "script": "読み上げ原稿(台本)",
      "telop": "テロップ案(改行区切りで複数可)",
      "materials": "必要な撮影素材のリスト",
      "cta": "締めのCTA",
      "reason": "なぜこの投稿をするとよいかの理由"
    }
  ]
}
proposals は${n}件にしてください。`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: instruction }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AIの応答を解析できませんでした')
    }

    const parsed = JSON.parse(jsonMatch[0])
    const drafts: unknown[] = Array.isArray(parsed?.proposals) ? parsed.proposals : []
    const validDrafts = drafts.filter(isValidDraft)

    if (validDrafts.length === 0) {
      throw new Error('AIの応答を解析できませんでした')
    }

    // AIの提案は必ず新規ページとして保存する(既存ページには一切触れない)
    const created = await Promise.all(
      validDrafts.map((draft) =>
        createPost({
          title: draft.title,
          theme: draft.theme,
          originator: 'AI提案',
          platform,
          status: 'AI提案',
          hook: draft.hook,
          script: draft.script,
          telop: draft.telop,
          materials: draft.materials,
          cta: draft.cta,
          reason: draft.reason,
        })
      )
    )

    return NextResponse.json({ posts: created })
  } catch (error) {
    console.error('SNS proposal generation error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  }
}
