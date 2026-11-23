/**
 * Printable itinerary PDF (pdf-lib, pure JS: runs in Workers and in tests).
 * Cover block with trip facts, then one section per day with weather and a
 * time / place / cost table. Standard Helvetica only, so all text is mapped
 * to WinAnsi first (emoji and non-Latin scripts become "?").
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export type PdfStop = { date: string; start?: string; end?: string; title: string; address?: string; costPerPerson?: number }
export type PdfInput = {
  title: string
  destination: string
  startDate: string
  endDate: string
  members: string[]
  stops: PdfStop[]
  forecast?: Record<string, { min: number; max: number; desc: string }> | null
  generatedBy: string
}

const PAGE_W = 595 // A4 points
const PAGE_H = 842
const MARGIN = 48
const LINE = 15
const HONEY = rgb(0.85, 0.55, 0.12)
const INK = rgb(0.11, 0.09, 0.08)
const MUTED = rgb(0.45, 0.42, 0.4)
const COL_TIME = MARGIN
const COL_PLACE = MARGIN + 80
const COL_COST = PAGE_W - MARGIN - 60
const PLACE_WIDTH = COL_COST - COL_PLACE - 12
/** Characters outside Latin-1 that WinAnsi (Helvetica) can still draw. */
const WINANSI_EXTRA = new Set('–—‘’“”•…€™'.split(''))
const REPLACEMENTS: Record<string, string> = { '→': '->', '←': '<-', '×': 'x', '≈': '~' }

export function toWinAnsi(s: string): string {
  return [...s.normalize('NFKD').replace(/[̀-ͯ]/g, '')]
    .map((ch) => {
      if (REPLACEMENTS[ch]) return REPLACEMENTS[ch]
      const code = ch.codePointAt(0) ?? 0
      if (ch === '\n' || ch === '\t') return ' '
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.has(ch)) return ch
      return '?'
    })
    .join('')
}

/** Greedy word wrap to a width in points. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = toWinAnsi(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function fmtDay(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

type Fonts = { regular: PDFFont; bold: PDFFont }

/** Cursor over pages: adds a page when the next block would not fit. */
class Writer {
  page: PDFPage
  y = PAGE_H - MARGIN
  constructor(private doc: PDFDocument, private fonts: Fonts) {
    this.page = doc.addPage([PAGE_W, PAGE_H])
  }
  ensure(height: number) {
    if (this.y - height >= MARGIN + 20) return
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.y = PAGE_H - MARGIN
  }
  text(s: string, x: number, size: number, opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) {
    this.page.drawText(toWinAnsi(s), { x, y: this.y, size, font: opts.bold ? this.fonts.bold : this.fonts.regular, color: opts.color ?? INK })
  }
}

function drawCover(w: Writer, input: PdfInput, fonts: Fonts, total: number) {
  w.text('TRIPHIVE ITINERARY', MARGIN, 9, { bold: true, color: HONEY })
  w.y -= 30
  for (const line of wrap(input.title, fonts.bold, 24, PAGE_W - 2 * MARGIN)) {
    w.text(line, MARGIN, 24, { bold: true })
    w.y -= 28
  }
  w.text(`${input.destination}  ·  ${fmtDay(input.startDate)} – ${fmtDay(input.endDate)}`, MARGIN, 11, { color: MUTED })
  w.y -= LINE
  for (const line of wrap(`Travelers: ${input.members.join(', ') || '—'}`, fonts.regular, 11, PAGE_W - 2 * MARGIN)) {
    w.text(line, MARGIN, 11, { color: MUTED })
    w.y -= LINE
  }
  w.text(`Planned spend per person: ${money(total)}  ·  ${input.stops.length} stops`, MARGIN, 11, { color: MUTED })
  w.y -= 12
  w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: PAGE_W - MARGIN, y: w.y }, thickness: 1, color: HONEY })
  w.y -= 24
}

function drawDay(w: Writer, date: string, stops: PdfStop[], input: PdfInput, fonts: Fonts) {
  w.ensure(48)
  w.text(fmtDay(date), MARGIN, 14, { bold: true })
  const fc = input.forecast?.[date]
  if (fc) w.text(`${fc.min}–${fc.max}°C  ${fc.desc}`, COL_COST - 80, 10, { color: MUTED })
  w.y -= 20
  if (!stops.length) {
    w.text('Free day', COL_PLACE, 10, { color: MUTED })
    w.y -= LINE
  }
  for (const s of stops) {
    const title = wrap(s.title, fonts.bold, 10.5, PLACE_WIDTH)
    const addr = s.address ? wrap(s.address.split(',').slice(0, 2).join(','), fonts.regular, 9, PLACE_WIDTH) : []
    w.ensure((title.length + addr.length) * 13 + 6)
    w.text(s.start ? `${s.start}${s.end ? `–${s.end}` : ''}` : '—', COL_TIME, 10, { color: MUTED })
    if (s.costPerPerson) w.text(money(s.costPerPerson), COL_COST, 10)
    for (const line of title) {
      w.text(line, COL_PLACE, 10.5, { bold: true })
      w.y -= 13
    }
    for (const line of addr) {
      w.text(line, COL_PLACE, 9, { color: MUTED })
      w.y -= 12
    }
    w.y -= 6
  }
  w.y -= 10
}

function tripDates(start: string, end: string): string[] {
  const out: string[] = []
  const DAY_MS = 86_400_000
  const MAX_DAYS = 60
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`) && out.length < MAX_DAYS; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

export async function buildPlanPdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(toWinAnsi(input.title))
  doc.setProducer('TripHive')
  const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) }

  const sorted = [...input.stops].sort((a, b) => `${a.date} ${a.start ?? '99'}`.localeCompare(`${b.date} ${b.start ?? '99'}`))
  const total = sorted.reduce((sum, s) => sum + (s.costPerPerson ?? 0), 0)
  const w = new Writer(doc, fonts)
  drawCover(w, input, fonts, total)

  const dates = [...new Set([...tripDates(input.startDate, input.endDate), ...sorted.map((s) => s.date)])].sort()
  for (const d of dates) drawDay(w, d, sorted.filter((s) => s.date === d), input, fonts)

  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawText(toWinAnsi(`${input.title} · page ${i + 1} of ${pages.length} · made with TripHive by ${input.generatedBy}`), {
      x: MARGIN, y: MARGIN / 2, size: 8, font: fonts.regular, color: MUTED,
    })
  })
  return doc.save()
}
