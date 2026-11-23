/**
 * Fixed-height photo mosaic for the place sheet: one large photo plus up to
 * three stacked tiles. Tiles swap into the main slot; arrows and a counter
 * page through on any screen. The height never depends on image sizes, so
 * there is no empty space beside a short photo.
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/components/ui'
import { Photo } from '@/components/ui/PlaceImage'

interface PlaceHeroProps {
  urls: string[]
  isLoading: boolean
  alt: string
  emoji: string
  color: string
  onClose: () => void
}

const MAX_TILES = 3
const roundBtn =
  'inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur transition hover:scale-105 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-honey)]'

export function PlaceHero({ urls, isLoading, alt, emoji, color, onClose }: PlaceHeroProps) {
  const [active, setActive] = useState(0)
  const count = urls.length
  const index = count ? active % count : 0
  const tiles = urls.map((u, i) => ({ u, i })).filter((t) => t.i !== index).slice(0, MAX_TILES)
  const hasTiles = tiles.length > 0
  const step = (d: number) => setActive((index + d + count) % count)
  const isEmpty = !isLoading && count === 0

  return (
    <div className={cn('relative shrink-0', isEmpty ? 'h-36' : 'h-60 sm:h-80')} data-testid="place-hero">
      <div className={cn('grid size-full gap-1', hasTiles && 'sm:grid-cols-[2fr_1fr]')}>
        <div className="group relative min-h-0">
          <Photo key={urls[index] ?? 'none'} src={urls[index]} alt={alt} isLoading={isLoading} emoji={emoji} color={color} eager className="size-full" />
          {count > 1 && (
            <>
              <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className={cn(roundBtn, 'absolute left-3 top-1/2 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100')}>
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label="Next photo" onClick={() => step(1)} className={cn(roundBtn, 'absolute right-3 top-1/2 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100')}>
                <ChevronRight className="size-4" aria-hidden />
              </button>
              <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] font-semibold text-white backdrop-blur">
                {index + 1} / {count}
              </span>
            </>
          )}
        </div>
        {hasTiles && (
          <div className="hidden min-h-0 gap-1 sm:grid" style={{ gridTemplateRows: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
            {tiles.map(({ u, i }) => (
              <button key={u} type="button" onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} className="group/tile relative min-h-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-honey)]">
                <Photo src={u} alt={`${alt} photo ${i + 1}`} emoji={emoji} color={color} className="size-full" imgClassName="group-hover/tile:scale-105" />
                <span className="absolute inset-0 bg-black/0 transition group-hover/tile:bg-black/10" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/25 to-transparent" />
      <button type="button" aria-label="Close" onClick={onClose} className={cn(roundBtn, 'absolute right-3 top-3')}>
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
