/**
 * Best-route legs for one day: picks walk / transit / taxi per hop (see
 * src/lib/legs.ts) and upgrades estimates with real OSRM street routes as
 * they arrive. Starts from instant haversine estimates so the UI never waits.
 */
import { useEffect, useMemo, useState } from 'react'
import { chooseLeg, type LegChoice } from '@/lib/legs'
import { routeBetween, type RoutedPath } from '@/lib/routing'
import type { TripMoney } from './useTripMoney'

export interface DayStopPoint {
  id: string
  title: string
  lat: number
  lng: number
  start?: string
}

export interface DayLeg extends LegChoice {
  fromId: string
  toId: string
  /** Street geometry when routed; straight line otherwise. */
  path: Array<[number, number]>
  isRouted: boolean
}

interface Routed {
  foot: RoutedPath | null
  car: RoutedPath | null
}

const isNight = (start?: string) => {
  const h = Number(start?.slice(0, 2))
  return Number.isFinite(h) && (h >= 21 || h < 6)
}

export function useDayRoutes(points: DayStopPoint[], money: TripMoney, rainy: boolean): DayLeg[] {
  const pairKey = points.map((p) => `${p.id}@${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')
  const [routed, setRouted] = useState<Record<string, Routed>>({})

  useEffect(() => {
    let alive = true
    points.slice(1).forEach((b, i) => {
      const a = points[i]
      const k = `${a.id}>${b.id}`
      Promise.all([routeBetween('foot', a, b), routeBetween('car', a, b)]).then(([foot, car]) => {
        if (alive && (foot || car)) setRouted((prev) => ({ ...prev, [k]: { foot, car } }))
      })
    })
    return () => {
      alive = false
    }
    // pairKey captures every coordinate/id change in `points`.
  }, [pairKey])

  return useMemo(
    () =>
      points.slice(1).map((b, i) => {
        const a = points[i]
        const r = routed[`${a.id}>${b.id}`]
        const choice = chooseLeg(a, b, {
          index: money.dest.index,
          tier: money.tier,
          pace: money.pace,
          travellers: money.travellers,
          walkMinutes: r?.foot?.minutes,
          walkKm: r?.foot?.km,
          driveMinutes: r?.car?.minutes,
          driveKm: r?.car?.km,
          rainy,
          night: isNight(b.start),
        })
        const geo = choice.best.mode === 'walk' ? (r?.foot ?? r?.car) : (r?.car ?? r?.foot)
        return {
          ...choice,
          fromId: a.id,
          toId: b.id,
          path: geo?.path ?? [
            [a.lat, a.lng],
            [b.lat, b.lng],
          ],
          isRouted: !!geo,
        }
      }),
    [points, routed, money, rainy],
  )
}
