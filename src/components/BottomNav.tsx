'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: 'ホーム', icon: '🏠' },
  { href: '/profile', label: 'プロフィール', icon: '👤' },
  { href: '/meals', label: '食事記録', icon: '🍽️' },
  { href: '/weight', label: '体重', icon: '⚖️' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-sm">
        {TABS.map((tab) => {
          const isActive =
            tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs transition-colors ${
                isActive ? 'font-semibold text-zinc-900' : 'text-zinc-400'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
