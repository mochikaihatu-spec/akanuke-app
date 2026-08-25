'use client'

import { useState } from 'react'

export type FacePart = '髪' | '眉' | '肌' | '目元' | '鼻' | '輪郭'
export type FaceIllustration = 'male' | 'female'

const IMAGE_SRC: Record<FaceIllustration, string> = {
  male: '/face-male.jpg',
  female: '/face-female.jpg',
}

const PARTS: FacePart[] = ['髪', '眉', '目元', '鼻', '肌', '輪郭']

// 描画順(後のものほど前面) = 重なった時に優先されるパーツ
const HOTSPOTS: { part: FacePart; top: string; left: string; width: string; height: string }[] = [
  { part: '肌', top: '38%', left: '14%', width: '72%', height: '26%' },
  { part: '髪', top: '0%', left: '8%', width: '84%', height: '32%' },
  { part: '輪郭', top: '54%', left: '12%', width: '76%', height: '18%' },
  { part: '目元', top: '36%', left: '22%', width: '56%', height: '9%' },
  { part: '鼻', top: '45%', left: '41%', width: '18%', height: '13%' },
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

  function styleFor(part: FacePart): React.CSSProperties {
    if (activePart === part) {
      return {
        backgroundColor: 'rgba(219, 39, 119, 0.16)',
        boxShadow: '0 0 0 1.5px rgba(219, 39, 119, 0.55) inset',
      }
    }
    if (hoveredPart === part) {
      return { backgroundColor: 'rgba(219, 39, 119, 0.08)' }
    }
    return { backgroundColor: 'transparent' }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative mx-auto w-full max-w-[240px] overflow-hidden rounded-[28px] bg-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-100"
        style={{ aspectRatio: '3 / 4' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMAGE_SRC[illustration]}
          alt="あなたのイメージモデル。パーツをタップすると相談できます"
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
            style={{ top, left, width, height, ...styleFor(part) }}
          />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {PARTS.map((part) => (
          <button
            key={part}
            type="button"
            onClick={() => onTapPart(part)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activePart === part
                ? 'border-rose-300 bg-rose-50 text-rose-700'
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
