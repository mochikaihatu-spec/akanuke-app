import type { UsageItem } from '@/lib/use-usage'

// 「今月のプラン作成: あと1回」のような残り回数の表示。上限に達したら、リセットの時期と有料プランの案内を出す
export default function UsageNote({ item }: { item: UsageItem | undefined }) {
  if (!item) return null

  const when = item.period === 'month' ? '今月' : '今日'
  const exhausted = item.remaining === 0

  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
      <p className={exhausted ? 'font-medium text-slate-700' : ''}>
        {when}の{item.label}: あと{item.remaining}回(全{item.limit}回)
      </p>
      <p className="text-slate-400">{item.resetLabel}にリセットされます</p>
      {exhausted && item.hint && <p className="mt-1 text-slate-400">{item.hint}</p>}
    </div>
  )
}
