// Fixed costs = Mortgage + HOA + Utilities.
// Dec 2023–Dec 2024: sub-breakdown unavailable; use $4,150 flat per month.
const FIXED_2023_2024 = 4150
// 2025: HOA $987.47 + Mortgage $3,148 + Utilities $180
const FIXED_2025 = 987.47 + 3148 + 180
// 2026–2027: HOA $1,100 + Mortgage $3,148.50 + Utilities $180
const FIXED_2026_2027 = 1100 + 3148.50 + 180

export function getFixedCosts(year: number, month: number): number | null {
  if (year === 2023 && month === 12) return FIXED_2023_2024
  if (year === 2024 && month >= 1 && month <= 12) return FIXED_2023_2024
  if (year === 2025 && month >= 1 && month <= 12) return FIXED_2025
  if ((year === 2026 || year === 2027) && month >= 1 && month <= 12) return FIXED_2026_2027
  return null
}

export function applyOurDaysAdjustment(fullCost: number, ourDays: number, daysInMonth: number): number {
  if (ourDays <= 0) return fullCost
  return fullCost * Math.max(0, (daysInMonth - ourDays) / daysInMonth)
}
