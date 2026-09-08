import { useMonthFlags } from '../../lib/useMonthFlags'

// Skipped months are left out of the YTD running totals.
const DEFAULT_EXCLUDED = new Set(['2024-10', '2024-11'])

export function useExcludedMonths() {
  const { flagged, toggle } = useMonthFlags('excluded_months', 'excluded', DEFAULT_EXCLUDED)
  return { excludedMonths: flagged, toggleExclude: toggle }
}
