import { useMemo, useState } from 'react'
import { Booking } from '../../shared/types'
import { TAX_RATE } from '../../shared/taxCalculation'
import {
  AIRBNB_HOST_FEE_RATE,
  CalendarCapacity,
  NightRange,
  analyzeProposal,
  bookingRange,
  compareRevenuePerNight,
  discountScenario,
  fitStays,
  fromDay,
  nightsOf,
  passThroughForRevenue,
  pocketAfterTaxes,
  specialOfferForTakeHome,
  takeHomeFromSpecialOffer,
  toDay,
} from '../../shared/bookingAnalysis'

interface Props {
  bookings: Booking[]
}

interface BlockedInput {
  id: number
  startDate: string
  endDate: string
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DISCOUNT_LADDER = [0.05, 0.1, 0.15, 0.2]
const GAP_LADDER = [0, 1, 2, 3]

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatCurrencyPrecise(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatPercent(rate: number, digits = 1) {
  return `${(rate * 100).toFixed(digits)}%`
}

function formatNights(n: number) {
  return `${n} ${n === 1 ? 'night' : 'nights'}`
}

function todayString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const DEFAULT_TAKE_HOME = '6900'

/** The next July 4 → August 7 stay that has not started yet. */
function defaultStay(today: string) {
  const thisYear = Number(today.slice(0, 4))
  const year = today < `${thisYear}-07-04` ? thisYear : thisYear + 1
  return { startDate: `${year}-07-04`, endDate: `${year}-08-07` }
}

function parseNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function isValidRange(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && startDate < endDate)
}

function percentChange(proposed: number, reference: number | null | undefined): number | null {
  return reference == null || reference <= 0 ? null : proposed / reference - 1
}

function DeltaCell({ proposed, reference }: { proposed: number; reference: number | null | undefined }) {
  const change = percentChange(proposed, reference)
  if (change === null) return <td>—</td>
  return (
    <td className={`analyzer__delta analyzer__delta--${change >= 0 ? 'up' : 'down'}`}>
      {change >= 0 ? '+' : ''}
      {formatPercent(change)}
    </td>
  )
}

function Delta({ proposed, reference }: { proposed: number; reference: number | null | undefined }) {
  if (reference == null || reference <= 0) return null
  const change = proposed / reference - 1
  const tone = change >= 0 ? 'up' : 'down'
  return (
    <span className={`analyzer__delta analyzer__delta--${tone}`}>
      {change >= 0 ? '+' : ''}
      {formatPercent(change)}
    </span>
  )
}

type DayKind = 'past' | 'booked' | 'blocked' | 'proposal' | 'potential' | 'stranded' | 'open'

interface Segment {
  kind: DayKind
  start: number
  nights: number
  /** For potential stays: which one (1-based), so back-to-back stays stay separate blocks. */
  stay?: number
}

function timelineSegments(
  window: NightRange,
  today: number,
  stays: NightRange[],
  blocked: NightRange[],
  proposal: NightRange | null,
  capacity: CalendarCapacity
): Segment[] {
  const inside = (day: number, ranges: NightRange[]) => ranges.some(r => day >= r.start && day < r.end)
  const stranded = capacity.gaps.filter(gap => gap.stranded)
  const potential = capacity.gaps.flatMap(gap => gap.potentialStays)
  const segments: Segment[] = []

  for (let day = window.start; day < window.end; day++) {
    let kind: DayKind = 'open'
    let stay: number | undefined
    const potentialIndex = potential.findIndex(r => day >= r.start && day < r.end)
    if (proposal && day >= proposal.start && day < proposal.end) kind = 'proposal'
    else if (inside(day, stays)) kind = 'booked'
    else if (inside(day, blocked)) kind = 'blocked'
    else if (day < today) kind = 'past'
    else if (inside(day, stranded)) kind = 'stranded'
    else if (potentialIndex >= 0) {
      kind = 'potential'
      stay = potentialIndex + 1
    }

    const last = segments[segments.length - 1]
    if (last && last.kind === kind && last.stay === stay) last.nights++
    else segments.push({ kind, start: day, nights: 1, stay })
  }
  return segments
}

function monthTicks(window: NightRange) {
  const ticks: { label: string; offset: number }[] = []
  const total = nightsOf(window)
  for (let day = window.start; day < window.end; day++) {
    const date = fromDay(day)
    if (date.endsWith('-01')) {
      ticks.push({ label: MONTH_NAMES[Number(date.slice(5, 7)) - 1], offset: ((day - window.start) / total) * 100 })
    }
  }
  return ticks
}

const KIND_LABELS: Record<DayKind, string> = {
  past: 'Past',
  booked: 'Booked',
  blocked: 'Blocked',
  proposal: 'This booking',
  potential: 'Potential stay',
  stranded: 'Stranded',
  open: 'Open',
}

function Timeline({ label, segments, window }: { label: string; segments: Segment[]; window: NightRange }) {
  const total = nightsOf(window)
  return (
    <div className="analyzer__timeline">
      <span className="analyzer__timeline-label">{label}</span>
      <div className="analyzer__timeline-bar">
        {segments.map(segment => (
          <span
            key={`${segment.kind}-${segment.start}`}
            className={`analyzer__segment analyzer__segment--${segment.kind}${
              segment.stay !== undefined && segment.stay % 2 === 0 ? ' analyzer__segment--alt' : ''
            }`}
            style={{ width: `${(segment.nights / total) * 100}%` }}
            title={`${KIND_LABELS[segment.kind]}${segment.stay !== undefined ? ` ${segment.stay}` : ''}: ${fromDay(
              segment.start
            )} · ${formatNights(segment.nights)}`}
          >
            {segment.stay !== undefined && segment.nights / total > 0.035 && (
              <span className="analyzer__segment-label">{segment.stay}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

export function BookingAnalyzer({ bookings }: Props) {
  const today = todayString()

  const [startDate, setStartDate] = useState(() => defaultStay(today).startDate)
  const [endDate, setEndDate] = useState(() => defaultStay(today).endDate)
  const [revenue, setRevenue] = useState(DEFAULT_TAKE_HOME)
  const [passThroughTax, setPassThroughTax] = useState('')
  const [minNights, setMinNights] = useState('30')
  const [gapNights, setGapNights] = useState('0')
  const [windowStartInput, setWindowStartInput] = useState('')
  const [windowEndInput, setWindowEndInput] = useState('')
  const [blocked, setBlocked] = useState<BlockedInput[]>([])
  const [discountPct, setDiscountPct] = useState('10')

  const [offerMode, setOfferMode] = useState<'total' | 'offer'>('total')
  const [offerAmount, setOfferAmount] = useState('9381')
  const [hostFeePct, setHostFeePct] = useState(String(+(AIRBNB_HOST_FEE_RATE * 100).toFixed(4)))
  const [offerTaxPct, setOfferTaxPct] = useState(String(+(TAX_RATE * 100).toFixed(3)))

  const hasDates = isValidRange(startDate, endDate)
  const revenueValue = parseNumber(revenue)
  const minNightsValue = Math.max(1, Math.round(parseNumber(minNights)) || 1)
  const proposal = hasDates ? { start: toDay(startDate), end: toDay(endDate) } : null
  const nights = proposal ? nightsOf(proposal) : 0

  // Default window: the check-in's calendar year, starting no earlier than today.
  const year = Number((hasDates ? startDate : today).slice(0, 4))
  const defaultWindowStart = today > `${year}-01-01` ? today : `${year}-01-01`
  const defaultWindowEnd = `${year + 1}-01-01`
  const windowStart = windowStartInput || defaultWindowStart
  const windowEnd = windowEndInput || defaultWindowEnd
  const hasWindow = isValidRange(windowStart, windowEnd)

  const stays = useMemo(
    () => bookings.map(bookingRange).filter(range => nightsOf(range) > 0),
    [bookings]
  )
  const blockedRanges = useMemo(
    () => blocked.filter(b => isValidRange(b.startDate, b.endDate)).map(bookingRange),
    [blocked]
  )

  const span = hasWindow ? { start: toDay(windowStart), end: toDay(windowEnd) } : null
  // Empty nights expected between bookings; 0 means perfect back-to-back packing.
  const gapNightsValue = Math.max(0, Math.round(parseNumber(gapNights)))
  const analyze = (gap: number) =>
    proposal && span ? analyzeProposal(stays, blockedRanges, proposal, span, minNightsValue, gap) : null
  const impact = analyze(gapNightsValue)
  const gapLadder = Array.from(new Set([...GAP_LADDER, gapNightsValue])).sort((a, b) => a - b)

  const discountRate = Math.min(Math.max(parseNumber(discountPct), 0), 100) / 100
  const hostFeeRate = parseNumber(hostFeePct) / 100
  const offerTaxRate = parseNumber(offerTaxPct) / 100
  // Take-home has no tax in it. Blank pass-through tax means "the Oahu taxes Airbnb charges on the listing price".
  const estimatedPassThrough = passThroughForRevenue(revenueValue, offerTaxRate, hostFeeRate)
  const passThroughValue = passThroughTax === '' ? estimatedPassThrough : parseNumber(passThroughTax)
  const scenario = (rate: number) =>
    discountScenario(revenueValue, passThroughValue, nights, rate, hostFeeRate)
  const discount = nights > 0 && revenueValue > 0 ? scenario(discountRate) : null
  const comparison = useMemo(
    () => (hasDates ? compareRevenuePerNight(bookings, { startDate, endDate, revenue: revenueValue }) : null),
    [bookings, hasDates, startDate, endDate, revenueValue]
  )

  // Either work back from a special offer price, or forward from a take-home.
  const offerInput = parseNumber(offerAmount)
  const offer =
    offerMode === 'total'
      ? takeHomeFromSpecialOffer(offerInput, hostFeeRate, offerTaxRate)
      : specialOfferForTakeHome(offerInput, hostFeeRate, offerTaxRate)
  const offerPocket = pocketAfterTaxes(offer.takeHome, offer.taxes, nights)

  const useOfferAsBooking = () => {
    setRevenue(offer.takeHome.toFixed(2))
    // The estimate from the revenue is exactly the offer's taxes, so leave it on auto.
    setPassThroughTax('')
  }

  // Discounts and offers are judged against the same dates a year earlier.
  const sameWindowRate = comparison?.sameDatesLastYear.revenuePerNight ?? null
  const sameWindowNote =
    sameWindowRate === null
      ? 'no bookings on these dates last year to compare with'
      : `vs ${formatCurrencyPrecise(sameWindowRate)} / night on the same dates last year`

  // The best available "what a night is worth" for pricing stranded nights.
  const referenceRate =
    comparison?.sameMonthsLastYear?.revenuePerNight ??
    comparison?.lastYear?.revenuePerNight ??
    comparison?.allTime?.revenuePerNight ??
    comparison?.proposedRevenuePerNight ??
    0

  const updateBlocked = (id: number, key: 'startDate' | 'endDate', value: string) =>
    setBlocked(prev => prev.map(b => (b.id === id ? { ...b, [key]: value } : b)))

  return (
    <div className="analyzer">
      <h2>Booking analyzer</h2>
      <p className="analyzer__intro">
        Try a hypothetical booking against your history and calendar. Nothing here is saved.
      </p>

      {/* ── Inputs ───────────────────────────────── */}
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="an-start">Check-in</label>
          <input id="an-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="an-end">Check-out</label>
          <input id="an-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          {startDate && endDate && !hasDates && <span className="form-error">Must be after check-in</span>}
        </div>
        <div className="form-field">
          <label htmlFor="an-revenue">Take-home ($)</label>
          <input
            id="an-revenue"
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={revenue}
            onChange={e => setRevenue(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="an-pass">Pass Through Tax ($)</label>
          <input
            id="an-pass"
            type="number"
            min="0"
            step="any"
            placeholder={revenueValue > 0 ? `${estimatedPassThrough.toFixed(2)} (auto)` : 'Auto from take-home'}
            value={passThroughTax}
            onChange={e => setPassThroughTax(e.target.value)}
          />
          {passThroughTax === '' ? (
            revenueValue > 0 && (
              <span className="analyzer__field-note">
                {formatPercent(offerTaxRate, 3)} tax on the listing price ({formatPercent(hostFeeRate, 4)} host fee)
              </span>
            )
          ) : (
            <button type="button" className="analyzer__field-link" onClick={() => setPassThroughTax('')}>
              Reset to estimate
            </button>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="an-min">Minimum nights</label>
          <input id="an-min" type="number" min="1" step="1" value={minNights} onChange={e => setMinNights(e.target.value)} />
        </div>
      </div>

      <p className="analyzer__hint">
        Take-home is what the stay earns with no tax in it, so revenue per night is
        take-home ÷ nights. Pass Through Tax is the Oahu tax Airbnb charges on the listing price and passes to you,
        worked out with the host fee and tax rate in the special offer section; type a figure to override it. Or build the booking from a special offer
        below and press “Use for this booking”.
      </p>

      {hasDates && (
        <p className="analyzer__summary">
          {formatNights(nights)}
          {revenueValue > 0 && <> · {formatCurrencyPrecise(revenueValue / nights)} / night</>}
          {nights < minNightsValue && (
            <span className="analyzer__warn"> · shorter than the {minNightsValue}-night minimum</span>
          )}
        </p>
      )}

      {/* ── Revenue per night ────────────────────── */}
      <section className="analyzer__section">
        <h3>Revenue per night vs history</h3>
        <p className="analyzer__hint">
          Real revenue only: pass-through tax is taken out of every past booking to match this one.
        </p>
        {!comparison || revenueValue <= 0 ? (
          <p className="analyzer__empty">Enter dates and take-home to compare.</p>
        ) : (
          <div className="analyzer__tiles">
            <div className="analyzer__tile analyzer__tile--primary">
              <span className="analyzer__tile-label">This booking</span>
              <span className="analyzer__tile-value">{formatCurrencyPrecise(comparison.proposedRevenuePerNight)}</span>
              <span className="analyzer__tile-sub">
                {formatCurrency(revenueValue)} over {formatNights(nights)}
              </span>
            </div>
            <div className="analyzer__tile">
              <span className="analyzer__tile-label">Same dates last year</span>
              <span className="analyzer__tile-value">
                {comparison.sameDatesLastYear.revenuePerNight != null
                  ? formatCurrencyPrecise(comparison.sameDatesLastYear.revenuePerNight)
                  : '—'}{' '}
                <Delta proposed={comparison.proposedRevenuePerNight} reference={comparison.sameDatesLastYear.revenuePerNight} />
              </span>
              <span className="analyzer__tile-sub">
                {comparison.sameDatesLastYear.bookedNights} of {comparison.sameDatesLastYear.totalNights} nights booked
                {comparison.sameDatesLastYear.totalNights > 0 &&
                  ` (${formatPercent(comparison.sameDatesLastYear.bookedNights / comparison.sameDatesLastYear.totalNights, 0)})`}
                {' · '}
                {formatCurrency(comparison.sameDatesLastYear.revenue)} earned
              </span>
            </div>
            <div className="analyzer__tile">
              <span className="analyzer__tile-label">Same months last year</span>
              <span className="analyzer__tile-value">
                {comparison.sameMonthsLastYear ? formatCurrencyPrecise(comparison.sameMonthsLastYear.revenuePerNight) : '—'}{' '}
                <Delta proposed={comparison.proposedRevenuePerNight} reference={comparison.sameMonthsLastYear?.revenuePerNight} />
              </span>
              <span className="analyzer__tile-sub">
                {comparison.sameMonthsLastYear
                  ? `Each month weighted by its share of ${formatNights(comparison.sameMonthsLastYear.coveredNights)}`
                  : 'No stays in those months'}
              </span>
            </div>
            <div className="analyzer__tile">
              <span className="analyzer__tile-label">
                {comparison.lastYear ? `${comparison.lastYear.year} average` : 'Last year average'}
              </span>
              <span className="analyzer__tile-value">
                {comparison.lastYear ? formatCurrencyPrecise(comparison.lastYear.revenuePerNight) : '—'}{' '}
                <Delta proposed={comparison.proposedRevenuePerNight} reference={comparison.lastYear?.revenuePerNight} />
              </span>
              <span className="analyzer__tile-sub">
                {comparison.lastYear ? formatNights(comparison.lastYear.nights) : 'No stays that year'}
              </span>
            </div>
            <div className="analyzer__tile">
              <span className="analyzer__tile-label">All-time average</span>
              <span className="analyzer__tile-value">
                {comparison.allTime ? formatCurrencyPrecise(comparison.allTime.revenuePerNight) : '—'}{' '}
                <Delta proposed={comparison.proposedRevenuePerNight} reference={comparison.allTime?.revenuePerNight} />
              </span>
              <span className="analyzer__tile-sub">
                {comparison.allTime ? formatNights(comparison.allTime.nights) : 'No history yet'}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Calendar impact ──────────────────────── */}
      <section className="analyzer__section">
        <h3>Calendar impact</h3>
        <p className="analyzer__hint">
          Open gaps shorter than {minNightsValue} nights can never be booked. This compares how many stays the
          window can still hold before and after accepting this booking.
        </p>

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="an-wstart">Window start</label>
            <input id="an-wstart" type="date" value={windowStart} onChange={e => setWindowStartInput(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="an-wend">Window end</label>
            <input id="an-wend" type="date" value={windowEnd} onChange={e => setWindowEndInput(e.target.value)} />
            {!hasWindow && <span className="form-error">Must be after the window start</span>}
          </div>
          <div className="form-field">
            <label htmlFor="an-gap">Gap between bookings (nights)</label>
            <input
              id="an-gap"
              type="number"
              min="0"
              step="1"
              value={gapNights}
              onChange={e => setGapNights(e.target.value)}
            />
          </div>
        </div>
        <p className="analyzer__hint">
          Gap between bookings is how many empty nights you expect around each future stay: 0 is perfect
          back-to-back bookings. A future stay then needs that many free nights next to any booking and between
          each other, so an open stretch fits a {minNightsValue}-night stay only with room to spare.
        </p>

        <div className="analyzer__blocked">
          <span className="analyzer__blocked-title">Other blocked dates (owner use, maintenance…)</span>
          {blocked.map(b => (
            <div key={b.id} className="analyzer__blocked-row">
              <input
                type="date"
                aria-label="Blocked from"
                value={b.startDate}
                onChange={e => updateBlocked(b.id, 'startDate', e.target.value)}
              />
              <span>→</span>
              <input
                type="date"
                aria-label="Blocked until"
                value={b.endDate}
                onChange={e => updateBlocked(b.id, 'endDate', e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary analyzer__blocked-remove"
                onClick={() => setBlocked(prev => prev.filter(x => x.id !== b.id))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary analyzer__blocked-add"
            onClick={() => setBlocked(prev => [...prev, { id: (prev[prev.length - 1]?.id ?? 0) + 1, startDate: '', endDate: '' }])}
          >
            + Add blocked dates
          </button>
        </div>

        {!impact || !span ? (
          <p className="analyzer__empty">Enter check-in and check-out dates to see the calendar impact.</p>
        ) : (
          <>
            {impact.overlapsExisting && (
              <p className="analyzer__alert analyzer__alert--bad">
                These dates overlap an existing booking or blocked range.
              </p>
            )}

            <div className="analyzer__gaps">
              <GapCallout
                label="Gap before check-in"
                nights={impact.gapBefore}
                minNights={minNightsValue}
                gapNights={gapNightsValue}
              />
              <GapCallout
                label="Gap after check-out"
                nights={impact.gapAfter}
                minNights={minNightsValue}
                gapNights={gapNightsValue}
              />
            </div>

            <Timeline
              label="Before"
              window={span}
              segments={timelineSegments(span, toDay(today), stays, blockedRanges, null, impact.before)}
            />
            <Timeline
              label="After"
              window={span}
              segments={timelineSegments(span, toDay(today), stays, blockedRanges, proposal, impact.after)}
            />
            <div className="analyzer__ticks">
              {monthTicks(span).map(tick => (
                <span key={`${tick.label}-${tick.offset}`} style={{ left: `${tick.offset}%` }}>
                  {tick.label}
                </span>
              ))}
            </div>
            <div className="analyzer__legend">
              {(['booked', 'proposal', 'potential', 'blocked', 'stranded', 'open', 'past'] as DayKind[]).map(kind => (
                <span key={kind}>
                  <i className={`analyzer__swatch analyzer__segment--${kind}`} />
                  {KIND_LABELS[kind]}
                </span>
              ))}
            </div>

            <div className="analyzer__table-wrap">
              <table className="analyzer__table">
                <thead>
                  <tr>
                    <th />
                    <th>Before</th>
                    <th>After</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  <CapacityRow label="Booked stays" before={impact.before.bookedStays} after={impact.after.bookedStays} />
                  <CapacityRow
                    label="Potential bookable stays"
                    before={impact.before.maxAdditionalStays}
                    after={impact.after.maxAdditionalStays}
                  />
                  <CapacityRow
                    label="Total possible stays"
                    before={impact.before.totalPossibleStays}
                    after={impact.after.totalPossibleStays}
                    emphasize
                  />
                  <CapacityRow label="Booked nights" before={impact.before.bookedNights} after={impact.after.bookedNights} />
                  <CapacityRow
                    label="Bookable open nights"
                    before={impact.before.bookableNights}
                    after={impact.after.bookableNights}
                  />
                  <CapacityRow
                    label="Stranded nights"
                    before={impact.before.strandedNights}
                    after={impact.after.strandedNights}
                    lowerIsBetter
                  />
                </tbody>
              </table>
            </div>

            <div className="analyzer__table-wrap">
              <table className="analyzer__table analyzer__table--breakdown">
                <tbody>
                  <tr>
                    <td>This booking</td>
                    <td className={impact.staysAdded > 0 ? 'analyzer__delta analyzer__delta--up' : undefined}>
                      {impact.staysAdded > 0 ? `+${impact.staysAdded}` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>Future {minNightsValue}+ night stays ruled out</td>
                    <td className={impact.staysRuledOut > 0 ? 'analyzer__delta analyzer__delta--down' : undefined}>
                      {impact.staysRuledOut > 0 ? `−${impact.staysRuledOut}` : '—'}
                    </td>
                  </tr>
                  <tr className="analyzer__row--total">
                    <td>Net change in possible stays</td>
                    <td
                      className={
                        impact.possibleStaysDelta === 0
                          ? undefined
                          : `analyzer__delta analyzer__delta--${impact.possibleStaysDelta > 0 ? 'up' : 'down'}`
                      }
                    >
                      {impact.possibleStaysDelta === 0
                        ? '0'
                        : `${impact.possibleStaysDelta > 0 ? '+' : '−'}${Math.abs(impact.possibleStaysDelta)}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="analyzer__subhead">Gap between bookings: back to back vs spaced out</h4>
            <div className="analyzer__table-wrap">
              <table className="analyzer__table">
                <thead>
                  <tr>
                    <th>Gap nights</th>
                    <th>Potential bookable stays</th>
                    <th>Total possible stays</th>
                    <th>Change from this booking</th>
                    <th>Stranded nights after</th>
                  </tr>
                </thead>
                <tbody>
                  {gapLadder.map(gap => {
                    const row = analyze(gap)!
                    return (
                      <tr key={gap} className={gap === gapNightsValue ? 'analyzer__row--active' : undefined}>
                        <td>{gap === 0 ? '0 (back to back)' : gap}</td>
                        <td>
                          {row.before.maxAdditionalStays} → {row.after.maxAdditionalStays}
                        </td>
                        <td>
                          {row.before.totalPossibleStays} → {row.after.totalPossibleStays}
                        </td>
                        <td
                          className={
                            row.possibleStaysDelta === 0
                              ? undefined
                              : `analyzer__delta analyzer__delta--${row.possibleStaysDelta > 0 ? 'up' : 'down'}`
                          }
                        >
                          {row.possibleStaysDelta > 0 ? '+' : row.possibleStaysDelta < 0 ? '−' : ''}
                          {Math.abs(row.possibleStaysDelta)}
                        </td>
                        <td>{row.after.strandedNights}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ImpactVerdict
              gapNights={gapNightsValue}
              staysRuledOut={impact.staysRuledOut}
              gapBefore={impact.gapBefore}
              gapAfter={impact.gapAfter}
              minNights={minNightsValue}
              possibleStaysDelta={impact.possibleStaysDelta}
              newlyStrandedNights={impact.newlyStrandedNights}
              referenceRate={referenceRate}
            />
          </>
        )}
      </section>

      {/* ── Discount ─────────────────────────────── */}
      <section className="analyzer__section">
        <h3>Discount impact</h3>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="an-discount">Discount (%)</label>
            <input
              id="an-discount"
              type="number"
              min="0"
              max="100"
              step="any"
              value={discountPct}
              onChange={e => setDiscountPct(e.target.value)}
            />
          </div>
        </div>

        {!discount ? (
          <p className="analyzer__empty">Enter dates and take-home to see what a discount costs you.</p>
        ) : (
          <>
            <div className="analyzer__tiles">
              <div className="analyzer__tile">
                <span className="analyzer__tile-label">Take-home</span>
                <span className="analyzer__tile-value">{formatCurrency(discount.discounted.revenue)}</span>
                <span className="analyzer__tile-sub">
                  Down from {formatCurrency(discount.base.revenue)}
                </span>
              </div>
              <div className="analyzer__tile">
                <span className="analyzer__tile-label">Guest saves</span>
                <span className="analyzer__tile-value">{formatCurrency(discount.guestSavings)}</span>
                <span className="analyzer__tile-sub">
                  Special offer price {formatCurrency(discount.baseGuestTotal)} →{' '}
                  {formatCurrency(discount.discountedGuestTotal)}
                </span>
              </div>
              <div className="analyzer__tile analyzer__tile--primary">
                <span className="analyzer__tile-label">Costs you (after taxes)</span>
                <span className="analyzer__tile-value">{formatCurrency(discount.pocketLoss)}</span>
                <span className="analyzer__tile-sub">
                  In pocket {formatCurrency(discount.base.pocket)} → {formatCurrency(discount.discounted.pocket)}
                </span>
              </div>
              <div className="analyzer__tile">
                <span className="analyzer__tile-label">Revenue / night</span>
                <span className="analyzer__tile-value">
                  {formatCurrencyPrecise(discount.discounted.revenuePerNight)}{' '}
                  <Delta proposed={discount.discounted.revenuePerNight} reference={sameWindowRate} />
                </span>
                <span className="analyzer__tile-sub">After the discount, {sameWindowNote}</span>
              </div>
              <div className="analyzer__tile">
                <span className="analyzer__tile-label">Break-even</span>
                <span className="analyzer__tile-value">{discount.breakEvenNights.toFixed(1)} nights</span>
                <span className="analyzer__tile-sub">Worth it if the discount avoids this many empty nights</span>
              </div>
            </div>

            <div className="analyzer__table-wrap">
              <table className="analyzer__table">
                <thead>
                  <tr>
                    <th>Discount</th>
                    <th>Take-home</th>
                    <th>Special offer price</th>
                    <th>Airbnb payout</th>
                    <th>Per night</th>
                    <th>vs same dates last year</th>
                    <th>Taxes owed</th>
                    <th>In pocket</th>
                    <th>You give up</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, ...DISCOUNT_LADDER].map(rate => {
                    const row = scenario(rate)
                    return (
                      <tr key={rate} className={Math.abs(rate - discountRate) < 1e-9 ? 'analyzer__row--active' : undefined}>
                        <td>{rate === 0 ? 'None' : formatPercent(rate, 0)}</td>
                        <td>{formatCurrency(row.discounted.revenue)}</td>
                        <td>{formatCurrency(row.discountedGuestTotal)}</td>
                        <td>{formatCurrency(row.discounted.payout)}</td>
                        <td>{formatCurrencyPrecise(row.discounted.revenuePerNight)}</td>
                        <DeltaCell proposed={row.discounted.revenuePerNight} reference={sameWindowRate} />
                        <td>{formatCurrency(row.discounted.taxes)}</td>
                        <td>{formatCurrency(row.discounted.pocket)}</td>
                        <td>{rate === 0 ? '—' : formatCurrency(row.pocketLoss)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="analyzer__hint">
              The discount comes off the listing price, so the host fee, pass-through tax, take-home and special
              offer price all shrink with it. Airbnb payout = take-home + pass-through tax. The pass-through tax is
              remitted in full, so in pocket = take-home. Cleaning and other expenses are not deducted.
            </p>
          </>
        )}
      </section>

      {/* ── Special offer ────────────────────────── */}
      <section className="analyzer__section">
        <h3>Special offer calculator</h3>
        <p className="analyzer__hint">
          The special offer price is what the guest pays all-in: the listing price plus the Oahu taxes on it. Airbnb
          keeps its host fee out of the listing price, and what is left is your take-home. The taxes come back to you
          with the payout. Start from either one.
        </p>
        <div className="revenue-chart__toggle analyzer__mode" role="group" aria-label="Start from">
          {(['total', 'offer'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              className={`revenue-chart__toggle-btn${offerMode === mode ? ' revenue-chart__toggle-btn--active' : ''}`}
              aria-pressed={offerMode === mode}
              onClick={() => {
                // Carry the current figure across so switching does not lose the scenario
                setOfferAmount((mode === 'total' ? offer.specialOfferPrice : offer.takeHome).toFixed(2))
                setOfferMode(mode)
              }}
            >
              {mode === 'total' ? 'Special offer price' : 'Take-home'}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="so-amount">{offerMode === 'total' ? 'Special offer price ($)' : 'Take-home ($)'}</label>
            <input id="so-amount" type="number" min="0" step="any" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="so-fee">Airbnb host fee (%)</label>
            <input id="so-fee" type="number" min="0" max="99" step="any" value={hostFeePct} onChange={e => setHostFeePct(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="so-tax">Oahu taxes (%)</label>
            <input id="so-tax" type="number" min="0" step="any" value={offerTaxPct} onChange={e => setOfferTaxPct(e.target.value)} />
          </div>
        </div>

        <div className="analyzer__offer">
          <span className="analyzer__offer-label">
            {offerMode === 'total' ? 'Take-home' : 'Special offer price'}
          </span>
          <span className="analyzer__offer-value">
            {formatCurrencyPrecise(offerMode === 'total' ? offer.takeHome : offer.specialOfferPrice)}
          </span>
          <span className="analyzer__offer-formula">
            {offerMode === 'total'
              ? `${formatCurrency(offer.specialOfferPrice)} ÷ (1 + ${offerTaxPct || 0}%) × (1 − ${hostFeePct || 0}%)`
              : `${formatCurrency(offer.takeHome)} ÷ (1 − ${hostFeePct || 0}%) × (1 + ${offerTaxPct || 0}%)`}
          </span>
        </div>

        {nights > 0 ? (
          <p className="analyzer__offer-compare">
            You get <strong>{formatCurrencyPrecise(offerPocket.pocketPerNight)} / night</strong>{' '}
            <Delta proposed={offerPocket.pocketPerNight} reference={sameWindowRate} /> · {sameWindowNote}
          </p>
        ) : (
          <p className="analyzer__offer-compare">
            Enter check-in and check-out above to see what you get per night and compare it with the same dates last
            year.
          </p>
        )}

        <div className="analyzer__table-wrap">
          <table className="analyzer__table analyzer__table--breakdown">
            <tbody>
              <tr className="analyzer__row--total">
                <td>Special offer price (guest pays)</td>
                <td>{formatCurrencyPrecise(offer.specialOfferPrice)}</td>
              </tr>
              <tr>
                <td>− Taxes ({offerTaxPct || 0}% of the listing price)</td>
                <td>{formatCurrencyPrecise(offer.taxes)}</td>
              </tr>
              <tr className="analyzer__row--total">
                <td>= Listing price</td>
                <td>{formatCurrencyPrecise(offer.listingPrice)}</td>
              </tr>
              <tr>
                <td>− Airbnb host fee ({hostFeePct || 0}%)</td>
                <td>{formatCurrencyPrecise(offer.hostFee)}</td>
              </tr>
              <tr className="analyzer__row--total">
                <td>= Take-home (in your pocket)</td>
                <td>{formatCurrencyPrecise(offer.takeHome)}</td>
              </tr>
              <tr>
                <td>Airbnb payout (take-home + pass-through tax to remit)</td>
                <td>{formatCurrencyPrecise(offer.payout)}</td>
              </tr>
              {nights > 0 && (
                <tr className="analyzer__row--total">
                  <td>You get / night ({formatNights(nights)})</td>
                  <td>{formatCurrencyPrecise(offerPocket.pocketPerNight)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn-secondary analyzer__use-offer" onClick={useOfferAsBooking}>
          Use for this booking
        </button>
        <p className="analyzer__hint">
          Oahu taxes default to {formatPercent(TAX_RATE, 3)}: 4.712% GET + 10.25% state TAT + 3% Oahu TAT. The host
          fee defaults to {formatPercent(AIRBNB_HOST_FEE_RATE, 4)}, worked out from a real booking where a guest
          paying $9,381 left $6,901.96 take-home; update it if a new quote disagrees.
        </p>
      </section>
    </div>
  )
}

function GapCallout({
  label,
  nights,
  minNights,
  gapNights,
}: {
  label: string
  nights: number | null
  minNights: number
  gapNights: number
}) {
  let tone = 'ok'
  let detail = 'Nothing booked on that side'
  if (nights !== null) {
    const fit = fitStays(nights, minNights, gapNights)
    const withGap = gapNights > 0 ? ` with ${formatNights(gapNights)} between bookings` : ''
    if (nights === 0) detail = 'Flush against the neighbouring stay'
    else if (fit === 0) {
      tone = 'bad'
      detail = `Stranded: too short for a ${minNights}-night stay${withGap}`
    } else detail = `Still fits ${fit} × ${minNights}-night stay${withGap}`
  }
  return (
    <div className={`analyzer__gap analyzer__gap--${tone}`}>
      <span className="analyzer__tile-label">{label}</span>
      <span className="analyzer__tile-value">{nights === null ? 'Open' : formatNights(nights)}</span>
      <span className="analyzer__tile-sub">{detail}</span>
    </div>
  )
}

function CapacityRow({
  label,
  before,
  after,
  emphasize,
  lowerIsBetter,
}: {
  label: string
  before: number
  after: number
  emphasize?: boolean
  lowerIsBetter?: boolean
}) {
  const change = after - before
  const good = lowerIsBetter ? change < 0 : change > 0
  const tone = change === 0 ? '' : good ? ' analyzer__delta--up' : ' analyzer__delta--down'
  return (
    <tr className={emphasize ? 'analyzer__row--total' : undefined}>
      <td>{label}</td>
      <td>{before}</td>
      <td>{after}</td>
      <td className={`analyzer__delta${tone}`}>{change === 0 ? '—' : `${change > 0 ? '+' : ''}${change}`}</td>
    </tr>
  )
}

function ImpactVerdict({
  gapNights,
  staysRuledOut,
  gapBefore,
  gapAfter,
  minNights,
  possibleStaysDelta,
  newlyStrandedNights,
  referenceRate,
}: {
  gapNights: number
  staysRuledOut: number
  gapBefore: number | null
  gapAfter: number | null
  minNights: number
  possibleStaysDelta: number
  newlyStrandedNights: number
  referenceRate: number
}) {
  if (newlyStrandedNights <= 0 && possibleStaysDelta >= 0) {
    return (
      <p className="analyzer__alert analyzer__alert--good">
        No nights are stranded and the window can still hold as many stays as before.
      </p>
    )
  }

  const strandedValue = Math.max(0, newlyStrandedNights) * referenceRate
  const isStranded = (gap: number | null): gap is number =>
    gap !== null && gap > 0 && fitStays(gap, minNights, gapNights) === 0
  const tips = [
    isStranded(gapBefore) && `moving check-in ${formatNights(gapBefore)} earlier`,
    isStranded(gapAfter) && `moving check-out ${formatNights(gapAfter)} later`,
  ].filter(Boolean)

  return (
    <p className="analyzer__alert analyzer__alert--bad">
      {possibleStaysDelta < 0 && (
        <>
          This booking rules out room for {staysRuledOut} future {staysRuledOut === 1 ? 'stay' : 'stays'}, so
          the window holds {Math.abs(possibleStaysDelta)} fewer {Math.abs(possibleStaysDelta) === 1 ? 'stay' : 'stays'}{' '}
          overall.{' '}
        </>
      )}
      {newlyStrandedNights > 0 && (
        <>
          It leaves {formatNights(newlyStrandedNights)} that can no longer be sold, about{' '}
          {formatCurrency(strandedValue)} at {formatCurrencyPrecise(referenceRate)} / night.{' '}
        </>
      )}
      {tips.length > 0 && <>Consider {tips.join(' and ')} (or pricing the extension in) to close the gap.</>}
    </p>
  )
}
