const START = 2023 * 12 + 12 // December 2023
const END = 2027 * 12 + 12   // December 2027
const BASE = 593
const STEP = 2.86

export function getPrincipalGained(year: number, month: number): number | null {
  const index = year * 12 + month - START
  if (index < 0 || year * 12 + month > END) return null
  return parseFloat((BASE + index * STEP).toFixed(2))
}

export function allPrincipalMonths(): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = []
  let year = 2023, month = 12
  while (year < 2027 || (year === 2027 && month <= 12)) {
    months.push({ year, month })
    month++
    if (month > 12) { month = 1; year++ }
  }
  return months
}
