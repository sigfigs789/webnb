import { describe, it, expect } from 'vitest'
import { FIXTURE_TABLES } from './fixtures'
import { analyzeProposal, bookingRange, compareRevenuePerNight, toDay } from '../shared/bookingAnalysis'
import { passThroughTaxOf, TAX_RATE } from '../shared/taxCalculation'
import { Booking } from '../shared/types'

// The fixture data is kept on purpose as a permanent playground. These tests
// pin what it is there to show, so a later change cannot quietly break it.

const bookings: Booking[] = FIXTURE_TABLES.bookings.map(row => ({
  id: row.id as string,
  name: row.name as string,
  revenue: row.revenue as number,
  passThroughTax: row.pass_through_tax as number,
  bookingDate: row.booking_date as string,
  startDate: row.start_date as string,
  endDate: row.end_date as string,
}))

// The analyzer's default stay
const proposal = { startDate: '2027-07-04', endDate: '2027-08-07', revenue: 6900 }

describe('fixture bookings', () => {
  it('are well-formed stays with unique ids', () => {
    expect(bookings.length).toBeGreaterThanOrEqual(10)
    expect(new Set(bookings.map(b => b.id)).size).toBe(bookings.length)
    for (const b of bookings) {
      expect(b.startDate < b.endDate).toBe(true)
      expect(b.bookingDate <= b.startDate).toBe(true)
      expect(b.revenue).toBeGreaterThan(0)
      expect(b.passThroughTax).toBeGreaterThanOrEqual(0)
    }
  })

  it('never overlap each other', () => {
    const ranges = bookings.map(bookingRange).sort((a, b) => a.start - b.start)
    for (let i = 1; i < ranges.length; i++) expect(ranges[i].start).toBeGreaterThanOrEqual(ranges[i - 1].end)
  })

  it('meet the 30-night minimum', () => {
    for (const b of bookings) {
      const range = bookingRange(b)
      expect(range.end - range.start).toBeGreaterThanOrEqual(30)
    }
  })

  it('span 2025 through 2027', () => {
    const years = new Set(bookings.map(b => b.startDate.slice(0, 4)))
    expect([...years].sort()).toEqual(['2025', '2026', '2027'])
  })

  it('mix entered and estimated pass-through tax', () => {
    const entered = bookings.filter(b => b.passThroughTax > 0)
    const missing = bookings.filter(b => b.passThroughTax === 0)
    expect(entered.length).toBeGreaterThan(0)
    expect(missing.length).toBeGreaterThan(0)
    expect(missing.every(b => passThroughTaxOf(b).estimated)).toBe(true)
  })

  it('record pass-through tax at the Oahu tax share of the payout', () => {
    for (const b of bookings.filter(b => b.passThroughTax > 0)) {
      const share = (b.revenue * TAX_RATE) / (1 + TAX_RATE)
      expect(Math.abs(b.passThroughTax - share)).toBeLessThan(1)
    }
  })
})

describe("fixture data against the analyzer's default stay", () => {
  it('has bookings on the same dates last year to compare with', () => {
    const comparison = compareRevenuePerNight(bookings, proposal)
    expect(comparison.sameDatesLastYear.bookedNights).toBe(34)
    expect(comparison.sameDatesLastYear.revenuePerNight).not.toBeNull()
    expect(comparison.lastYear?.year).toBe(2026)
    expect(comparison.allTime).not.toBeNull()
  })

  it('strands nights on both sides, ruling out two future stays', () => {
    const impact = analyzeProposal(
      bookings.map(bookingRange),
      [],
      { start: toDay(proposal.startDate), end: toDay(proposal.endDate) },
      { start: toDay('2027-01-01'), end: toDay('2028-01-01') },
      30
    )
    expect(impact.overlapsExisting).toBe(false)
    expect(impact.gapBefore).toBe(24)
    expect(impact.gapAfter).toBe(13)
    expect(impact.newlyStrandedNights).toBe(37)
    expect(impact.staysAdded).toBe(1)
    expect(impact.staysRuledOut).toBe(2)
    expect(impact.possibleStaysDelta).toBe(-1)
  })
})
