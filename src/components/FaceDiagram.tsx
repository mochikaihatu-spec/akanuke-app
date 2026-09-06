'use client'

import { useState } from 'react'

export type FacePart = '髪' | '眉' | '肌' | '目元' | '鼻' | '輪郭'
export type FaceIllustration = 'male' | 'female'

const PARTS: FacePart[] = ['髪', '眉', '目元', '鼻', '肌', '輪郭']

const LINE = '#475569' // slate-600
const SILHOUETTE_FILL = '#e2e8f0' // slate-200
const SKIN_FILL = '#ffffff'

const ACTIVE_FILL = 'rgba(37, 99, 235, 0.16)' // blue-600 の淡いティント
const HOVER_FILL = 'rgba(37, 99, 235, 0.08)'

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
    if (activePart === part) return ACTIVE_FILL
    if (hoveredPart === part) return HOVER_FILL
    return 'transparent'
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-[28px] bg-slate-50">
        <svg
          viewBox="0 0 240 320"
          className="w-full"
          aria-label="あなたのイメージモデル。パーツをタップすると相談できます"
        >
          {/* 肩 */}
          <path
            d="M40 320 C40 250 75 225 120 225 C165 225 200 250 200 320 Z"
            fill={SKIN_FILL}
          />

          {/* 首 */}
          <rect x="105" y="185" width="30" height="45" fill={SKIN_FILL} />

          {/* 髪(共通シルエット) */}
          <path
            d="M62 145 C58 92 82 58 120 58 C158 58 182 92 178 145 C178 118 162 96 120 96 C78 96 62 118 62 145 Z"
            fill={SILHOUETTE_FILL}
          />

          {/* 髪(女性用の毛先) */}
          {illustration === 'female' && (
            <>
              <path
                d="M64 130 C58 160 55 195 58 225 C60 235 68 240 75 238 C68 220 66 185 72 150 C70 143 67 136 64 130 Z"
                fill={SILHOUETTE_FILL}
              />
              <path
                d="M176 130 C182 160 185 195 182 225 C180 235 172 240 165 238 C172 220 174 185 168 150 C170 143 173 136 176 130 Z"
                fill={SILHOUETTE_FILL}
              />
            </>
          )}

          {/* 顔 */}
          <ellipse
            cx="120"
            cy="150"
            rx="55"
            ry="68"
            fill={SKIN_FILL}
            stroke="#e2e8f0"
            strokeWidth="1"
          />

          {/* 眉 */}
          <path d="M95 128 Q104 121 114 126" fill="none" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M126 126 Q136 121 145 128" fill="none" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" />

          {/* 目 */}
          <ellipse cx="103" cy="145" rx="4.5" ry="3.5" fill={LINE} />
          <ellipse cx="137" cy="145" rx="4.5" ry="3.5" fill={LINE} />

          {/* 鼻・口 */}
          <path d="M120 150 L117 166 Q120 169 123 166" fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M107 182 Q120 188 133 182" fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" />

          {/* ── タップ領域(広め・重なりは後勝ち) ── */}

          <ellipse
            cx="120" cy="163" rx="50" ry="30"
            fill={fillFor('肌')}
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredPart('肌')}
            onMouseLeave={() => setHoveredPart(null)}
            onClick={() => onTapPart('肌')}
            role="button"
            aria-label="肌について相談する"
          />

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

          <ellipse
            cx="120" cy="90" rx="66" ry="42"
            fill={fillFor('髪')}
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredPart('髪')}
            onMouseLeave={() => setHoveredPart(null)}
            onClick={() => onTapPart('髪')}
            role="button"
            aria-label="髪について相談する"
          />

          <rect
            x="85" y="136" width="70" height="16" rx="8"
            fill={fillFor('目元')}
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredPart('目元')}
            onMouseLeave={() => setHoveredPart(null)}
            onClick={() => onTapPart('目元')}
            role="button"
            aria-label="目元について相談する"
          />

          <rect
            x="82" y="112" width="76" height="22" rx="11"
            fill={fillFor('眉')}
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredPart('眉')}
            onMouseLeave={() => setHoveredPart(null)}
            onClick={() => onTapPart('眉')}
            role="button"
            aria-label="眉について相談する"
          />

          <rect
            x="104" y="150" width="32" height="26" rx="8"
            fill={fillFor('鼻')}
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredPart('鼻')}
            onMouseLeave={() => setHoveredPart(null)}
            onClick={() => onTapPart('鼻')}
            role="button"
            aria-label="鼻について相談する"
          />
        </svg>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {PARTS.map((part) => (
          <button
            key={part}
            type="button"
            onClick={() => onTapPart(part)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activePart === part
                ? 'border-blue-200 bg-blue-50 text-blue-700'
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
