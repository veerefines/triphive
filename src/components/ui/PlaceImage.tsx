/**
 * A place photo with a fixed aspect ratio (no layout shift), lazy loading,
 * a shimmer while it resolves, and a tinted emoji tile when no photo exists
 * or the image fails. `PlaceGallery` is a swipeable scroll-snap carousel.
 */
import { useState } from 'react'
import type { PhotoQuery } from '@/server/photos'
import { usePlacePhotos } from '@/lib/usePlacePhotos'
import { cn } from '@/lib/utils'

type FallbackProps = { emoji?: string; color?: string }

function Fallback({ emoji = '📍', color = '#a16207', className }: FallbackProps & { className?: string }) {
  return (
    <div className={cn('flex size-full items-center justify-center text-2xl', className)} style={{ background: `linear-gradient(135deg, ${color}22, ${color}0d)` }} aria-hidden="true">
      {emoji}
    </div>
  )
}

type PhotoProps = FallbackProps & { src?: string; alt: string; isLoading?: boolean; className?: string; imgClassName?: string; eager?: boolean }

/** Renders one known URL (or the fallback). */
export function Photo({ src, alt, isLoading, emoji, color, className, imgClassName, eager }: PhotoProps) {
  const [failed, setFailed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const isBroken = !src || failed === src
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {isLoading && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {!isLoading && isBroken && <Fallback emoji={emoji} color={color} />}
      {!isBroken && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
          className={cn('size-full object-cover transition-[opacity,transform] duration-500', loaded === src ? 'opacity-100' : 'opacity-0', imgClassName)}
        />
      )}
    </div>
  )
}

type PlaceImageProps = FallbackProps & { query: PhotoQuery | null; alt: string; className?: string; imgClassName?: string }

/** First photo of a place, looked up by name. */
export function PlaceImage({ query, alt, ...rest }: PlaceImageProps) {
  const { urls, isLoading } = usePlacePhotos(query)
  return <Photo src={urls[0]} alt={alt} isLoading={isLoading} {...rest} />
}

type GalleryProps = FallbackProps & { query: PhotoQuery; alt: string; className?: string }

/** Swipeable photo hero with position dots. */
export function PlaceGallery({ query, alt, emoji, color, className }: GalleryProps) {
  const { urls, isLoading } = usePlacePhotos({ ...query, max: query.max ?? 4 })
  const [index, setIndex] = useState(0)
  if (isLoading || urls.length <= 1) return <Photo src={urls[0]} alt={alt} isLoading={isLoading} emoji={emoji} color={color} className={className} eager />

  return (
    <div className={cn('relative', className)} data-testid="place-gallery">
      <div
        className="flex size-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
      >
        {urls.map((u, i) => (
          <Photo key={u} src={u} alt={`${alt} photo ${i + 1}`} emoji={emoji} color={color} className="size-full shrink-0 snap-center" eager={i === 0} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
        {urls.map((u, i) => (
          <span key={u} className={cn('h-1.5 rounded-full bg-white/90 shadow transition-all', i === index ? 'w-4' : 'w-1.5 opacity-60')} />
        ))}
      </div>
    </div>
  )
}
