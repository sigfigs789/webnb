import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { RevenuePerNightChart } from './RevenuePerNightChart'
import { Booking } from '../../shared/types'

const bookings: Booking[] = [
  ['2023-12-28', '2024-01-03', 1800],
  ['2024-07-10', '2024-07-20', 3300],
  ['2025-07-01', '2025-07-12', 4200],
].map(([startDate, endDate, revenue], i) => ({
  id: String(i),
  name: `Guest ${i}`,
  revenue: revenue as number,
  passThroughTax: (revenue as number) * 0.12,
  bookingDate: startDate as string,
  startDate: startDate as string,
  endDate: endDate as string,
}))

describe('RevenuePerNightChart', () => {
  it('renders controls, year chips and stats', () => {
    const html = renderToString(<RevenuePerNightChart bookings={bookings} />)
    expect(html).toContain('Revenue per night')
    expect(html).toContain('Monthly')
    expect(html).not.toContain('Gross')
    expect(html).not.toContain('Net')
    expect(html).toContain('2023')
    expect(html).toContain('2025')
    expect(html).toContain('Best <!-- -->month')
    expect(html).toContain('Weighted average')
    expect(html).toContain('Jul 25 · $381.82')
    expect(html).toContain('$344.44')
  })

  it('shows the empty state with no bookings', () => {
    const html = renderToString(<RevenuePerNightChart bookings={[]} />)
    expect(html).toContain('Add a booking with check-in and check-out dates')
  })
})
