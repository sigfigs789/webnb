import { Booking } from './types'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export interface MonthAirbnbDays {
  year: number
  month: number
  label: string
  airbnbDays: number
  daysInMonth: number
}

export function aggregateAirbnbDays(bookings: Booking[]): MonthAirbnbDays[] {
  const map = new Map<string, MonthAirbnbDays>()

  for (const booking of bookings) {
    const start = parseDate(booking.startDate)
    const end = parseDate(booking.endDate)
    if (end <= start) continue

    let cursor = start
    while (cursor < end) {
      const year = cursor.getUTCFullYear()
      const month = cursor.getUTCMonth() // 0-indexed
      const nextMonthStart = new Date(Date.UTC(year, month + 1, 1))
      const rangeEnd = nextMonthStart < end ? nextMonthStart : end
      const days = daysBetween(cursor, rangeEnd)
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      const existing = map.get(key)
      if (existing) {
        existing.airbnbDays += days
      } else {
        map.set(key, {
          year,
          month: month + 1,
          label: `${MONTH_NAMES[month]} ${year}`,
          airbnbDays: days,
          daysInMonth,
        })
      }
      cursor = nextMonthStart
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  )
}
