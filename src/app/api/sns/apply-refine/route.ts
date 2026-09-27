import { NextResponse } from 'next/server'
import { updatePost } from '@/lib/notion'

export async function POST(request: Request) {
  const body = await request.json()
  const pageId = body?.pageId
  const fields = body?.fields

  if (!pageId || typeof pageId !== 'string') {
    return NextResponse.json({ error: '対象の投稿案を選択してください' }, { status: 400 })
  }
  if (!fields || typeof fields !== 'object') {
    return NextResponse.json({ error: '適用する内容がありません' }, { status: 400 })
  }

  // ユーザーが「適用」を押した項目だけを反映する。ホワイトリスト外のプロパティは無視する
  const allowedKeys = ['title', 'theme', 'hook', 'script', 'telop', 'materials', 'cta', 'reason'] as const
  const update: Record<string, string> = {}
  for (const key of allowedKeys) {
    if (typeof fields[key] === 'string') update[key] = fields[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '適用する内容がありません' }, { status: 400 })
  }

  try {
    // AIの手を借りて修正した内容なので、発案者を「融合」に記録する
    const post = await updatePost(pageId, { ...update, originator: '融合' })
    return NextResponse.json({ post })
  } catch (error) {
    console.error('SNS apply-refine error:', error)
    return NextResponse.json({ error: 'Notionへの反映に失敗しました' }, { status: 500 })
  }
}
