/**
 * Trip / listing cover: the destination's photo over the map tile. The map
 * (and its pin) stays as the base layer, so a slow or missing photo still
 * leaves a real cover instead of a gray box.
 */
import { useState, type ReactNode } from 'react'
import { usePlacePhotos } from '@/lib/usePlacePhotos'
import { cn } from '@/lib/utils'
import { MapCover } from './MapCover'

type DestinationCoverProps = {
  destination: string
  lat?: number
  lng?: number
  rx?: number
  ry?: number
  /** Drawn over the map only; hidden once the photo shows. */
  pin?: ReactNode
}

export function DestinationCover({ destination, lat, lng, rx, ry, pin }: DestinationCoverProps) {
  const { urls } = usePlacePhotos(destination ? { q: destination, lat, lng } : null)
  const [shown, setShown] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const src = urls[0] && urls[0] !== failed ? urls[0] : undefined
  const isPhotoVisible = !!src && shown === src
  return (
    <>
      <MapCover lat={lat} lng={lng} rx={rx} ry={ry} />
      {!isPhotoVisible && pin}
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setShown(src)}
          onError={() => setFailed(src)}
          className={cn('absolute inset-0 size-full object-cover transition-[opacity,transform] duration-700 group-hover:scale-[1.03]', isPhotoVisible ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </>
  )
}
