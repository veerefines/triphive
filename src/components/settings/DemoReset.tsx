/**
 * Owner-only "Demo data" card on /settings. Wipes every trip and social row,
 * then seeds the demo world (src/data/demo.ts). Irreversible, so it needs the
 * literal word WIPE typed in; the server re-checks owner + confirm.
 */
import { useEffect, useState } from 'react'
import { Button, Input, useToast } from '@/components/ui'
import { callAction } from '@/lib/api'

const CONFIRM_WORD = 'WIPE'
const MAX_WIPE_CALLS = 50

type ResetResult = { done: boolean; remainingTrips: number; seeded?: Record<string, number> }

async function runReset(onProgress: (msg: string) => void): Promise<ResetResult> {
  for (let i = 0; i < MAX_WIPE_CALLS; i++) {
    const r = await callAction<ResetResult>('resetDemo', { confirm: CONFIRM_WORD, phase: 'wipe' })
    if (r.done) break
    onProgress(`Wiping… ${r.remainingTrips} trips left`)
  }
  onProgress('Seeding demo world…')
  return callAction<ResetResult>('resetDemo', { confirm: CONFIRM_WORD, phase: 'seed' })
}

export function DemoReset() {
  const [isOwner, setIsOwner] = useState(false)
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let alive = true
    callAction<{ isOwner: boolean }>('isAppOwner', {})
      .then((r) => alive && setIsOwner(r.isOwner))
      .catch(() => alive && setIsOwner(false))
    return () => {
      alive = false
    }
  }, [])

  if (!isOwner) return null

  async function handleReset() {
    setIsBusy(true)
    setStatus('Wiping…')
    try {
      const r = await runReset(setStatus)
      const s = r.seeded ?? {}
      setStatus(`Done: ${s.trips ?? 0} trips, ${s.stops ?? 0} stops, ${s.reviews ?? 0} reviews, ${s.requests ?? 0} requests.`)
      toast.success('Demo reset', 'Fresh demo world is ready.')
      setTyped('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reset failed'
      setStatus(msg)
      toast.error('Demo reset failed', msg)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section data-testid="demo-reset" className="mt-8 rounded-lg border border-destructive/40 bg-card p-6">
      <h2 className="mb-1 text-lg font-semibold">Demo data</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Deletes <b>every</b> trip, chat, request and review in the app, then seeds Lisbon, Meghalaya, Tokyo and Barcelona with
        three demo travelers. This cannot be undone. Type {CONFIRM_WORD} to enable.
      </p>
      <div className="flex gap-2">
        <Input
          aria-label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={CONFIRM_WORD}
          disabled={isBusy}
          className="max-w-40"
        />
        <Button variant="destructive" disabled={typed !== CONFIRM_WORD || isBusy} onClick={handleReset}>
          {isBusy ? 'Resetting…' : 'Reset demo'}
        </Button>
      </div>
      {status && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {status}
        </p>
      )}
    </section>
  )
}
