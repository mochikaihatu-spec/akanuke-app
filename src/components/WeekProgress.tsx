import { computeProgress, type MissionLog } from '@/lib/mission'

// 今週の進捗。実際の記録だけから計算する(架空の達成率や連続日数は出さない)
function message(weekDone: number, streak: number) {
  if (weekDone >= 7) return '今週は全部できました。すばらしい!'
  if (weekDone >= 4) return 'しっかり続いています。この調子で。'
  if (weekDone >= 1) return '一歩ずつ進んでいます。完璧じゃなくて大丈夫。'
  return streak > 0
    ? '続けてきた流れを、今日もつなげよう。'
    : '今日から、自分のペースで始めよう。'
}

export default function WeekProgress({
  logs,
  cycleStart,
}: {
  logs: MissionLog[]
  cycleStart: string
}) {
  const progress = computeProgress(logs, cycleStart, new Date())

  return (
    <section
      aria-label="今週の進捗"
      className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-slate-900">今週の進捗</h2>
        <p className="text-sm font-semibold text-blue-600">{progress.weekDone} / 7日</p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={7}
        aria-valuenow={progress.weekDone}
        aria-label="今週の完了日数"
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width]"
          style={{ width: `${(progress.weekDone / 7) * 100}%` }}
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        {message(progress.weekDone, progress.streak)}
        {progress.streak > 0 && (
          <span className="ml-1 whitespace-nowrap font-semibold text-slate-700">連続{progress.streak}日</span>
        )}
      </p>
    </section>
  )
}
