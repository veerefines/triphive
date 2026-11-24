/**
 * Trip / listing cover: a crossfading slideshow of real photos of the
 * destination (Google Places first, filtered Wikipedia fallback). While
 * photos load, or when none exist, a warm gradient derived from the
 * destination name fills the frame, never a map tile.
 */
import { useEffect, useMemo, useState } from 'react'
import { usePlacePhotos } from '@/lib/usePlacePhotos'
import { cn } from '@/lib/utils'

const COVER_PHOTOS = 4
const SLIDE_MS = 4500
const MAX_START_OFFSET_MS = 1500
/** Gradient families, picked deterministically from the destination name. */
const FALLBACK_GRADIENTS = [
  'from-[#f4a259] via-[#e0703c] to-[#7a3412]',
  'from-[#7fb7be] via-[#3f7f8c] to-[#1d3c45]',
  'from-[#c9a66b] via-[#8c6a3f] to-[#3b2a18]',
  'from-[#e8a0bf] via-[#b05a7a] to-[#4a1f33]',
  'from-[#9bc48a] via-[#5a8a4a] to-[#24401c]',
]

type DestinationCoverProps = {
  destination: string
  lat?: number
  lng?: number
  /** Show the slide dots (default true). */
  hasIndicator?: boolean
  /** Varies the first photo, so trips to the same city do not look identical. */
  seedKey?: string
}

function hashOf(text: string): number {
  return [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function DestinationCover({ destination, lat, lng, hasIndicator = true, seedKey = '' }: DestinationCoverProps) {
  const { urls, isLoading } = usePlacePhotos(destination ? { q: destination, lat, lng, max: COVER_PHOTOS } : null)
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set())
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const [tick, setTick] = useState(0)

  const slides = useMemo(() => urls.filter((u) => !failed.has(u)), [urls, failed])
  const ready = slides.filter((u) => loaded.has(u))
  const seed = hashOf(destination.toLowerCase())
  const gradient = FALLBACK_GRADIENTS[seed % FALLBACK_GRADIENTS.length]
  const startSlide = seedKey ? hashOf(seedKey) : 0
  const active = ready.length ? ready[(startSlide + tick) % ready.length] : null

  useEffect(() => {
    if (ready.length < 2 || prefersReducedMotion()) return
    // Offset each card so a grid of covers does not flip in lockstep.
    let timer: ReturnType<typeof setInterval> | undefined
    const start = setTimeout(() => {
      setTick((i) => i + 1)
      timer = setInterval(() => setTick((i) => i + 1), SLIDE_MS)
    }, SLIDE_MS + ((seed + startSlide) % MAX_START_OFFSET_MS))
    return () => {
      clearTimeout(start)
      if (timer) clearInterval(timer)
    }
  }, [ready.length, seed, startSlide])

  return (
    <>
      <div aria-hidden className={cn('absolute inset-0 bg-gradient-to-br', gradient, isLoading && 'animate-pulse')}>
        <span className="font-display absolute -bottom-6 -right-2 select-none text-[9rem] font-semibold leading-none text-white/10">
          {destination.trim().charAt(0).toUpperCase()}
        </span>
      </div>
      {slides.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded((s) => new Set([...s, src]))}
          onError={() => setFailed((s) => new Set([...s, src]))}
          className={cn(
            'absolute inset-0 size-full object-cover transition-[opacity,transform] duration-[1200ms] ease-out group-hover:scale-[1.04]',
            src === active ? 'scale-[1.02] opacity-100' : 'scale-100 opacity-0',
          )}
        />
      ))}
      {hasIndicator && ready.length > 1 && (
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-2 z-[1] flex -translate-x-1/2 gap-1">
          {ready.map((src) => (
            <span key={src} className={cn('h-1 rounded-full bg-white shadow transition-all duration-500', src === active ? 'w-4 opacity-95' : 'w-1.5 opacity-50')} />
          ))}
        </div>
      )}
    </>
  )
}
