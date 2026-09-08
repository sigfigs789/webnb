import { useMonthFlags, FlagTables } from '../../lib/useMonthFlags'

// The Expenses tab keeps its own flags, independent of the Performance tab's.
// A month carries at most one: S skips it from the totals, P prorates its fixed
// costs by owner-use days, V counts every cost except the fixed ones.
const TABLES: FlagTables = {
  excluded: 'expense_excluded_months',
  prorated: 'expense_prorated_months',
  variable_only: 'expense_variable_only_months',
}

export function useExpenseMonthFlags() {
  return useMonthFlags(TABLES)
}
