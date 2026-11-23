import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildPlanPdf, toWinAnsi, type PdfInput } from './planPdf'

function input(overrides: Partial<PdfInput> = {}): PdfInput {
  return {
    title: 'Lisbon long weekend',
    destination: 'Lisbon, Portugal',
    startDate: '2026-12-11',
    endDate: '2026-12-13',
    members: ['Owner', 'Marco Rossi'],
    stops: [
      { date: '2026-12-11', start: '09:00', end: '10:30', title: 'Pastéis de Belém', address: 'R. de Belém 84, Lisboa, Portugal', costPerPerson: 6 },
      { date: '2026-12-12', start: '19:00', end: '21:00', title: 'Time Out Market 🍷', costPerPerson: 25 },
    ],
    forecast: { '2026-12-11': { min: 11, max: 16, desc: 'Sunny' } },
    generatedBy: 'Owner',
    ...overrides,
  }
}

describe('toWinAnsi', () => {
  it('keeps Latin-1 and typographic punctuation, folds accents, replaces emoji and arrows', () => {
    expect(toWinAnsi('Café – “ok” 12°C')).toBe('Cafe – “ok” 12°C')
    expect(toWinAnsi('A → B 🍷')).toBe('A -> B ?')
    expect(toWinAnsi('東京')).toBe('??')
  })
})

describe('buildPlanPdf', () => {
  it('produces a parseable PDF titled after the trip', async () => {
    const bytes = await buildPlanPdf(input())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getTitle()).toBe('Lisbon long weekend')
    expect(doc.getPageCount()).toBe(1)
  })

  it('paginates long itineraries instead of drawing off the page', async () => {
    const stops = Array.from({ length: 120 }, (_, i) => ({ date: '2026-12-11', start: '10:00', title: `Stop number ${i} with a fairly long descriptive name`, address: 'Somewhere, Lisbon' }))
    const doc = await PDFDocument.load(await buildPlanPdf(input({ stops })))
    expect(doc.getPageCount()).toBeGreaterThan(3)
  })

  it('handles an empty trip with non-Latin title', async () => {
    const doc = await PDFDocument.load(await buildPlanPdf(input({ title: '東京 food crawl', stops: [], members: [] })))
    expect(doc.getPageCount()).toBe(1)
  })
})
