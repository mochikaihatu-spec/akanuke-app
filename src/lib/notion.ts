import { Client } from '@notionhq/client'
import type {
  PageObjectResponse,
  QueryDataSourceParameters,
  UpdatePageParameters,
} from '@notionhq/client/build/src/api-endpoints'

const notion = new Client({ auth: process.env.NOTION_API_KEY })
const databaseId = process.env.NOTION_SNS_DATABASE_ID!

// 2025-09-03以降のNotion APIはデータベース配下の「データソース」に対してクエリする。
// 通常のデータベース(データソース1つ)ではdatabase_idとは別のIDになるため、初回に解決してキャッシュする。
let cachedDataSourceId: string | null = null
async function getDataSourceId(): Promise<string> {
  if (cachedDataSourceId) return cachedDataSourceId
  const database = await notion.databases.retrieve({ database_id: databaseId })
  const dataSourceId = 'data_sources' in database ? database.data_sources[0]?.id : undefined
  if (!dataSourceId) {
    throw new Error('Notionデータベースのデータソースが見つかりませんでした')
  }
  cachedDataSourceId = dataSourceId
  return dataSourceId
}

export type SnsPlatform = 'TikTok' | 'X' | 'Instagram' | 'note'
export type Originator = '自分' | 'AI提案' | '融合'
export type PostStatus =
  | 'アイデア'
  | 'AI提案'
  | '採用'
  | '撮影待ち'
  | '編集待ち'
  | '投稿待ち'
  | '投稿済み'
  | '分析済み'
  | 'ボツ'

export type SnsPost = {
  id: string
  url: string
  title: string
  theme: string
  originator: Originator | null
  platform: SnsPlatform | null
  status: PostStatus | null
  hook: string
  script: string
  telop: string
  materials: string
  cta: string
  reason: string
  postDate: string | null
  views: number | null
  likes: number | null
  comments: number | null
  saves: number | null
  followerGrowth: number | null
  selfRating: number | null
  reflection: string
  improvements: string
  nextSteps: string
  aiAnalysis: string
}

export type NewPostInput = {
  title: string
  theme?: string
  originator: Originator
  platform: SnsPlatform
  status: PostStatus
  hook?: string
  script?: string
  telop?: string
  materials?: string
  cta?: string
  reason?: string
}

// AIの出力をNotionにそのまま流し込まないよう、更新可能なフィールドを明示的に限定する
export type PostUpdateInput = Partial<{
  title: string
  theme: string
  originator: Originator
  platform: SnsPlatform
  status: PostStatus
  hook: string
  script: string
  telop: string
  materials: string
  cta: string
  reason: string
  postDate: string
  views: number
  likes: number
  comments: number
  saves: number
  followerGrowth: number
  selfRating: number
  reflection: string
  improvements: string
  nextSteps: string
  aiAnalysis: string
}>

function richText(text: string) {
  return { rich_text: [{ type: 'text' as const, text: { content: text.slice(0, 2000) } }] }
}

function title(text: string) {
  return { title: [{ type: 'text' as const, text: { content: text.slice(0, 2000) } }] }
}

function getPlainText(prop: unknown): string {
  const p = prop as { rich_text?: { plain_text: string }[]; title?: { plain_text: string }[] }
  const arr = p?.rich_text ?? p?.title
  return arr?.map((t) => t.plain_text).join('') ?? ''
}

function getSelect(prop: unknown): string | null {
  const p = prop as { select?: { name: string } | null }
  return p?.select?.name ?? null
}

function getStatus(prop: unknown): string | null {
  const p = prop as { status?: { name: string } | null }
  return p?.status?.name ?? null
}

function getNumber(prop: unknown): number | null {
  const p = prop as { number?: number | null }
  return p?.number ?? null
}

function getDate(prop: unknown): string | null {
  const p = prop as { date?: { start: string } | null }
  return p?.date?.start ?? null
}

