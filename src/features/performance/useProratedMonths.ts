import { useMonthFlags } from '../../lib/useMonthFlags'

// Prorated months scale fixed costs down by the owner-use days recorded in the
// occupancy table. Off by default: fixed costs are flat unless a month opts in.
export function useProratedMonths() {
  const { flagged, toggle } = useMonthFlags('prorated_months', 'prorated')
  return { proratedMonths: flagged, toggleProrate: toggle }
}
