import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getPost, listPosts, updatePost, type SnsPost } from '@/lib/notion'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function summarizePost(p: SnsPost) {
  return `- 「${p.title}」(${p.platform ?? '?'} / ${p.status ?? '?'})
  再生数:${p.views ?? '-'} いいね:${p.likes ?? '-'} コメント:${p.comments ?? '-'} 保存:${p.saves ?? '-'} フォロー増加:${p.followerGrowth ?? '-'} 自己評価:${p.selfRating ?? '-'}
  感想・気づき: ${p.reflection || '(記入なし)'}
  改善点: ${p.improvements || '(記入なし)'}`
}

export async function POST(request: Request) {
  const body = await request.json()
  const pageId = body?.pageId

  if (!pageId || typeof pageId !== 'string') {
    return NextResponse.json({ error: '分析対象の投稿を選択してください' }, { status: 400 })
  }

  try {
    const target = await getPost(pageId)

    if (target.status !== '投稿済み' && target.status !== '分析済み') {
      return NextResponse.json(
        { error: '投稿済みのデータのみ分析できます' },
        { status: 400 }
      )
    }

    // 比較材料として、投稿済み/分析済みの他の投稿を新しい順に数件取得する
    const others = (
      await listPosts({
        or: [
          { property: 'ステータス', status: { equals: '投稿済み' } },
          { property: 'ステータス', status: { equals: '分析済み' } },
        ],
      })
    )
      .filter((p) => p.id !== target.id)
      .slice(0, 5)

    const systemPrompt = `あなたはSNS投稿の振り返り分析を手伝うアシスタントです。数字だけでなく、ユーザー自身が書いた「感想・気づき」「改善点」も重要な判断材料として扱ってください。

【今回分析する投稿】
${summarizePost(target)}

【過去の投稿(比較用、新しい順)】
${others.length > 0 ? others.map(summarizePost).join('\n') : '(比較できる過去データなし)'}

必ず守ること:
- 数字の比較だけでなく、感想・気づきの内容も踏まえること
- 次回の投稿に活かせる具体的な改善提案を含めること
- 決めつけすぎず、傾向として述べること
- 日本語で300〜500文字程度にまとめること

必ず次のJSON形式のみで回答してください。説明文や前置きは一切書かないでください。
{"analysis": "分析結果の文章"}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'この投稿を分析してください。' }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AIの応答を解析できませんでした')
    }

    const parsed = JSON.parse(jsonMatch[0])
    const analysis = typeof parsed.analysis === 'string' ? parsed.analysis : ''
    if (!analysis) {
      throw new Error('AIの応答を解析できませんでした')
    }

    // AI分析メモにのみ書き込む(感想・改善点などユーザー自身の記入欄には触れない)
    const post = await updatePost(pageId, {
      aiAnalysis: analysis,
      status: target.status === '投稿済み' ? '分析済み' : target.status,
    })

    return NextResponse.json({ post })
  } catch (error) {
    console.error('SNS analyze error:', error)
    return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 })
  }
}
