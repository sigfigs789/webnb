export const EXPECTED_VAR_COST = {
  cleaning: 360,
  support: 150,
  misc: 200,
}

// The month-based schedule below applies to expected costs from this month onward.
// Earlier months keep the flat base amounts (and any actuals already recorded).
export const SCHEDULE_START = { year: 2026, month: 10 }

// Support is only expected in these months; it is $0 in every other month.
export const SUPPORT_MONTHS = [12, 1, 6, 8]

// Months with a deep cleaning, which replaces the regular expected cleaning cost.
export const DEEP_CLEANING_MONTHS = [1, 6]
export const DEEP_CLEANING_COST = 550

export function isScheduleActive(year: number, month: number) {
  return (
    year > SCHEDULE_START.year ||
    (year === SCHEDULE_START.year && month >= SCHEDULE_START.month)
  )
}

export function isSupportMonth(month: number) {
  return SUPPORT_MONTHS.includes(month)
}

export function isDeepCleaningMonth(month: number) {
  return DEEP_CLEANING_MONTHS.includes(month)
}

interface VarCostBase {
  cleaning: number
  support: number
  misc: number
}

// Applies the month-based schedule (deep cleanings, support months) to base amounts.
// Months before SCHEDULE_START are left on the flat base amounts.
export function resolveExpectedForMonth(year: number, month: number, base: VarCostBase): VarCostBase {
  if (!isScheduleActive(year, month)) return { ...base }
  return {
    cleaning: isDeepCleaningMonth(month) ? DEEP_CLEANING_COST : base.cleaning,
    support: isSupportMonth(month) ? base.support : 0,
    misc: base.misc,
  }
}

export function getExpectedVarCost(year: number, month: number) {
  return resolveExpectedForMonth(year, month, EXPECTED_VAR_COST)
}

export function getExpectedVarTotal(year: number, month: number) {
  return Object.values(getExpectedVarCost(year, month)).reduce((s, v) => s + v, 0)
}
