import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { BookingList } from './BookingList'
import { Booking } from '../../shared/types'

const year = new Date().getFullYear()

function booking(id: string, revenue: number, passThroughTax: number): Booking {
  return {
    id,
    name: `Guest ${id}`,
    revenue,
    passThroughTax,
    bookingDate: `${year}-01-01`,
    startDate: `${year}-03-01`,
    endDate: `${year}-03-11`,
  }
}

describe('BookingList', () => {
  it('shows revenue per night without the pass-through tax', () => {
    const html = renderToString(
      <BookingList bookings={[booking('a', 3000, 500), booking('b', 1179.62, 0)]} onUpdate={() => {}} onDelete={() => {}} />
    )
    expect(html).toContain('Revenue/night excl. tax')
    // Entered tax: (3000 − 500) / 10 nights
    expect(html).toContain('$250.00')
    // Estimated tax: $1,179.62 is $1,000 kept plus 17.962% tax, so $100 a night
    expect(html).toContain('~<!-- -->$100.00')
  })
})
