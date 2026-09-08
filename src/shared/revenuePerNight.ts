import { aggregateAirbnbDays } from './occupancyDays'
import { aggregateMonthlyRevenue } from './revenueDistribution'
import { Booking } from './types'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface RevenuePerNightPoint {
  key: string
  label: string
  year: number
  /** 1-12 for monthly points, null for yearly points. */
  month: number | null
  revenue: number
  nights: number
  revenuePerNight: number
}

function perNight(total: number, nights: number): number {
  return nights > 0 ? total / nights : 0
}

/**
 * Revenue per occupied night for every month that had at least one Airbnb night.
 * Booking revenue is spread across the nights it covers, so a stay that straddles
 * a month boundary contributes to both months.
 */
export function monthlyRevenuePerNight(bookings: Booking[]): RevenuePerNightPoint[] {
  const nightsByKey = new Map(
    aggregateAirbnbDays(bookings).map(entry => [
      `${entry.year}-${String(entry.month).padStart(2, '0')}`,
      entry.airbnbDays,
    ])
  )

  const points: RevenuePerNightPoint[] = []

  for (const entry of aggregateMonthlyRevenue(bookings)) {
    const key = `${entry.year}-${String(entry.month).padStart(2, '0')}`
    const nights = nightsByKey.get(key) ?? 0
    if (nights <= 0) continue

    points.push({
      key,
      label: `${MONTH_NAMES[entry.month - 1]} ${String(entry.year).slice(2)}`,
      year: entry.year,
      month: entry.month,
      revenue: entry.revenue,
      nights,
      revenuePerNight: perNight(entry.revenue, nights),
    })
  }

  return points
}

/** Revenue per occupied night rolled up to one point per year. */
export function yearlyRevenuePerNight(bookings: Booking[]): RevenuePerNightPoint[] {
  const byYear = new Map<number, RevenuePerNightPoint>()

  for (const point of monthlyRevenuePerNight(bookings)) {
    const existing = byYear.get(point.year)
    if (existing) {
      existing.revenue += point.revenue
      existing.nights += point.nights
    } else {
      byYear.set(point.year, {
        key: String(point.year),
        label: String(point.year),
        year: point.year,
        month: null,
        revenue: point.revenue,
        nights: point.nights,
        revenuePerNight: 0,
      })
    }
  }

  return Array.from(byYear.values())
    .sort((a, b) => a.year - b.year)
    .map(point => ({
      ...point,
      revenuePerNight: perNight(point.revenue, point.nights),
    }))
}
