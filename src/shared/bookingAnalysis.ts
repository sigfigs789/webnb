import { TAX_RATE } from './taxCalculation'
import { monthlyRevenuePerNight, yearlyRevenuePerNight } from './revenuePerNight'
import { Booking } from './types'

const DAY_MS = 1000 * 60 * 60 * 24

/**
 * Airbnb's guest service fee under the split-fee model. It varies by stay and
 * tends to shrink on longer ones, so this is only a default for 30+ night bookings.
 */
export const AIRBNB_GUEST_FEE_RATE = 0.13

/** The host side of Airbnb's split fee, taken out of the payout. */
export const AIRBNB_HOST_FEE_RATE = 0.03

/** Days since the epoch, so date ranges can be compared as plain integers. */
export function toDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

export function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

/** The same calendar date `years` away, with Feb 29 falling back to Feb 28. */
export function shiftYears(date: string, years: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate()
  return `${year + years}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

/** A half-open range of nights: `start` is the first night, `end` the check-out day. */
export interface NightRange {
  start: number
  end: number
}

export function nightsOf(range: NightRange): number {
  return Math.max(0, range.end - range.start)
}

function overlap(a: NightRange, b: NightRange): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
}

export function bookingRange(booking: Pick<Booking, 'startDate' | 'endDate'>): NightRange {
  return { start: toDay(booking.startDate), end: toDay(booking.endDate) }
}

// ── Revenue per night comparison ─────────────────────

export interface WindowRevenue {
  revenue: number
  bookedNights: number
  totalNights: number
  revenuePerNight: number | null
}

/**
 * Revenue earned inside a date window, with each booking's revenue spread
 * evenly over its nights so partial overlaps count proportionally.
 */
export function windowRevenue(bookings: Booking[], window: NightRange): WindowRevenue {
  let revenue = 0
  let bookedNights = 0
  for (const booking of bookings) {
    const range = bookingRange(booking)
    const nights = nightsOf(range)
    if (nights <= 0) continue
    const shared = overlap(range, window)
    if (shared === 0) continue
    revenue += (booking.revenue / nights) * shared
    bookedNights += shared
  }
  return {
    revenue,
    bookedNights,
    totalNights: nightsOf(window),
    revenuePerNight: bookedNights > 0 ? revenue / bookedNights : null,
  }
}

export interface RevenueComparison {
  proposedRevenuePerNight: number
  /** The exact same dates one year earlier. */
  sameDatesLastYear: WindowRevenue
  /** Last year's monthly rates, weighted by how many proposed nights fall in each month. */
  sameMonthsLastYear: { revenuePerNight: number; coveredNights: number } | null
  /** The whole calendar year before the check-in year. */
  lastYear: { year: number; revenuePerNight: number; nights: number } | null
  allTime: { revenuePerNight: number; nights: number } | null
}

function nightsByMonth(range: NightRange): Map<string, number> {
  const result = new Map<string, number>()
  for (let day = range.start; day < range.end; day++) {
    const key = fromDay(day).slice(0, 7)
    result.set(key, (result.get(key) ?? 0) + 1)
  }
  return result
}

export function compareRevenuePerNight(
  bookings: Booking[],
  proposal: { startDate: string; endDate: string; revenue: number }
): RevenueComparison {
  const range = bookingRange(proposal)
  const nights = nightsOf(range)
  const checkInYear = Number(proposal.startDate.slice(0, 4))

  const sameDatesLastYear = windowRevenue(bookings, {
    start: toDay(shiftYears(proposal.startDate, -1)),
    end: toDay(shiftYears(proposal.endDate, -1)),
  })

  const monthly = new Map(monthlyRevenuePerNight(bookings).map(point => [point.key, point.revenuePerNight]))
  let weighted = 0
  let coveredNights = 0
  for (const [key, count] of nightsByMonth(range)) {
    const [year, month] = key.split('-')
    const rate = monthly.get(`${Number(year) - 1}-${month}`)
    if (rate === undefined) continue
    weighted += rate * count
    coveredNights += count
  }

  const yearly = yearlyRevenuePerNight(bookings)
  const previous = yearly.find(point => point.year === checkInYear - 1)
  const allRevenue = yearly.reduce((sum, point) => sum + point.revenue, 0)
  const allNights = yearly.reduce((sum, point) => sum + point.nights, 0)

  return {
    proposedRevenuePerNight: nights > 0 ? proposal.revenue / nights : 0,
    sameDatesLastYear,
    sameMonthsLastYear: coveredNights > 0 ? { revenuePerNight: weighted / coveredNights, coveredNights } : null,
    lastYear: previous
      ? { year: previous.year, revenuePerNight: previous.revenuePerNight, nights: previous.nights }
      : null,
    allTime: allNights > 0 ? { revenuePerNight: allRevenue / allNights, nights: allNights } : null,
  }
}

// ── Calendar capacity and stranded nights ────────────

export interface Gap extends NightRange {
  /** Full length of the gap, Infinity when nothing is booked after it. */
  nights: number
  /** Nights of the gap that fall inside the analysis window. */
  nightsInWindow: number
  /** Too short to ever hold a minimum-length stay. */
  stranded: boolean
  /** How many minimum-length stays can start in the window and still fit. */
  maxStays: number
}

export interface CalendarCapacity {
  /** Existing stays that touch the window. */
  bookedStays: number
  bookedNights: number
  openNights: number
  bookableNights: number
  strandedNights: number
  maxAdditionalStays: number
  totalPossibleStays: number
  gaps: Gap[]
}

function mergeRanges(ranges: NightRange[]): NightRange[] {
  const sorted = ranges.filter(r => r.end > r.start).sort((a, b) => a.start - b.start)
  const merged: NightRange[] = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

/**
 * Open gaps between occupied ranges from the window start onward. Nights before
 * the window start are treated as unbookable (e.g. already in the past), so a
 * gap is measured from there; a gap running past the window end keeps its full
 * length so it is not mistaken for a stranded one.
 */
export function findGaps(occupied: NightRange[], window: NightRange, minNights: number): Gap[] {
  const gaps: Gap[] = []
  let cursor = window.start

  const push = (start: number, end: number) => {
    if (start >= window.end || end <= start) return
    const nights = end - start
    const nightsInWindow = Math.min(end, window.end) - start
    const stranded = nights < minNights
    const maxStays = stranded ? 0 : Math.min(Math.ceil(nightsInWindow / minNights), Math.floor(nights / minNights))
    gaps.push({ start, end, nights, nightsInWindow, stranded, maxStays })
  }

  for (const range of mergeRanges(occupied)) {
    if (range.end <= cursor) continue
    if (range.start > cursor) push(cursor, range.start)
    cursor = Math.max(cursor, range.end)
  }
  push(cursor, Infinity)
  return gaps
}

export function calendarCapacity(
  stays: NightRange[],
  blocked: NightRange[],
  window: NightRange,
  minNights: number
): CalendarCapacity {
  const gaps = findGaps([...stays, ...blocked], window, minNights)
  const inWindow = stays.filter(stay => overlap(stay, window) > 0)
  const bookedStays = inWindow.length
  const bookedNights = inWindow.reduce((sum, stay) => sum + overlap(stay, window), 0)
  const openNights = gaps.reduce((sum, gap) => sum + gap.nightsInWindow, 0)
  const strandedNights = gaps.filter(gap => gap.stranded).reduce((sum, gap) => sum + gap.nightsInWindow, 0)
  const maxAdditionalStays = gaps.reduce((sum, gap) => sum + gap.maxStays, 0)
  return {
    bookedStays,
    bookedNights,
    openNights,
    bookableNights: openNights - strandedNights,
    strandedNights,
    maxAdditionalStays,
    totalPossibleStays: bookedStays + maxAdditionalStays,
    gaps,
  }
}

export interface ProposalImpact {
  before: CalendarCapacity
  after: CalendarCapacity
  /** Open nights left between the previous stay/block and check-in (null when nothing precedes it). */
  gapBefore: number | null
  /** Open nights left between check-out and the next stay/block (null when nothing follows it). */
  gapAfter: number | null
  overlapsExisting: boolean
  /** Change in the maximum number of stays the window can hold. */
  possibleStaysDelta: number
  /** Nights that become stranded because of this booking. */
  newlyStrandedNights: number
}

export function analyzeProposal(
  stays: NightRange[],
  blocked: NightRange[],
  proposal: NightRange,
  window: NightRange,
  minNights: number
): ProposalImpact {
  const occupied = mergeRanges([...stays, ...blocked])
  const before = calendarCapacity(stays, blocked, window, minNights)
  const after = calendarCapacity([...stays, proposal], blocked, window, minNights)

  const previous = occupied.filter(r => r.end <= proposal.start).pop()
  const next = occupied.find(r => r.start >= proposal.end)

  return {
    before,
    after,
    gapBefore: previous ? proposal.start - previous.end : null,
    gapAfter: next ? next.start - proposal.end : null,
    overlapsExisting: occupied.some(r => overlap(r, proposal) > 0),
    possibleStaysDelta: after.totalPossibleStays - before.totalPossibleStays,
    newlyStrandedNights: after.strandedNights - before.strandedNights,
  }
}

// ── Money in pocket and discounts ────────────────────

export interface PocketBreakdown {
  revenue: number
  passThroughTax: number
  taxes: number
  pocket: number
  revenuePerNight: number
  pocketPerNight: number
}

/** Same tax treatment as the Performance tab: GET + TAT on revenue net of pass-through tax. */
export function pocketAfterTaxes(revenue: number, passThroughTax: number, nights: number): PocketBreakdown {
  const taxes = Math.max(0, revenue - passThroughTax) * TAX_RATE
  const pocket = revenue - taxes
  return {
    revenue,
    passThroughTax,
    taxes,
    pocket,
    revenuePerNight: nights > 0 ? revenue / nights : 0,
    pocketPerNight: nights > 0 ? pocket / nights : 0,
  }
}

/**
 * The special offer price behind an Airbnb payout. Airbnb pays out the offer
 * less its host fee plus the taxes it collected, and the taxes are recorded as
 * pass-through tax, so the offer is what is left once they come back out.
 */
export function offerFromPayout(revenue: number, passThroughTax: number, hostFeeRate = AIRBNB_HOST_FEE_RATE): number {
  return Math.max(0, revenue - passThroughTax) / (1 - hostFeeRate)
}

/**
 * The pass-through tax inside a payout. The payout is offer × (1 − host fee)
 * plus offer × tax, so the tax is that payout's share: tax / (1 − host fee + tax).
 */
export function passThroughFromPayout(
  revenue: number,
  taxRate = TAX_RATE,
  hostFeeRate = AIRBNB_HOST_FEE_RATE
): number {
  const share = 1 - hostFeeRate + taxRate
  return share > 0 ? (revenue * taxRate) / share : 0
}

/** What the guest pays all-in for a payout: offer + guest service fee + the pass-through taxes. */
export function guestTotalFromPayout(
  revenue: number,
  passThroughTax: number,
  guestFeeRate = AIRBNB_GUEST_FEE_RATE,
  hostFeeRate = AIRBNB_HOST_FEE_RATE
): number {
  return offerFromPayout(revenue, passThroughTax, hostFeeRate) * (1 + guestFeeRate) + passThroughTax
}

export interface DiscountScenario {
  rate: number
  base: PocketBreakdown
  discounted: PocketBreakdown
  baseOffer: number
  discountedOffer: number
  baseGuestTotal: number
  discountedGuestTotal: number
  /** Drop in what the guest pays all-in, including the fee and taxes that shrink with the price. */
  guestSavings: number
  pocketLoss: number
  /** Extra nights at the discounted pocket rate needed to earn the discount back. */
  breakEvenNights: number
}

/**
 * A discount comes off the special offer price. The host fee, guest fee and
 * pass-through taxes are all charged on that price, so every figure shrinks by
 * the same rate.
 */
export function discountScenario(
  revenue: number,
  passThroughTax: number,
  nights: number,
  rate: number,
  guestFeeRate = AIRBNB_GUEST_FEE_RATE,
  hostFeeRate = AIRBNB_HOST_FEE_RATE
): DiscountScenario {
  const keep = 1 - rate
  const base = pocketAfterTaxes(revenue, passThroughTax, nights)
  const discounted = pocketAfterTaxes(revenue * keep, passThroughTax * keep, nights)
  const pocketLoss = base.pocket - discounted.pocket
  const baseOffer = offerFromPayout(revenue, passThroughTax, hostFeeRate)
  const baseGuestTotal = guestTotalFromPayout(revenue, passThroughTax, guestFeeRate, hostFeeRate)
  return {
    rate,
    base,
    discounted,
    baseOffer,
    discountedOffer: baseOffer * keep,
    baseGuestTotal,
    discountedGuestTotal: baseGuestTotal * keep,
    guestSavings: baseGuestTotal * rate,
    pocketLoss,
    breakEvenNights: discounted.pocketPerNight > 0 ? pocketLoss / discounted.pocketPerNight : 0,
  }
}

// ── Special offer ────────────────────────────────────

export interface SpecialOffer {
  total: number
  offer: number
  serviceFee: number
  taxes: number
  hostFee: number
  /**
   * What Airbnb sends you: the offer less the host fee plus the taxes it
   * passes through. This is the booking's Revenue, and `taxes` its Pass Through Tax.
   */
  payout: number
}

/**
 * Works back from what the guest should pay all-in to the price to enter in an
 * Airbnb special offer. The offer is the pre-tax base: the guest pays offer +
 * service fee + taxes, both charged on the offer, so offer = total / (1 + fee + tax).
 */
export function specialOfferFromTotal(
  total: number,
  guestFeeRate = AIRBNB_GUEST_FEE_RATE,
  taxRate = TAX_RATE,
  hostFeeRate = AIRBNB_HOST_FEE_RATE
): SpecialOffer {
  const offer = total / (1 + guestFeeRate + taxRate)
  const hostFee = offer * hostFeeRate
  return {
    total,
    offer,
    serviceFee: offer * guestFeeRate,
    taxes: offer * taxRate,
    hostFee,
    payout: offer - hostFee + offer * taxRate,
  }
}
