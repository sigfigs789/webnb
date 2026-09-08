import { useMonthFlags, MonthFlag, FlagTables } from '../../lib/useMonthFlags'

// The Performance tab keeps its own flags, independent of the Expenses tab's —
// flagging a month in one view never affects the other. A month carries at most
// one flag: S skips it from the YTD totals, P prorates its fixed costs by
// owner-use days, V counts every cost except the fixed ones.
const TABLES: FlagTables = {
  excluded: 'excluded_months',
  prorated: 'prorated_months',
  variable_only: 'variable_only_months',
}

const DEFAULT_FLAGS = new Map<string, MonthFlag>([
  ['2024-10', 'excluded'],
  ['2024-11', 'excluded'],
])

export function usePerformanceMonthFlags() {
  return useMonthFlags(TABLES, DEFAULT_FLAGS)
}