function pageToPost(page: PageObjectResponse): SnsPost {
  const props = page.properties as Record<string, unknown>
  return {
    id: page.id,
    url: page.url,
    title: getPlainText(props['投稿タイトル']),
    theme: getPlainText(props['テーマ/企画名']),
    originator: getSelect(props['発案者']) as Originator | null,
    platform: getSelect(props['SNS']) as SnsPlatform | null,
    status: getStatus(props['ステータス']) as PostStatus | null,
    hook: getPlainText(props['冒頭のフック']),
    script: getPlainText(props['台本']),
    telop: getPlainText(props['テロップ案']),
    materials: getPlainText(props['撮影する素材']),
    cta: getPlainText(props['CTA']),
    reason: getPlainText(props['投稿する理由']),
    postDate: getDate(props['投稿日']),
    views: getNumber(props['再生数']),
    likes: getNumber(props['いいね数']),
    comments: getNumber(props['コメント数']),
    saves: getNumber(props['保存数']),
    followerGrowth: getNumber(props['フォロー増加数']),
    selfRating: getNumber(props['自分の評価']),
    reflection: getPlainText(props['感想・気づき']),
    improvements: getPlainText(props['改善点']),
    nextSteps: getPlainText(props['次回に活かすこと']),
    aiAnalysis: getPlainText(props['AI分析メモ']),
  }
}

export async function listPosts(filter?: QueryDataSourceParameters['filter']) {
  const dataSourceId = await getDataSourceId()
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
  })
  return response.results
    .filter((p): p is PageObjectResponse => p.object === 'page' && 'properties' in p)
    .map(pageToPost)
}

export async function getPost(pageId: string) {
  const page = await notion.pages.retrieve({ page_id: pageId })
  return pageToPost(page as PageObjectResponse)
}

export async function createPost(input: NewPostInput) {
  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      投稿タイトル: title(input.title),
      'テーマ/企画名': richText(input.theme ?? ''),
      発案者: { select: { name: input.originator } },
      SNS: { select: { name: input.platform } },
      ステータス: { status: { name: input.status } },
      冒頭のフック: richText(input.hook ?? ''),
      台本: richText(input.script ?? ''),
      テロップ案: richText(input.telop ?? ''),
      撮影する素材: richText(input.materials ?? ''),
      CTA: richText(input.cta ?? ''),
      投稿する理由: richText(input.reason ?? ''),
    },
  })
  return pageToPost(page as PageObjectResponse)
}

type PageProperties = NonNullable<UpdatePageParameters['properties']>

export async function updatePost(pageId: string, input: PostUpdateInput) {
  const properties: PageProperties = {}

  if (input.title !== undefined) properties['投稿タイトル'] = title(input.title)
  if (input.theme !== undefined) properties['テーマ/企画名'] = richText(input.theme)
  if (input.originator !== undefined) properties['発案者'] = { select: { name: input.originator } }
  if (input.platform !== undefined) properties['SNS'] = { select: { name: input.platform } }
  if (input.status !== undefined) properties['ステータス'] = { status: { name: input.status } }
  if (input.hook !== undefined) properties['冒頭のフック'] = richText(input.hook)
  if (input.script !== undefined) properties['台本'] = richText(input.script)
  if (input.telop !== undefined) properties['テロップ案'] = richText(input.telop)
  if (input.materials !== undefined) properties['撮影する素材'] = richText(input.materials)
  if (input.cta !== undefined) properties['CTA'] = richText(input.cta)
  if (input.reason !== undefined) properties['投稿する理由'] = richText(input.reason)
  if (input.postDate !== undefined) properties['投稿日'] = { date: { start: input.postDate } }
  if (input.views !== undefined) properties['再生数'] = { number: input.views }
  if (input.likes !== undefined) properties['いいね数'] = { number: input.likes }
  if (input.comments !== undefined) properties['コメント数'] = { number: input.comments }
  if (input.saves !== undefined) properties['保存数'] = { number: input.saves }
  if (input.followerGrowth !== undefined) properties['フォロー増加数'] = { number: input.followerGrowth }
  if (input.selfRating !== undefined) properties['自分の評価'] = { number: input.selfRating }
  if (input.reflection !== undefined) properties['感想・気づき'] = richText(input.reflection)
  if (input.improvements !== undefined) properties['改善点'] = richText(input.improvements)
  if (input.nextSteps !== undefined) properties['次回に活かすこと'] = richText(input.nextSteps)
  if (input.aiAnalysis !== undefined) properties['AI分析メモ'] = richText(input.aiAnalysis)

  const page = await notion.pages.update({ page_id: pageId, properties })
  return pageToPost(page as PageObjectResponse)
}
