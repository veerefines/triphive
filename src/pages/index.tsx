/**
 * Landing page — static (no DeepSpace providers), prerendered for crawlers.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const STEPS = [
  { n: '01', title: 'Start a trip', body: 'Name it, pick a city and dates. TripHive pulls the map and 5-day forecast.' },
  { n: '02', title: 'Bring the group', body: 'Share a 6-character code. Everyone edits one live itinerary, with presence.' },
  { n: '03', title: 'Ask Hive', body: '“Plan day 1”, “fix the conflicts”. Hive researches real places and proposes.' },
  { n: '04', title: 'Vote, then go', body: 'Majority wins. Email the final plan; a morning check warns you about rain.' },
]

const DOCTOR = [
  ['⏱️', 'Overlapping stops'],
  ['🚶', 'Travel gaps too short'],
  ['🍜', 'Missed lunch or dinner'],
  ['🌧️', 'Rain on outdoor stops'],
  ['💸', 'Over the tightest budget'],
  ['🐢', 'Too packed for the slowest pace'],
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen overflow-x-hidden bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
            <span className="font-display text-xl font-bold">🐝 TripHive</span>
            <nav className="flex items-center gap-1 text-sm">
              <a href="#how" className="hidden rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
                How it works
              </a>
              <a href="#hive-checks" className="hidden rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
                Hive checks
              </a>
              <Link to="/trips" className="ml-2 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:opacity-90">
                Sign in
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="relative">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[var(--color-honey-soft)] opacity-70 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              maskImage: 'radial-gradient(ellipse at 50% 30%, black 20%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, black 20%, transparent 70%)',
            }}
          />
          <div className="relative mx-auto max-w-6xl px-6 pb-14 pt-14 text-center sm:pt-24">
            <p className="anim-in mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--color-honey)] opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--color-honey)]" />
              </span>
              Group trip planning<span className="hidden sm:inline">, minus the group-chat chaos</span>
            </p>
            <h1
              className="anim-in font-display mx-auto mt-6 max-w-4xl text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl"
              style={{ animationDelay: '60ms' }}
            >
              Plan the trip <span className="italic text-honey">together</span>.
              <br className="hidden sm:block" /> Let Hive keep it realistic.
            </h1>
            <p className="anim-in mx-auto mt-6 max-w-xl text-lg text-muted-foreground" style={{ animationDelay: '120ms' }}>
              A shared, real-time itinerary for friends — with an AI planner that finds places, spots conflicts, and
              suggests changes the whole group votes on.
            </p>
            <div className="anim-in mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: '180ms' }}>
              <Link
                to="/trips"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_rgba(28,24,20,0.6)] transition hover:-translate-y-0.5"
              >
                Start a trip — it’s free
              </Link>
              <Link
                to="/trips"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:bg-accent"
              >
                I have an invite code
              </Link>
            </div>
          </div>

          {/* Product shot with floating callouts */}
          <div className="relative mx-auto max-w-6xl px-6 pb-20">
            <div
              className="anim-in relative overflow-hidden rounded-[28px] border border-border bg-card p-2 shadow-[0_40px_100px_-30px_rgba(60,40,10,0.45)]"
              style={{ animationDelay: '240ms' }}
            >
              <img
                src="/product.jpg"
                alt="TripHive trip page: a day-by-day itinerary with travel times, a route map, and Hive's planning panel"
                width={1440}
                height={900}
                className="w-full rounded-[22px]"
              />
            </div>
            <Callout className="-left-2 top-[18%] sm:left-0 lg:-left-6" delay={420}>
              <span className="text-base">🩺</span>
              <span>
                <b>Hive</b> · Castelo overlaps lunch by 30 min
              </span>
            </Callout>
            <Callout className="-right-2 top-[46%] sm:right-0 lg:-right-6" delay={560}>
              <span className="text-base">🗳️</span>
              <span>
                <b>Sam</b> voted 👍 · “Move Belém to 10:00” · 2/3
              </span>
            </Callout>
            <Callout className="bottom-12 left-[10%]" delay={700}>
              <span className="text-base">🐝</span>
              <span>
                <b>Hive</b> found 3 places near Alfama · ★ 4.6
              </span>
            </Callout>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-20">
          <SectionHead eyebrow="How it works" title="From group chat to a plan everyone trusts" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="card-lift rounded-3xl border border-border bg-card p-6">
                <p className="font-mono text-xs text-honey">{s.n}</p>
                <h3 className="font-display mt-3 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bento */}
        <section id="hive-checks" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-24">
          <SectionHead eyebrow="Why it works" title="Humans decide. Hive does the homework." />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-border bg-card p-7 lg:col-span-2">
              <p className="text-2xl">🩺</p>
              <h3 className="font-display mt-3 text-2xl font-semibold">Hive catches clashes on every edit</h3>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Deterministic checks — not an LLM guess — run against everyone’s pace, budget, wake-up time and the
                live forecast.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {DOCTOR.map(([e, t]) => (
                  <div key={t} className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
                    <span>{e}</span>
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col rounded-3xl bg-foreground p-7 text-background">
              <p className="text-2xl">🗳️</p>
              <h3 className="font-display mt-3 text-2xl font-semibold">The group votes</h3>
              <p className="mt-2 text-sm text-background/65">
                Hive never edits your plan. Every suggestion is a card with reasons and sources. Majority wins.
              </p>
              <div className="mt-auto space-y-2 pt-6">
                <div className="rounded-2xl bg-background/10 p-4">
                  <p className="text-sm font-semibold">Add Time Out Market · 13:00</p>
                  <p className="mt-0.5 text-xs text-background/60">Lunch gap on day 2 · fits Ana’s vegetarian pref</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/15">
                    <div className="h-full w-2/3 rounded-full bg-[var(--color-honey)]" />
                  </div>
                  <p className="mt-1.5 font-mono text-[10.5px] text-background/60">👍 Ana, Sam · 2 of 3</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-7">
              <p className="text-2xl">⚡</p>
              <h3 className="font-display mt-3 text-xl font-semibold">Live, together</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                One board, instant sync, and “Ana is editing…” so nobody overwrites anyone.
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-7">
              <p className="text-2xl">🗺️</p>
              <h3 className="font-display mt-3 text-xl font-semibold">Routes & ratings</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                A map per day, walking or transit time between stops, and one-tap Google Maps directions.
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-[var(--color-honey-soft)] p-7">
              <p className="text-2xl">🌦️</p>
              <h3 className="font-display mt-3 text-xl font-semibold">Weather watch</h3>
              <p className="mt-2 text-sm text-foreground/70">
                Every morning we refresh the forecast and email the group if rain hits an outdoor stop.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="relative overflow-hidden rounded-[32px] bg-foreground px-8 py-14 text-center text-background sm:py-20">
            <div className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-[var(--color-honey)] opacity-30 blur-3xl" />
            <h2 className="font-display relative mx-auto max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
              Your next trip, <span className="italic text-honey">without</span> the 200-message thread.
            </h2>
            <Link
              to="/trips"
              className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:-translate-y-0.5"
            >
              Start planning →
            </Link>
          </div>
        </section>

        <footer className="border-t border-border py-6 text-center font-mono text-[11px] text-muted-foreground">
          Built on DeepSpace · Maps © OpenStreetMap contributors
        </footer>
      </div>
    </>
  )
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-honey">{eyebrow}</p>
      <h2 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
    </div>
  )
}

function Callout({ className = '', delay, children }: { className?: string; delay: number; children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute flex items-center max-sm:hidden gap-2 rounded-2xl border border-border bg-card/95 px-3.5 py-2.5 text-xs shadow-[0_18px_40px_-16px_rgba(60,40,10,0.45)] backdrop-blur ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
