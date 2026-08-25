'use client'

import { useState } from 'react'

export type FacePart = '肌' | '眉' | '髪型' | '輪郭' | '姿勢'
export type FaceIllustration = 'male' | 'female'

const IMAGE_SRC: Record<FaceIllustration, string> = {
  male: '/face-male.jpg',
  female: '/face-female.jpg',
}

const PARTS: FacePart[] = ['肌', '眉', '髪型', '輪郭', '姿勢']

// 描画順(後のものほど前面) = 重なった時に優先されるパーツ
const HOTSPOTS: { part: FacePart; top: string; left: string; width: string; height: string }[] = [
  { part: '姿勢', top: '68%', left: '0%', width: '100%', height: '32%' },
  { part: '髪型', top: '0%', left: '10%', width: '80%', height: '34%' },
  { part: '肌', top: '38%', left: '18%', width: '64%', height: '20%' },
  { part: '輪郭', top: '50%', left: '12%', width: '76%', height: '20%' },
  { part: '眉', top: '30%', left: '22%', width: '56%', height: '12%' },
]

export default function FaceDiagram({
  illustration,
  activePart,
  onTapPart,
}: {
  illustration: FaceIllustration
  activePart: string | null
  onTapPart: (part: FacePart) => void
}) {
  const [hoveredPart, setHoveredPart] = useState<FacePart | null>(null)

  function fillFor(part: FacePart) {
    if (activePart === part) return 'rgba(225, 29, 72, 0.22)'
    if (hoveredPart === part) return 'rgba(225, 29, 72, 0.12)'
    return 'transparent'
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative mx-auto w-full max-w-[220px] overflow-hidden rounded-3xl bg-slate-100"
        style={{ aspectRatio: '3 / 4' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMAGE_SRC[illustration]}
          alt="顔のイラスト。パーツをタップすると相談できます"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />

        {HOTSPOTS.map(({ part, top, left, width, height }) => (
          <button
            key={part}
            type="button"
            onClick={() => onTapPart(part)}
            onMouseEnter={() => setHoveredPart(part)}
            onMouseLeave={() => setHoveredPart(null)}
            aria-label={`${part}について相談する`}
            className="absolute cursor-pointer rounded-2xl transition-colors"
            style={{ top, left, width, height, backgroundColor: fillFor(part) }}
          />
        ))}
      </div>

      <p className="text-xs text-slate-400">気になるパーツをタップしてください</p>

      <div className="flex flex-wrap justify-center gap-2">
        {PARTS.map((part) => (
          <button
            key={part}
            type="button"
            onClick={() => onTapPart(part)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activePart === part
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-slate-200 text-slate-500'
            }`}
          >
            {part}
          </button>
        ))}
      </div>
    </div>
  )
}
