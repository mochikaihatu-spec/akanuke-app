'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 11.5 12 4l8.5 7.5" />
      <path d="M5.5 10v8.5a1 1 0 0 0 1 1H9.5v-6h5v6h3a1 1 0 0 0 1-1V10" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
    </svg>
  )
}

function MealsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2.5v6.5a1.8 1.8 0 0 0 3.6 0V2.5" />
      <path d="M8.8 9v12.5" />
      <path d="M16 2.5c2 1.8 2 5.7 0 7.5l-1 .9v10.6" />
    </svg>
  )
}

function WeightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="7" width="16" height="13.5" rx="3" />
      <path d="M12 10.2v2.8l1.8 1.8" />
    </svg>
  )
}

function BeautyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 3.2c.6 2.9 1.4 4.7 2.5 5.8 1.1 1.1 2.9 1.9 5.8 2.5-2.9.6-4.7 1.4-5.8 2.5-1.1 1.1-1.9 2.9-2.5 5.8-.6-2.9-1.4-4.7-2.5-5.8-1.1-1.1-2.9-1.9-5.8-2.5 2.9-.6 4.7-1.4 5.8-2.5 1.1-1.1 1.9-2.9 2.5-5.8Z" />
    </svg>
  )
}

const TABS = [
  { href: '/', label: 'ホーム', Icon: HomeIcon },
  { href: '/profile', label: 'プロフィール', Icon: ProfileIcon },
  { href: '/meals', label: '食事記録', Icon: MealsIcon },
  { href: '/weight', label: '体重', Icon: WeightIcon },
  { href: '/beauty', label: '美容', Icon: BeautyIcon },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-sm">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] transition-colors ${
                isActive ? 'font-medium text-blue-600' : 'text-slate-400'
              }`}
            >
              <span className="h-5 w-5">
                <Icon />
              </span>
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
