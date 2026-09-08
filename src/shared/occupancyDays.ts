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

function emptyMonth(year: number, month: number): MonthAirbnbDays {
  return {
    year,
    month,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    airbnbDays: 0,
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
  }
}

/**
 * Returns a contiguous month-by-month series so months with no Airbnb bookings
 * (but which may still have Kindred or Our days) get a row instead of vanishing.
 * The range spans the earliest to the latest month across `months` and `extra`.
 */
export function fillMonthGaps(
  months: MonthAirbnbDays[],
  extra: { year: number; month: number }[] = []
): MonthAirbnbDays[] {
  const all = [...months, ...extra]
  if (all.length === 0) return []

  const ordinal = (m: { year: number; month: number }) => m.year * 12 + (m.month - 1)
  const known = new Map(months.map(m => [ordinal(m), m]))
  const ordinals = all.map(ordinal)

  const result: MonthAirbnbDays[] = []
  for (let o = Math.min(...ordinals); o <= Math.max(...ordinals); o++) {
    result.push(known.get(o) ?? emptyMonth(Math.floor(o / 12), (o % 12) + 1))
  }
  return result
}
