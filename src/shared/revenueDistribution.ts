import { Booking, MonthlyRevenue } from './types'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function distributeRevenue(booking: Booking): MonthlyRevenue[] {
  const start = parseDate(booking.startDate)
  const end = parseDate(booking.endDate)
  const totalDays = daysBetween(start, end)
  if (totalDays <= 0) return []

  const dailyRate = booking.revenue / totalDays
  const result: MonthlyRevenue[] = []
  let cursor = start

  while (cursor < end) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth()
    const nextMonthStart = new Date(Date.UTC(year, month + 1, 1))
    const rangeEnd = nextMonthStart < end ? nextMonthStart : end
    const days = daysBetween(cursor, rangeEnd)

    result.push({
      year,
      month: month + 1,
      label: `${MONTH_NAMES[month]} ${year}`,
      revenue: days * dailyRate,
    })

    cursor = nextMonthStart
  }

  return result
}

export function aggregateMonthlyRevenue(bookings: Booking[]): MonthlyRevenue[] {
  const map = new Map<string, MonthlyRevenue>()

  for (const booking of bookings) {
    for (const entry of distributeRevenue(booking)) {
      const key = `${entry.year}-${String(entry.month).padStart(2, '0')}`
      const existing = map.get(key)
      if (existing) {
        existing.revenue += entry.revenue
      } else {
        map.set(key, { ...entry })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  )
}
