import { useMonthFlags } from '../../lib/useMonthFlags'

// The Expenses tab keeps its own skip/prorate flags, independent of the
// Performance tab's — flagging a month in one view never affects the other.

// Skipped months are left out of the Expenses tab's column, year, and grand totals.
export function useExpenseExcludedMonths() {
  const { flagged, toggle } = useMonthFlags('expense_excluded_months', 'excluded')
  return { excludedMonths: flagged, toggleExclude: toggle }
}

// Prorated months scale fixed costs down by the owner-use days recorded in the
// occupancy table. Off by default: fixed costs are flat unless a month opts in.
export function useExpenseProratedMonths() {
  const { flagged, toggle } = useMonthFlags('expense_prorated_months', 'prorated')
  return { proratedMonths: flagged, toggleProrate: toggle }
}
