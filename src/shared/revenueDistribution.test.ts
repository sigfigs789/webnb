import { describe, it, expect } from 'vitest'
import { distributeRevenue, aggregateMonthlyRevenue } from './revenueDistribution'
import { Booking } from './types'

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: '1',
    name: 'Test',
    revenue: 3000,
    passThroughTax: 0,
    bookingDate: '2024-01-01',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    ...overrides,
  }
}

describe('distributeRevenue', () => {
  it('returns empty array when start equals end', () => {
    const result = distributeRevenue(booking({ startDate: '2024-01-01', endDate: '2024-01-01' }))
    expect(result).toHaveLength(0)
  })

  it('returns empty array when end is before start', () => {
    const result = distributeRevenue(booking({ startDate: '2024-01-15', endDate: '2024-01-01' }))
    expect(result).toHaveLength(0)
  })

  it('places all revenue in one month for a single-month booking', () => {
    const result = distributeRevenue(booking({ startDate: '2024-03-01', endDate: '2024-03-31', revenue: 3100 }))
    expect(result).toHaveLength(1)
    expect(result[0].year).toBe(2024)
    expect(result[0].month).toBe(3)
    expect(result[0].revenue).toBeCloseTo(3100, 2)
  })

  it('splits revenue proportionally across two months', () => {
    // 15 days in Jan, 15 days in Feb = 30 total
    const result = distributeRevenue(booking({
      startDate: '2024-01-17',
      endDate: '2024-02-16',
      revenue: 3000,
    }))
    expect(result).toHaveLength(2)
    const jan = result.find(r => r.month === 1)!
    const feb = result.find(r => r.month === 2)!
    expect(jan.revenue + feb.revenue).toBeCloseTo(3000, 2)
    expect(jan.revenue).toBeCloseTo(feb.revenue, 2) // equal split
  })

  it('spreads revenue across three months', () => {
    const result = distributeRevenue(booking({
      startDate: '2024-01-01',
      endDate: '2024-03-31',
      revenue: 6000,
    }))
    expect(result).toHaveLength(3)
    const total = result.reduce((s, r) => s + r.revenue, 0)
    expect(total).toBeCloseTo(6000, 2)
  })

  it('deducts passThroughTax from netRevenue proportionally', () => {
    const result = distributeRevenue(booking({
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      revenue: 3000,
      passThroughTax: 600,
    }))
    expect(result[0].netRevenue).toBeCloseTo(2400, 2)
  })

  it('zero passThroughTax means revenue equals netRevenue', () => {
    const result = distributeRevenue(booking({
      startDate: '2024-05-01',
      endDate: '2024-05-31',
      revenue: 4000,
      passThroughTax: 0,
    }))
    expect(result[0].revenue).toBeCloseTo(result[0].netRevenue, 2)
  })
})

describe('aggregateMonthlyRevenue', () => {
  it('returns empty array for no bookings', () => {
    expect(aggregateMonthlyRevenue([])).toHaveLength(0)
  })

  it('sums revenue for two bookings in the same month', () => {
    const b1 = booking({ startDate: '2024-06-01', endDate: '2024-06-16', revenue: 1500 })
    const b2 = booking({ startDate: '2024-06-16', endDate: '2024-06-30', revenue: 1400 })
    const result = aggregateMonthlyRevenue([b1, b2])
    const june = result.find(r => r.month === 6)!
    expect(june.revenue).toBeCloseTo(2900, 1)
  })

  it('keeps bookings in different months separate', () => {
    const b1 = booking({ startDate: '2024-01-01', endDate: '2024-01-31', revenue: 3000 })
    const b2 = booking({ startDate: '2024-02-01', endDate: '2024-02-29', revenue: 2800 })
    const result = aggregateMonthlyRevenue([b1, b2])
    expect(result).toHaveLength(2)
  })

  it('returns results sorted by year then month', () => {
    const b1 = booking({ startDate: '2025-03-01', endDate: '2025-03-31', revenue: 1000 })
    const b2 = booking({ startDate: '2024-11-01', endDate: '2024-11-30', revenue: 1000 })
    const result = aggregateMonthlyRevenue([b1, b2])
    expect(result[0].year).toBe(2024)
    expect(result[0].month).toBe(11)
    expect(result[1].year).toBe(2025)
    expect(result[1].month).toBe(3)
  })
})
