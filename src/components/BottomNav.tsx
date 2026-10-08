'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

function WorkoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.3" y="9" width="3" height="6" rx="1" />
      <rect x="18.7" y="9" width="3" height="6" rx="1" />
      <path d="M5.3 12h13.4" />
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

const ALL_TABS = [
  { href: '/', label: 'ホーム', Icon: HomeIcon, key: null as 'use_workout' | 'use_beauty' | null },
  { href: '/profile', label: 'プロフィール', Icon: ProfileIcon, key: null },
  { href: '/meals', label: '食事記録', Icon: MealsIcon, key: null },
  { href: '/weight', label: '体重', Icon: WeightIcon, key: null },
  { href: '/workout', label: '筋トレ', Icon: WorkoutIcon, key: 'use_workout' },
  { href: '/beauty', label: '美容', Icon: BeautyIcon, key: 'use_beauty' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [useWorkout, setUseWorkout] = useState(false)
  const [useBeauty, setUseBeauty] = useState(false)

  useEffect(() => {
    async function loadFlags() {
      const { data } = await supabase
        .from('profile')
        .select('use_workout, use_beauty')
        .maybeSingle()

      setUseWorkout(Boolean(data?.use_workout))
      setUseBeauty(Boolean(data?.use_beauty))
    }

    loadFlags()

    // ログイン・ログアウトのたびに、そのユーザーの設定を読み直す
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUseWorkout(false)
        setUseBeauty(false)
      } else if (event === 'SIGNED_IN') {
        setTimeout(loadFlags, 0)
      }
    })

    function handleFlagsChanged(e: Event) {
      const detail = (e as CustomEvent<{ key: 'use_workout' | 'use_beauty'; value: boolean }>)
        .detail
      if (!detail) return
      if (detail.key === 'use_workout') setUseWorkout(detail.value)
      if (detail.key === 'use_beauty') setUseBeauty(detail.value)
    }

    window.addEventListener('akanuke:feature-flags-changed', handleFlagsChanged)
    return () => {
      authListener.subscription.unsubscribe()
      window.removeEventListener('akanuke:feature-flags-changed', handleFlagsChanged)
    }
  }, [])

  if (pathname === '/login') return null

  const tabs = ALL_TABS.filter((tab) => {
    if (tab.key === 'use_workout') return useWorkout
    if (tab.key === 'use_beauty') return useBeauty
    return true
  })

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-sm">
        {tabs.map(({ href, label, Icon }) => {
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
