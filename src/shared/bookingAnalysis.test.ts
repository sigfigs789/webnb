import { describe, it, expect } from 'vitest'
import {
  analyzeProposal,
  compareRevenuePerNight,
  discountScenario,
  findGaps,
  pocketAfterTaxes,
  shiftYears,
  specialOfferFromTotal,
  toDay,
  windowRevenue,
  NightRange,
} from './bookingAnalysis'
import { TAX_RATE } from './taxCalculation'
import { Booking } from './types'

function booking(id: string, startDate: string, endDate: string, revenue: number): Booking {
  return { id, name: `Booking ${id}`, revenue, passThroughTax: 0, bookingDate: startDate, startDate, endDate }
}

function range(start: string, end: string): NightRange {
  return { start: toDay(start), end: toDay(end) }
}

describe('shiftYears', () => {
  it('moves a date back one year', () => {
    expect(shiftYears('2026-03-15', -1)).toBe('2025-03-15')
  })

  it('falls back to Feb 28 from a leap day', () => {
    expect(shiftYears('2028-02-29', -1)).toBe('2027-02-28')
  })
})

describe('windowRevenue', () => {
  it('counts only the overlapping share of a booking', () => {
    const stats = windowRevenue([booking('1', '2025-01-01', '2025-01-11', 1000)], range('2025-01-06', '2025-01-20'))
    expect(stats.bookedNights).toBe(5)
    expect(stats.revenue).toBeCloseTo(500)
    expect(stats.revenuePerNight).toBeCloseTo(100)
    expect(stats.totalNights).toBe(14)
  })

  it('reports no rate when nothing was booked', () => {
    expect(windowRevenue([], range('2025-01-01', '2025-02-01')).revenuePerNight).toBeNull()
  })
})

describe('compareRevenuePerNight', () => {
  const history = [
    booking('a', '2025-03-01', '2025-04-01', 6200), // $200/night in March
    booking('b', '2025-04-01', '2025-05-01', 9000), // $300/night in April
  ]

  it('compares against the same dates and months last year', () => {
    const result = compareRevenuePerNight(history, { startDate: '2026-03-17', endDate: '2026-04-16', revenue: 7500 })
    expect(result.proposedRevenuePerNight).toBeCloseTo(250)
    // 15 March nights at 200 and 15 April nights at 300
    expect(result.sameDatesLastYear.revenuePerNight).toBeCloseTo(250)
    expect(result.sameMonthsLastYear?.revenuePerNight).toBeCloseTo(250)
    expect(result.lastYear).toMatchObject({ year: 2025, nights: 61 })
    expect(result.allTime?.nights).toBe(61)
  })

  it('leaves the comparisons empty without history', () => {
    const result = compareRevenuePerNight([], { startDate: '2026-03-01', endDate: '2026-04-01', revenue: 6200 })
    expect(result.sameMonthsLastYear).toBeNull()
    expect(result.lastYear).toBeNull()
    expect(result.allTime).toBeNull()
  })
})

describe('findGaps', () => {
  const window = range('2026-01-01', '2027-01-01')

  it('flags gaps shorter than the minimum stay as stranded', () => {
    const gaps = findGaps([range('2026-01-01', '2026-02-01'), range('2026-02-20', '2026-12-01')], window, 30)
    expect(gaps[0]).toMatchObject({ nights: 19, stranded: true, maxStays: 0 })
  })

  it('does not strand a short in-window gap that keeps going past the window', () => {
    const gaps = findGaps([range('2026-01-01', '2026-12-20')], window, 30)
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ nights: Infinity, nightsInWindow: 12, stranded: false, maxStays: 1 })
  })

  it('fits as many minimum-length stays as the gap allows', () => {
    const gaps = findGaps([range('2026-04-01', '2027-01-01')], window, 30)
    // Jan 1 → Apr 1 is 90 nights: three 30-night stays
    expect(gaps[0]).toMatchObject({ nights: 90, maxStays: 3 })
  })
})

describe('analyzeProposal', () => {
  const window = range('2026-01-01', '2027-01-01')
  const stays = [range('2026-01-01', '2026-03-01'), range('2026-05-01', '2027-01-01')]
  // March + April is a 61-night gap: room for two 30-night stays

  it('spots a booking that strands nights and costs a future stay', () => {
    const impact = analyzeProposal(stays, [], range('2026-03-15', '2026-04-20'), window, 30)
    expect(impact.gapBefore).toBe(14)
    expect(impact.gapAfter).toBe(11)
    expect(impact.newlyStrandedNights).toBe(25)
    expect(impact.before.totalPossibleStays).toBe(4)
    expect(impact.after.totalPossibleStays).toBe(3)
    expect(impact.possibleStaysDelta).toBe(-1)
    expect(impact.overlapsExisting).toBe(false)
  })

  it('costs nothing when the booking sits flush against another stay', () => {
    const impact = analyzeProposal(stays, [], range('2026-03-01', '2026-04-01'), window, 30)
    expect(impact.gapBefore).toBe(0)
    expect(impact.gapAfter).toBe(30)
    expect(impact.newlyStrandedNights).toBe(0)
    expect(impact.possibleStaysDelta).toBe(0)
  })

  it('treats blocked dates as unavailable', () => {
    const impact = analyzeProposal(stays, [range('2026-04-01', '2026-05-01')], range('2026-03-01', '2026-04-01'), window, 30)
    expect(impact.before.maxAdditionalStays).toBe(1)
    expect(impact.after.maxAdditionalStays).toBe(0)
    expect(impact.possibleStaysDelta).toBe(0)
  })

  it('flags an overlap with an existing stay', () => {
    expect(analyzeProposal(stays, [], range('2026-02-15', '2026-03-20'), window, 30).overlapsExisting).toBe(true)
  })
})

describe('pocketAfterTaxes', () => {
  it('taxes revenue net of pass-through tax', () => {
    const result = pocketAfterTaxes(10000, 1000, 30)
    expect(result.taxes).toBeCloseTo(9000 * TAX_RATE)
    expect(result.pocket).toBeCloseTo(10000 - 9000 * TAX_RATE)
    expect(result.revenuePerNight).toBeCloseTo(333.33, 2)
  })
})

describe('discountScenario', () => {
  it('reports the discount as money out of pocket after taxes', () => {
    const result = discountScenario(10000, 0, 30, 0.1)
    expect(result.guestSavings).toBeCloseTo(1000)
    expect(result.pocketLoss).toBeCloseTo(1000 * (1 - TAX_RATE))
    expect(result.discounted.revenuePerNight).toBeCloseTo(300)
    // Loss divided by the discounted pocket per night: 3 nights at 30 nights × 10%
    expect(result.breakEvenNights).toBeCloseTo(30 / 9)
  })
})

describe('specialOfferFromTotal', () => {
  it('backs the fee and taxes out of the all-inclusive total', () => {
    const offer = specialOfferFromTotal(5700, 0.13, 0.18, 0.03)
    expect(offer.offer).toBeCloseTo(5700 / 1.31)
    expect(offer.offer + offer.serviceFee + offer.taxes).toBeCloseTo(5700)
    expect(offer.hostPayout).toBeCloseTo(offer.offer * 0.97)
  })

  it('defaults to the Oahu tax rate', () => {
    expect(specialOfferFromTotal(5700).offer).toBeCloseTo(5700 / (1 + 0.13 + TAX_RATE))
  })
})
