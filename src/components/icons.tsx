// アプリ全体で使うアイコン。24px の線画に統一(線の太さ・角の丸みをそろえる)
type IconProps = { className?: string }

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'h-full w-full'}
    >
      {children}
    </svg>
  )
}

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 11.5 12 4l8.5 7.5" />
      <path d="M5.5 10v8.5a1 1 0 0 0 1 1H9.5v-6h5v6h3a1 1 0 0 0 1-1V10" />
    </Svg>
  )
}

// マイプラン(重なった層=積み上げる道筋)
export function PlanIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4 3.5 8.5 12 13l8.5-4.5L12 4Z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
    </Svg>
  )
}

export function ChatIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.4-4.3A7.5 7.5 0 1 1 20 11.5Z" />
    </Svg>
  )
}

export function RecordsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 20v-6" />
      <path d="M12 20V6" />
      <path d="M19 20v-9" />
      <path d="M3.5 20h17" />
    </Svg>
  )
}

export function UserIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
    </Svg>
  )
}

// プランを調整(つまみ)
export function SlidersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h9" />
      <path d="M17 7h3" />
      <circle cx="15" cy="7" r="2" />
      <path d="M4 17h3" />
      <path d="M11 17h9" />
      <circle cx="9" cy="17" r="2" />
    </Svg>
  )
}

// 美容相談(きらめき)
export function SparkleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5c.6 3.2 1.6 5.2 3 6.5 1.3 1.4 3.3 2.4 5.5 3-2.2.6-4.2 1.6-5.5 3-1.4 1.3-2.4 3.3-3 6.5-.6-3.2-1.6-5.2-3-6.5-1.3-1.4-3.3-2.4-5.5-3 2.2-.6 4.2-1.6 5.5-3 1.4-1.3 2.4-3.3 3-6.5Z" />
    </Svg>
  )
}

// 食事
export function MealsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 2.5v6.5a1.8 1.8 0 0 0 3.6 0V2.5" />
      <path d="M8.8 9v12.5" />
      <path d="M16 2.5c2 1.8 2 5.7 0 7.5l-1 .9v10.6" />
    </Svg>
  )
}

// 体重(はかり)
export function WeightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 11a3.5 3.5 0 0 1 7 0" />
      <path d="m12 11 1.6-2.2" />
    </Svg>
  )
}

// 筋トレ
export function WorkoutIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 8v8" />
      <path d="M17.5 8v8" />
      <path d="M3.5 10v4" />
      <path d="M20.5 10v4" />
      <path d="M6.5 12h11" />
    </Svg>
  )
}

// 成長(右上がりの線)
export function GrowthIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m4 16 5-5 3.5 3.5L20 7" />
      <path d="M15 7h5v5" />
    </Svg>
  )
}

export function SunIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </Svg>
  )
}

export function ClockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  )
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Svg>
  )
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  )
}
