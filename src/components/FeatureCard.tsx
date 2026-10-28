import Link from 'next/link'
import { ChevronRightIcon } from '@/components/icons'

// 機能への入口カード。色は役割ごとに4種類だけ(ラベンダー=プラン、コーラル=調整、セージ=相談、サンド=記録)
const TONES = {
  lavender: 'bg-blue-100 text-blue-700',
  coral: 'bg-coral-50 text-coral-600',
  sage: 'bg-sage-50 text-sage-600',
  sand: 'bg-sand-50 text-sand-600',
} as const

export type FeatureTone = keyof typeof TONES

type Props = {
  href: string
  title: string
  description: string
  Icon: (p: { className?: string }) => React.JSX.Element
  tone: FeatureTone
  // tile: ホームの2列のカード / row: 1行ぶんの横長カード
  variant?: 'tile' | 'row'
  note?: string
}

export default function FeatureCard({ href, title, description, Icon, tone, variant = 'tile', note }: Props) {
  const iconTile = (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONES[tone]}`}>
      <span className="h-5 w-5">
        <Icon />
      </span>
    </span>
  )

  if (variant === 'row') {
    return (
      <Link
        href={href}
        className="flex min-h-16 items-center gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
      >
        {iconTile}
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-slate-900">{title}</span>
          <span className="mt-0.5 block text-sm leading-snug text-slate-500">{description}</span>
          {note && <span className="mt-1 block text-xs font-medium text-blue-600">{note}</span>}
        </span>
        <span className="h-4 w-4 shrink-0 text-slate-400">
          <ChevronRightIcon />
        </span>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className="flex min-h-36 flex-col rounded-3xl border border-slate-100 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
    >
      {iconTile}
      <span className="mt-3 block text-base font-semibold text-slate-900">{title}</span>
      <span className="mt-1 block text-sm leading-snug text-slate-500">{description}</span>
    </Link>
  )
}
