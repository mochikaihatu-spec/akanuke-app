import { NextResponse } from 'next/server'
import { listPosts, type PostStatus } from '@/lib/notion'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as PostStatus | null

  try {
    const posts = await listPosts(
      status ? { property: 'ステータス', status: { equals: status } } : undefined
    )
    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Notion list posts error:', error)
    return NextResponse.json({ error: 'Notionからの取得に失敗しました' }, { status: 500 })
  }
}
