'use client'

import { useState } from 'react'

export type FacePart = '肌' | '眉' | '髪型' | '輪郭' | '姿勢'

const PARTS: FacePart[] = ['肌', '眉', '髪型', '輪郭', '姿勢']

export default function FaceDiagram({
  activePart,
  onTapPart,
}: {
  activePart: string | null
  onTapPart: (part: FacePart) => void
}) {
  const [hoveredPart, setHoveredPart] = useState<FacePart | null>(null)

  function fillFor(part: FacePart) {
    if (activePart === part) return 'rgba(24, 24, 27, 0.18)'
    if (hoveredPart === part) return 'rgba(24, 24, 27, 0.1)'
    return 'transparent'
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 240 320"
        className="w-full max-w-[220px]"
        role="img"
        aria-label="顔のイラスト。パーツをタップすると相談できます"
      >
        {/* 肩(姿勢の絵) */}
        <path
          d="M30 320 C30 250 70 225 120 225 C170 225 210 250 210 320 Z"
          fill="#fafafa"
          stroke="#18181b"
          strokeWidth="2"
        />
        {/* 首 */}
        <rect x="104" y="185" width="32" height="45" fill="#fafafa" stroke="#18181b" strokeWidth="2" />

        {/* 髪(後ろ側) */}
        <path
          d="M60 145 C55 90 80 55 120 55 C160 55 185 90 180 145 C180 120 165 95 120 95 C75 95 60 120 60 145 Z"
          fill="#fafafa"
          stroke="#18181b"
          strokeWidth="2"
        />

        {/* 顔(輪郭のベース) */}
        <ellipse cx="120" cy="150" rx="58" ry="72" fill="#fffdf8" stroke="#18181b" strokeWidth="2" />

        {/* 眉 */}
        <path d="M95 128 Q104 121 114 126" fill="none" stroke="#18181b" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M126 126 Q136 121 145 128" fill="none" stroke="#18181b" strokeWidth="2.5" strokeLinecap="round" />

        {/* 目 */}
        <ellipse cx="103" cy="145" rx="5" ry="4" fill="#18181b" />
        <ellipse cx="137" cy="145" rx="5" ry="4" fill="#18181b" />

        {/* 鼻・口 */}
        <path d="M120 150 L117 168 Q120 171 123 168" fill="none" stroke="#18181b" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M107 183 Q120 190 133 183" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />

        {/* ── タップ領域(透明・少し広め) ── */}

        {/* 髪型 */}
        <ellipse
          cx="120"
          cy="90"
          rx="66"
          ry="42"
          fill={fillFor('髪型')}
          className="cursor-pointer transition-colors"
          onMouseEnter={() => setHoveredPart('髪型')}
          onMouseLeave={() => setHoveredPart(null)}
          onClick={() => onTapPart('髪型')}
          role="button"
          aria-label="髪型について相談する"
        />

        {/* 眉 */}
        <rect
          x="82"
          y="112"
          width="76"
          height="26"
          rx="13"
          fill={fillFor('眉')}
          className="cursor-pointer transition-colors"
          onMouseEnter={() => setHoveredPart('眉')}
          onMouseLeave={() => setHoveredPart(null)}
          onClick={() => onTapPart('眉')}
          role="button"
          aria-label="眉について相談する"
        />

        {/* 肌(頬・鼻まわり) */}
        <ellipse
          cx="120"
          cy="163"
          rx="48"
          ry="26"
          fill={fillFor('肌')}
          className="cursor-pointer transition-colors"
          onMouseEnter={() => setHoveredPart('肌')}
          onMouseLeave={() => setHoveredPart(null)}
          onClick={() => onTapPart('肌')}
          role="button"
          aria-label="肌について相談する"
        />

        {/* 輪郭(あご・フェイスライン) */}
        <path
          d="M64 165 C64 195 85 218 120 220 C155 218 176 195 176 165 C176 190 158 210 120 212 C82 210 64 190 64 165 Z"
          fill={fillFor('輪郭')}
          className="cursor-pointer transition-colors"
          onMouseEnter={() => setHoveredPart('輪郭')}
          onMouseLeave={() => setHoveredPart(null)}
          onClick={() => onTapPart('輪郭')}
          role="button"
          aria-label="輪郭について相談する"
        />

        {/* 姿勢(肩まわり) */}
        <path
          d="M30 320 C30 250 70 225 120 225 C170 225 210 250 210 320 Z"
          fill={fillFor('姿勢')}
          className="cursor-pointer transition-colors"
          onMouseEnter={() => setHoveredPart('姿勢')}
          onMouseLeave={() => setHoveredPart(null)}
          onClick={() => onTapPart('姿勢')}
          role="button"
          aria-label="姿勢について相談する"
        />
      </svg>

      <p className="text-xs text-zinc-400">気になるパーツをタップしてください</p>

      <div className="flex flex-wrap justify-center gap-2">
        {PARTS.map((part) => (
          <button
            key={part}
            type="button"
            onClick={() => onTapPart(part)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activePart === part
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 text-zinc-500'
            }`}
          >
            {part}
          </button>
        ))}
      </div>
    </div>
  )
}
