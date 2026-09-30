import { describe, it, expect } from 'vitest'
import {
  analyzeProposal,
  compareRevenuePerNight,
  discountScenario,
  findGaps,
  fitStays,
  guestTotal,
  listingPriceFor,
  passThroughForRevenue,
  pocketAfterTaxes,
  shiftYears,
  specialOfferForTakeHome,
  takeHomeFromSpecialOffer,
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

  it('takes pass-through tax out of the history', () => {
    const taxed = history.map(b => ({ ...b, revenue: b.revenue * 1.2, passThroughTax: b.revenue * 0.2 }))
    const result = compareRevenuePerNight(taxed, { startDate: '2026-03-17', endDate: '2026-04-16', revenue: 7500 })
    expect(result.sameDatesLastYear.revenuePerNight).toBeCloseTo(250)
    expect(result.sameMonthsLastYear?.revenuePerNight).toBeCloseTo(250)
    expect(result.allTime?.revenuePerNight).toBeCloseTo(15200 / 61)
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

describe('fitStays', () => {
  it('packs stays back to back with no gap', () => {
    expect(fitStays(90, 30)).toBe(3)
    expect(fitStays(29, 30)).toBe(0)
  })

  it('needs turnover nights beside neighbours and between stays', () => {
    // 90 nights with a 2-night gap: 2 + 30 + 2 + 30 + 2 leaves 24, so only two fit
    expect(fitStays(90, 30, 2)).toBe(2)
    // 34 nights between two stays needs 2 + 30 + 2
    expect(fitStays(34, 30, 2)).toBe(1)
    expect(fitStays(33, 30, 2)).toBe(0)
  })

  it('skips the turnover on an open side', () => {
    expect(fitStays(32, 30, 2, false, true)).toBe(1)
    expect(fitStays(Infinity, 30, 3)).toBe(Infinity)
  })
})

describe('findGaps with a turnover gap', () => {
  const window = range('2026-01-01', '2027-01-01')

  it('strands a gap that only fits a stay back to back', () => {
    const stays = [range('2026-01-01', '2026-02-01'), range('2026-03-03', '2027-01-01')]
    // Feb 1 → Mar 3 is 30 nights
    expect(findGaps(stays, window, 30)[0]).toMatchObject({ nights: 30, stranded: false, maxStays: 1 })
    expect(findGaps(stays, window, 30, 1)[0]).toMatchObject({ nights: 30, stranded: true, maxStays: 0 })
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
    // The booking itself counts for you; it rules out room for two others
    expect(impact.staysAdded).toBe(1)
    expect(impact.staysRuledOut).toBe(2)
    expect(impact.overlapsExisting).toBe(false)
  })

  it('costs nothing when the booking sits flush against another stay', () => {
    const impact = analyzeProposal(stays, [], range('2026-03-01', '2026-04-01'), window, 30)
    expect(impact.gapBefore).toBe(0)
    expect(impact.gapAfter).toBe(30)
    expect(impact.newlyStrandedNights).toBe(0)
    expect(impact.possibleStaysDelta).toBe(0)
    expect(impact.staysAdded).toBe(1)
    expect(impact.staysRuledOut).toBe(1)
  })

  it('treats blocked dates as unavailable', () => {
    const impact = analyzeProposal(stays, [range('2026-04-01', '2026-05-01')], range('2026-03-01', '2026-04-01'), window, 30)
    expect(impact.before.maxAdditionalStays).toBe(1)
    expect(impact.after.maxAdditionalStays).toBe(0)
    expect(impact.possibleStaysDelta).toBe(0)
  })

  it('fits fewer future stays as the gap between bookings grows', () => {
    const proposal = range('2026-03-01', '2026-04-01')
    // After the proposal, Apr 1 → May 1 is 30 open nights
    expect(analyzeProposal(stays, [], proposal, window, 30, 0).after.maxAdditionalStays).toBe(1)
    const withGap = analyzeProposal(stays, [], proposal, window, 30, 3)
    expect(withGap.after.maxAdditionalStays).toBe(0)
    expect(withGap.newlyStrandedNights).toBe(30)
    // Before: Mar 1 → May 1 is 61 nights, which fits 3 + 30 + 3 but not two stays
    expect(withGap.before.maxAdditionalStays).toBe(1)
    expect(withGap.possibleStaysDelta).toBe(0)
  })

  it('flags an overlap with an existing stay', () => {
    expect(analyzeProposal(stays, [], range('2026-02-15', '2026-03-20'), window, 30).overlapsExisting).toBe(true)
  })
})

describe('pocketAfterTaxes', () => {
  it('adds the pass-through tax to the payout and remits it in full', () => {
    const result = pocketAfterTaxes(9000, 1000, 30)
    expect(result.payout).toBeCloseTo(10000)
    expect(result.taxes).toBeCloseTo(1000)
    expect(result.pocket).toBeCloseTo(9000)
    // Take-home carries no tax, so the nightly rate is just take-home / nights
    expect(result.revenuePerNight).toBeCloseTo(300)
  })
})

describe('discountScenario', () => {
  it('takes the discount off the listing price, fee and tax alike', () => {
    // $5,000 take-home at a 20% host fee is a $6,250 listing; 18% tax on it is $1,125
    const result = discountScenario(5000, 1125, 30, 0.1, 0.2)
    expect(result.discounted.revenue).toBeCloseTo(4500)
    expect(result.discounted.passThroughTax).toBeCloseTo(1012.5)
    expect(result.baseGuestTotal).toBeCloseTo(7375)
    expect(result.guestSavings).toBeCloseTo(737.5)
    expect(result.pocketLoss).toBeCloseTo(500)
    expect(result.discounted.revenuePerNight).toBeCloseTo(150)
    // $500 lost at $150 / night
    expect(result.breakEvenNights).toBeCloseTo(500 / 150)
  })
})

describe('passThroughForRevenue', () => {
  it('charges the tax on the listing price, host fee included', () => {
    expect(listingPriceFor(5000, 0.2)).toBeCloseTo(6250)
    expect(passThroughForRevenue(5000, 0.18, 0.2)).toBeCloseTo(1125)
    expect(guestTotal(5000, 1125, 0.2)).toBeCloseTo(7375)
  })

  it('matches the taxes of a special offer', () => {
    const offer = takeHomeFromSpecialOffer(9381)
    expect(passThroughForRevenue(offer.takeHome)).toBeCloseTo(offer.taxes)
  })
})

describe('takeHomeFromSpecialOffer', () => {
  it('matches a real booking: $9,381 paid leaves $6,901.96 take-home', () => {
    const offer = takeHomeFromSpecialOffer(9381)
    expect(offer.listingPrice).toBeCloseTo(9381 / (1 + TAX_RATE))
    expect(offer.takeHome).toBeCloseTo(6901.96, 2)
    expect(offer.listingPrice + offer.taxes).toBeCloseTo(9381)
    expect(offer.takeHome + offer.hostFee).toBeCloseTo(offer.listingPrice)
    expect(offer.payout).toBeCloseTo(offer.takeHome + offer.taxes)
  })

  it('round-trips through specialOfferForTakeHome', () => {
    expect(specialOfferForTakeHome(6901.96).specialOfferPrice).toBeCloseTo(9381, 0)
  })
})
