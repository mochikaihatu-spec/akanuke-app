import { NextResponse } from 'next/server'
import { updatePost, type PostStatus } from '@/lib/notion'

const VALID_STATUSES: PostStatus[] = [
  'アイデア',
  'AI提案',
  '採用',
  '撮影待ち',
  '編集待ち',
  '投稿待ち',
  '投稿済み',
  '分析済み',
  'ボツ',
]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const status = body?.status

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: '不正なステータスです' }, { status: 400 })
  }

  try {
    const post = await updatePost(id, { status })
    return NextResponse.json({ post })
  } catch (error) {
    console.error('Notion status update error:', error)
    return NextResponse.json({ error: 'ステータスの更新に失敗しました' }, { status: 500 })
  }
}
