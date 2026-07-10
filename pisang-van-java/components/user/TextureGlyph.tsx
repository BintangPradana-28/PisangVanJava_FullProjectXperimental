import type { CSSProperties } from 'react'

type TextureType = 'Kembung' | 'Lumpia' | 'Krispy'

interface TextureGlyphProps {
  type: TextureType
  className?: string
  style?: CSSProperties
}

export function TextureGlyph({ type, className, style }: TextureGlyphProps) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    className,
    style
  }

  if (type === 'Kembung') {
    // Puffy, irregular soft blob — 6 asymmetric lobes (not a perfect circle)
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M 12 2.5 Q 12 2.5 15.25 5.38 Q 18.5 8.25 19.49 12.57 Q 20.49 16.9 16.24 17.95 Q 12 19 8.02 17.8 Q 4.03 16.6 4.64 12.35 Q 5.25 8.1 8.62 5.3 Z" />
      </svg>
    )
  }

  if (type === 'Lumpia') {
    // Thin, tightly rolled — 1.75-turn spiral from center outward
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M 12 11 L 12.59 10.79 L 13.34 10.97 L 13.99 11.6 L 14.29 12.61 L 14.04 13.79 L 13.17 14.83 L 11.78 15.4 L 10.13 15.25 L 8.6 14.27 L 7.6 12.58 L 7.47 10.46 L 8.38 8.38 L 10.24 6.82 L 12.76 6.24 L 15.42 6.88 L 17.63 8.75 L 18.83 11.55 L 18.64 14.75 L 16.96 17.66 L 14.04 19.6 L 10.4 20.06 L 6.79 18.79 L 4.02 15.94 L 2.75 12" />
      </svg>
    )
  }

  // Krispy — irregular jagged star, 10 alternating points (crunchy, not a smooth shape)
  return (
    <svg {...commonProps} aria-hidden="true">
      <path
        d="M 12 1.5 L 13.7 6.77 L 17.76 4.07 L 17.02 8.36 L 22.46 8.6 L 17.2 12 L 21.04 14.94 L 17.26 15.82 L 18.35 20.74 L 13.67 17.14 L 12 21.9 L 10.11 17.8 L 5.77 20.58 L 7.71 15.12 L 2.77 15 L 5.7 12 L 1.35 8.54 L 7.87 9 L 6.36 4.23 L 10.15 6.29 Z"
        strokeLinejoin="miter"
      />
    </svg>
  )
}

/**
 * Small caption row explaining what each glyph means — shown once, above the
 * style picker, so the icons are self-documenting on first encounter rather
 * than a mystery symbol customers have to guess at.
 */
export function TextureLegend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
      <span className="flex items-center gap-1">
        <TextureGlyph type="Kembung" className="w-3 h-3" /> Puffy
      </span>
      <span className="flex items-center gap-1">
        <TextureGlyph type="Lumpia" className="w-3 h-3" /> Tipis
      </span>
      <span className="flex items-center gap-1">
        <TextureGlyph type="Krispy" className="w-3 h-3" /> Renyah
      </span>
    </div>
  )
}
