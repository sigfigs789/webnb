import { describe, it, expect } from 'vitest'
import { monthlyRevenuePerNight, yearlyRevenuePerNight } from './revenuePerNight'
import { Booking } from './types'

function booking(id: string, startDate: string, endDate: string, revenue: number): Booking {
  return { id, name: `Booking ${id}`, revenue, passThroughTax: 0, bookingDate: startDate, startDate, endDate }
}

// Pass-through tax is guest money remitted onward, so it must not move the nightly rate
function bookingWithTax(revenue: number, passThroughTax: number): Booking {
  return { ...booking('tax', '2024-06-01', '2024-06-05', revenue), passThroughTax }
}

describe('monthlyRevenuePerNight', () => {
  it('returns no points without bookings', () => {
    expect(monthlyRevenuePerNight([])).toHaveLength(0)
  })

  it('divides a single booking revenue by its nights', () => {
    const points = monthlyRevenuePerNight([booking('1', '2024-06-01', '2024-06-05', 800)])
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ key: '2024-06', label: 'Jun 24', year: 2024, month: 6, nights: 4 })
    expect(points[0].revenuePerNight).toBeCloseTo(200)
  })

  it('ignores pass-through tax when computing the nightly rate', () => {
    const points = monthlyRevenuePerNight([bookingWithTax(800, 200)])
    expect(points[0].revenuePerNight).toBeCloseTo(200)
  })

  it('splits a booking that straddles a month boundary', () => {
    const points = monthlyRevenuePerNight([booking('1', '2024-06-28', '2024-07-03', 500)])
    expect(points.map(p => p.key)).toEqual(['2024-06', '2024-07'])
    expect(points[0].nights).toBe(3)
    expect(points[1].nights).toBe(2)
    expect(points[0].revenuePerNight).toBeCloseTo(100)
    expect(points[1].revenuePerNight).toBeCloseTo(100)
  })

  it('blends overlapping bookings within the same month', () => {
    const points = monthlyRevenuePerNight([
      booking('1', '2024-06-01', '2024-06-05', 800), // 4 nights at 200
      booking('2', '2024-06-10', '2024-06-12', 200), // 2 nights at 100
    ])
    expect(points).toHaveLength(1)
    expect(points[0].nights).toBe(6)
    expect(points[0].revenuePerNight).toBeCloseTo(1000 / 6)
  })

  it('ignores zero and negative length bookings', () => {
    expect(monthlyRevenuePerNight([booking('1', '2024-06-05', '2024-06-05', 500)])).toHaveLength(0)
    expect(monthlyRevenuePerNight([booking('2', '2024-06-15', '2024-06-01', 500)])).toHaveLength(0)
  })

  it('orders points chronologically across years', () => {
    const points = monthlyRevenuePerNight([
      booking('1', '2025-02-01', '2025-02-03', 300),
      booking('2', '2023-11-01', '2023-11-03', 300),
      booking('3', '2024-05-01', '2024-05-03', 300),
    ])
    expect(points.map(p => p.key)).toEqual(['2023-11', '2024-05', '2025-02'])
  })
})

describe('yearlyRevenuePerNight', () => {
  it('returns no points without bookings', () => {
    expect(yearlyRevenuePerNight([])).toHaveLength(0)
  })

  it('weights each year by its nights rather than averaging months', () => {
    const points = yearlyRevenuePerNight([
      booking('1', '2024-01-01', '2024-01-03', 200), // 2 nights at 100
      booking('2', '2024-07-01', '2024-07-11', 3000), // 10 nights at 300
    ])
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ key: '2024', label: '2024', year: 2024, month: null, nights: 12 })
    expect(points[0].revenuePerNight).toBeCloseTo(3200 / 12)
  })

  it('keeps years separate and sorted, splitting a new-year booking', () => {
    const points = yearlyRevenuePerNight([
      booking('1', '2025-06-01', '2025-06-03', 400),
      booking('2', '2023-12-30', '2024-01-02', 300),
    ])
    expect(points.map(p => p.year)).toEqual([2023, 2024, 2025])
    expect(points[0].nights).toBe(2)
    expect(points[1].nights).toBe(1)
    expect(points[2].revenuePerNight).toBeCloseTo(200)
  })

  it('ignores pass-through tax in the yearly rollup', () => {
    const points = yearlyRevenuePerNight([bookingWithTax(800, 400)])
    expect(points[0].revenuePerNight).toBeCloseTo(200)
  })
})
