// Fixed costs = Mortgage + HOA + Utilities.
// Dec 2023–Dec 2024: sub-breakdown unavailable; use $4,150 flat per month.
const FIXED_2023_2024 = 4150

export function getFixedCosts(year: number, month: number): number | null {
  if (year === 2023 && month === 12) return FIXED_2023_2024
  if (year === 2024 && month >= 1 && month <= 12) return FIXED_2023_2024
  return null
}
