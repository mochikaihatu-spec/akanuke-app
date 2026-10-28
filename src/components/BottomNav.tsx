'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChatIcon, HomeIcon, PlanIcon, RecordsIcon } from '@/components/icons'

// スマートフォンでは、親指で押しやすい4つに絞る(プロフィール・設定は、ホーム右上のアイコンから)
// match: そのタブが「いまの画面」とみなす場所(関連する画面もまとめて、現在地が分かるようにする)
const TABS = [
  {
    href: '/',
    label: 'ホーム',
    Icon: HomeIcon,
    match: (p: string) => p === '/',
  },
  {
    href: '/plan',
    label: 'マイプラン',
    Icon: PlanIcon,
    match: (p: string) => (p === '/plan' || p === '/onboarding'),
  },
  {
    href: '/ai',
    label: 'AI相談',
    Icon: ChatIcon,
    match: (p: string) =>
      ['/ai', '/chat', '/beauty', '/plan/consult'].some((x) => p === x || p.startsWith(`${x}/`)),
  },
  {
    href: '/records',
    label: '記録',
    Icon: RecordsIcon,
    match: (p: string) =>
      ['/records', '/meals', '/weight', '/workout'].some((x) => p === x || p.startsWith(`${x}/`)),
  },
]

const HIDDEN_ON = ['/login', '/privacy', '/terms']

export default function BottomNav() {
  const pathname = usePathname()

  if (HIDDEN_ON.includes(pathname)) return null

  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, Icon, match }) => {
          const isActive = match(pathname)

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors ${
                  isActive ? 'font-semibold text-blue-600' : 'font-medium text-slate-400'
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    isActive ? 'bg-blue-100' : ''
                  }`}
                >
                  <span className="h-5 w-5">
                    <Icon />
                  </span>
                </span>
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
