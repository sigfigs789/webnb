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
    // 5700 / (1 + 13% + 17.962%)
    expect(html).toContain('$4,352.41')
  })
})
