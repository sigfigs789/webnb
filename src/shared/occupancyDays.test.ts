import { describe, it, expect } from 'vitest'
import { aggregateAirbnbDays, fillMonthGaps } from './occupancyDays'
import { Booking } from './types'

function booking(startDate: string, endDate: string): Booking {
  return {
    id: '1',
    name: 'Test',
    revenue: 1000,
    passThroughTax: 0,
    bookingDate: startDate,
    startDate,
    endDate,
  }
}

describe('aggregateAirbnbDays', () => {
  it('returns empty array for no bookings', () => {
    expect(aggregateAirbnbDays([])).toHaveLength(0)
  })

  it('skips bookings where end equals start', () => {
    expect(aggregateAirbnbDays([booking('2024-06-01', '2024-06-01')])).toHaveLength(0)
  })

  it('skips bookings where end is before start', () => {
    expect(aggregateAirbnbDays([booking('2024-06-15', '2024-06-01')])).toHaveLength(0)
  })

  it('counts days correctly for a single-month booking', () => {
    // June 1–30: 29 nights (start inclusive, end exclusive)
    const result = aggregateAirbnbDays([booking('2024-06-01', '2024-06-30')])
    expect(result).toHaveLength(1)
    expect(result[0].year).toBe(2024)
    expect(result[0].month).toBe(6)
    expect(result[0].airbnbDays).toBe(29)
    expect(result[0].daysInMonth).toBe(30)
  })

  it('splits days correctly across two months', () => {
    // Jan 17 – Feb 16: 15 days in Jan, 15 days in Feb
    const result = aggregateAirbnbDays([booking('2024-01-17', '2024-02-16')])
    const jan = result.find(r => r.month === 1)!
    const feb = result.find(r => r.month === 2)!
    expect(jan.airbnbDays).toBe(15)
    expect(feb.airbnbDays).toBe(15)
  })

  it('accumulates days from two bookings in the same month', () => {
    const b1 = booking('2024-06-01', '2024-06-11') // 10 days
    const b2 = booking('2024-06-15', '2024-06-25') // 10 days
    const result = aggregateAirbnbDays([b1, b2])
    const june = result.find(r => r.month === 6)!
    expect(june.airbnbDays).toBe(20)
  })

  it('returns daysInMonth correctly for a leap-year February', () => {
    const result = aggregateAirbnbDays([booking('2024-02-01', '2024-02-29')])
    expect(result[0].daysInMonth).toBe(29)
    expect(result[0].airbnbDays).toBe(28)
  })

  it('returns daysInMonth correctly for a non-leap-year February', () => {
    const result = aggregateAirbnbDays([booking('2025-02-01', '2025-02-28')])
    expect(result[0].daysInMonth).toBe(28)
    expect(result[0].airbnbDays).toBe(27)
  })

  it('returns results sorted by year then month', () => {
    const result = aggregateAirbnbDays([
      booking('2025-03-01', '2025-03-31'),
      booking('2024-11-01', '2024-11-30'),
    ])
    expect(result[0].year).toBe(2024)
    expect(result[0].month).toBe(11)
    expect(result[1].year).toBe(2025)
    expect(result[1].month).toBe(3)
  })
})

describe('fillMonthGaps', () => {
  it('returns empty array when there is nothing to fill', () => {
    expect(fillMonthGaps([], [])).toHaveLength(0)
  })

  it('inserts a row for a month with no bookings', () => {
    // Nov 2024 had no Airbnb nights, but 28 Kindred days.
    const months = aggregateAirbnbDays([
      booking('2024-10-01', '2024-10-02'),
      booking('2024-12-01', '2024-12-02'),
    ])
    const filled = fillMonthGaps(months)

    expect(filled.map(m => m.label)).toEqual(['Oct 2024', 'Nov 2024', 'Dec 2024'])
    const nov = filled[1]
    expect(nov.airbnbDays).toBe(0)
    expect(nov.daysInMonth).toBe(30)
  })

  it('spans year boundaries and uses correct day counts', () => {
    const filled = fillMonthGaps(
      aggregateAirbnbDays([booking('2023-12-01', '2023-12-02'), booking('2024-03-01', '2024-03-02')])
    )
    expect(filled.map(m => m.label)).toEqual(['Dec 2023', 'Jan 2024', 'Feb 2024', 'Mar 2024'])
    expect(filled[2].daysInMonth).toBe(29) // leap year
  })

  it('extends the range to cover occupancy-only months', () => {
    const months = aggregateAirbnbDays([booking('2025-06-01', '2025-06-02')])
    const filled = fillMonthGaps(months, [
      { year: 2025, month: 4 },
      { year: 2025, month: 8 },
    ])
    expect(filled.map(m => m.label)).toEqual([
      'Apr 2025',
      'May 2025',
      'Jun 2025',
      'Jul 2025',
      'Aug 2025',
    ])
  })

  it('preserves booking data for months that have it', () => {
    const months = aggregateAirbnbDays([booking('2024-06-01', '2024-06-30')])
    expect(fillMonthGaps(months)).toEqual(months)
  })
})
