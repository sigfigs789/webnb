import { TAX_RATE } from './taxCalculation'
import { monthlyRevenuePerNight, yearlyRevenuePerNight } from './revenuePerNight'
import { Booking } from './types'

const DAY_MS = 1000 * 60 * 60 * 24

/**
 * Airbnb's host-only service fee, as a share of the listing price. Worked out
 * from a real booking: a guest paying $9,381 left $6,901.96 take-home at the
 * Oahu tax rate, so 1 − 6901.96 × (1 + tax) / 9381 ≈ 13.2109%.
 */
export const AIRBNB_HOST_FEE_RATE = 0.132109

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

/**
 * Bookings with pass-through tax taken out of their revenue. The tax is guest
 * money Airbnb hands over to be remitted, not income, so nightly rates here
 * are measured on what is left.
 */
export function withoutPassThroughTax(bookings: Booking[]): Booking[] {
  return bookings.map(booking => ({
    ...booking,
    revenue: booking.revenue - booking.passThroughTax,
    passThroughTax: 0,
  }))
}

/**
 * Compares the proposal's nightly rate with history. `revenue` should already
 * exclude pass-through tax; the history has it taken out here to match.
 */
export function compareRevenuePerNight(
  allBookings: Booking[],
  proposal: { startDate: string; endDate: string; revenue: number }
): RevenueComparison {
  const bookings = withoutPassThroughTax(allBookings)
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

/**
 * Money from one stay under Airbnb's host-only fee. Airbnb charges no guest fee:
 * the guest pays the listing price plus the Oahu taxes on it, and Airbnb keeps
 * its host fee out of the listing price.
 *
 *   listing price     = take-home / (1 − host fee)
 *   pass-through tax  = listing price × tax
 *   special offer     = listing price + pass-through tax (what the guest pays)
 *   payout            = take-home + pass-through tax
 */
export function listingPriceFor(takeHome: number, hostFeeRate = AIRBNB_HOST_FEE_RATE): number {
  return hostFeeRate < 1 ? takeHome / (1 - hostFeeRate) : 0
}

/** The tax Airbnb collects on the listing price and passes through to you. */
export function passThroughForRevenue(
  takeHome: number,
  taxRate = TAX_RATE,
  hostFeeRate = AIRBNB_HOST_FEE_RATE
): number {
  return listingPriceFor(takeHome, hostFeeRate) * taxRate
}

/** The special offer price (what the guest pays all-in) for a take-home and its pass-through tax. */
export function guestTotal(takeHome: number, passThroughTax: number, hostFeeRate = AIRBNB_HOST_FEE_RATE): number {
  return listingPriceFor(takeHome, hostFeeRate) + passThroughTax
}

/**
 * `revenue` is the take-home: what you earn, with no tax in it. The
 * pass-through tax is guest money you remit in full, so what stays in your
 * pocket is the take-home.
 */
export interface PocketBreakdown {
  revenue: number
  passThroughTax: number
  /** What Airbnb sends: take-home plus the pass-through tax. */
  payout: number
  /** Remitted to the state: the pass-through tax. */
  taxes: number
  pocket: number
  revenuePerNight: number
  pocketPerNight: number
}

export function pocketAfterTaxes(revenue: number, passThroughTax: number, nights: number): PocketBreakdown {
  const payout = revenue + passThroughTax
  const pocket = payout - passThroughTax
  return {
    revenue,
    passThroughTax,
    payout,
    taxes: passThroughTax,
    pocket,
    revenuePerNight: nights > 0 ? revenue / nights : 0,
    pocketPerNight: nights > 0 ? pocket / nights : 0,
  }
}

export interface DiscountScenario {
  rate: number
  base: PocketBreakdown
  discounted: PocketBreakdown
  baseGuestTotal: number
  discountedGuestTotal: number
  /** Drop in the special offer price, including the tax that shrinks with it. */
  guestSavings: number
  pocketLoss: number
  /** Extra nights at the discounted pocket rate needed to earn the discount back. */
  breakEvenNights: number
}

/**
 * A discount comes off the listing price. The host fee and pass-through tax
 * are both charged on that price, so every figure shrinks by the same rate.
 */
export function discountScenario(
  revenue: number,
  passThroughTax: number,
  nights: number,
  rate: number,
  hostFeeRate = AIRBNB_HOST_FEE_RATE
): DiscountScenario {
  const keep = 1 - rate
  const base = pocketAfterTaxes(revenue, passThroughTax, nights)
  const discounted = pocketAfterTaxes(revenue * keep, passThroughTax * keep, nights)
  const pocketLoss = base.pocket - discounted.pocket
  const baseGuestTotal = guestTotal(revenue, passThroughTax, hostFeeRate)
  return {
    rate,
    base,
    discounted,
    baseGuestTotal,
    discountedGuestTotal: baseGuestTotal * keep,
    guestSavings: baseGuestTotal * rate,
    pocketLoss,
    breakEvenNights: discounted.pocketPerNight > 0 ? pocketLoss / discounted.pocketPerNight : 0,
  }
}

// ── Special offer ────────────────────────────────────

export interface SpecialOffer {
  /** What the guest pays all-in: listing price + taxes. */
  specialOfferPrice: number
  /** The price before tax, which Airbnb takes its host fee out of. */
  listingPrice: number
  taxes: number
  hostFee: number
  /** What you earn, with no tax in it. */
  takeHome: number
  /** What Airbnb sends you: take-home plus the taxes it passes through. */
  payout: number
}

/**
 * Works back from a special offer price (what the guest pays all-in) to the
 * take-home inside it. Taxes are charged on the listing price, so listing
 * price = special offer price / (1 + tax), and Airbnb keeps its host fee out
 * of that.
 */
export function takeHomeFromSpecialOffer(
  specialOfferPrice: number,
  hostFeeRate = AIRBNB_HOST_FEE_RATE,
  taxRate = TAX_RATE
): SpecialOffer {
  const listingPrice = specialOfferPrice / (1 + taxRate)
  const hostFee = listingPrice * hostFeeRate
  const takeHome = listingPrice - hostFee
  const taxes = listingPrice * taxRate
  return { specialOfferPrice, listingPrice, taxes, hostFee, takeHome, payout: takeHome + taxes }
}

/** The special offer price that leaves a given take-home. */
export function specialOfferForTakeHome(
  takeHome: number,
  hostFeeRate = AIRBNB_HOST_FEE_RATE,
  taxRate = TAX_RATE
): SpecialOffer {
  return takeHomeFromSpecialOffer(listingPriceFor(takeHome, hostFeeRate) * (1 + taxRate), hostFeeRate, taxRate)
}
