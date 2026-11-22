/**
 * Landing page — static (no DeepSpace providers), prerendered for crawlers.
 */
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const FEATURES = [
  {
    emoji: '🗓️',
    title: 'One live itinerary',
    body: 'Everyone edits the same day-by-day board. Changes, cursors and “Ana is editing…” show up instantly.',
  },
  {
    emoji: '🩺',
    title: 'Plan Doctor',
    body: 'Catches overlaps, impossible travel gaps, missed meals, rainy outdoor days, budget and pace clashes.',
  },
  {
    emoji: '🐝',
    title: 'Hive, your trip agent',
    body: 'Researches real places, checks weather and routes, and proposes fixes that respect everyone’s style.',
  },
  {
    emoji: '🗳️',
    title: 'The group decides',
    body: 'Hive never edits your plan. Every suggestion is a card the group votes on; majority wins.',
  },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="font-display text-xl font-bold">🐝 TripHive</span>
          <Link to="/trips" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </header>

        <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-20">
          <p className="mb-4 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Group trip planning, minus the group-chat chaos
          </p>
          <h1 className="font-display max-w-3xl text-5xl font-bold leading-[1.05] sm:text-6xl">
            Plan the trip <span className="text-honey italic">together</span>. Let Hive keep it realistic.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            A shared, real-time itinerary for friends — with an AI planner that finds places, spots conflicts,
            and suggests changes the whole group votes on.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/trips"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              Start a trip
            </Link>
            <Link
              to="/trips"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:bg-accent"
            >
              I have an invite code
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="overflow-hidden rounded-[28px] border border-border bg-card p-2 shadow-[0_30px_80px_-30px_rgba(60,40,10,0.35)]">
            <img
              src="/product.jpg"
              alt="TripHive trip page: a day-by-day itinerary with travel times, a route map, and Hive's planning panel"
              width={1440}
              height={900}
              className="w-full rounded-[22px]"
            />
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 text-2xl">{f.emoji}</div>
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          Built on DeepSpace · Maps © OpenStreetMap contributors
        </footer>
      </div>
    </>
  )
}
