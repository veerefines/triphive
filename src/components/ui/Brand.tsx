/**
 * TripHive brand: the suitcase mark (public/brand/logo-mark-128.png) and a
 * wordmark that pairs it with themed text, so "Trip" stays readable on any
 * theme (the full PNG logo has a navy "Trip" that disappears on dark ones).
 */
import { cn } from '@/lib/utils'

const MARK_SRC = '/brand/logo-mark-128.png'

type MarkProps = { size?: number; className?: string; alt?: string }

export function BrandMark({ size = 28, className, alt = '' }: MarkProps) {
  return <img src={MARK_SRC} width={size} height={size} alt={alt} className={cn('shrink-0 select-none object-contain', className)} draggable={false} />
}

type WordmarkProps = { size?: 'md' | 'lg'; className?: string }

export function Wordmark({ size = 'md', className }: WordmarkProps) {
  const isLarge = size === 'lg'
  return (
    <span className={cn('inline-flex items-center gap-2 font-display font-bold tracking-tight', isLarge ? 'text-xl' : 'text-lg', className)}>
      <BrandMark size={isLarge ? 34 : 28} />
      <span>
        Trip<span className="text-primary">Hive</span>
      </span>
    </span>
  )
}

/** Hive's avatar in chats: the mark on a soft honey disc. */
export function HiveAvatar({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-honey/25', className)} style={{ width: size, height: size }}>
      <BrandMark size={Math.round(size * 0.72)} alt="Hive" />
    </span>
  )
}
