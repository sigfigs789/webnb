import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { BookingAnalyzer } from './BookingAnalyzer'

describe('BookingAnalyzer', () => {
  it('renders every section and the default special offer', () => {
    const html = renderToString(<BookingAnalyzer bookings={[]} />)
    expect(html).toContain('Booking analyzer')
    expect(html).toContain('Revenue per night vs history')
    expect(html).toContain('Calendar impact')
    expect(html).toContain('Discount impact')
    expect(html).toContain('Special offer calculator')
    // A guest paying $9,381 leaves $6,901.96 take-home at the default host fee
    expect(html).toContain('$6,901.96')
  })

  it('starts with a July 4 → August 7 stay taking home $6,900', () => {
    const html = renderToString(<BookingAnalyzer bookings={[]} />)
    expect(html).toMatch(/id="an-start" type="date" value="\d{4}-07-04"/)
    expect(html).toMatch(/id="an-end" type="date" value="\d{4}-08-07"/)
    expect(html).toContain('Take-home ($)')
    expect(html).toContain('value="6900"')
    // $6,900 over 34 nights
    expect(html).toContain('$202.94')
  })

  it('compares back-to-back bookings with gaps between them', () => {
    const html = renderToString(<BookingAnalyzer bookings={[]} />)
    expect(html).toContain('Gap between bookings (nights)')
    expect(html).toContain('0 (back to back)')
  })

  it('makes this booking and the potential stays draggable on the After bar only', () => {
    const html = renderToString(<BookingAnalyzer bookings={[]} />)
    const [before, after] = html.split('analyzer__timeline-label').slice(1)
    expect(before).not.toContain('role="slider"')
    expect(after).toContain('data-segment-key="proposal"')
    expect(after.match(/role="slider"/g)?.length).toBeGreaterThan(1)
  })

  it('labels the stays that could still be booked', () => {
    const html = renderToString(<BookingAnalyzer bookings={[]} />)
    expect(html).toContain('Potential bookable stays')
    expect(html).not.toContain('Max more')
  })
})
