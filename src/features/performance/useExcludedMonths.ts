import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const DEFAULT_EXCLUDED = new Set(['2024-10', '2024-11'])

export function useExcludedMonths() {
  const [excludedMonths, setExcludedMonths] = useState<Set<string>>(new Set(DEFAULT_EXCLUDED))

  useEffect(() => {
    supabase
      .from('excluded_months')
      .select('month_key, excluded')
      .then(({ data, error }) => {
        if (!error && data) {
          const result = new Set(DEFAULT_EXCLUDED)
          for (const r of data as { month_key: string; excluded: boolean }[]) {
            if (r.excluded) result.add(r.month_key)
            else result.delete(r.month_key)
          }
          setExcludedMonths(result)
        }
      })
  }, [])

  async function toggleExclude(key: string) {
    const nowExcluded = !excludedMonths.has(key)
    setExcludedMonths(prev => {
      const next = new Set(prev)
      if (nowExcluded) next.add(key)
      else next.delete(key)
      return next
    })
    await supabase
      .from('excluded_months')
      .upsert({ month_key: key, excluded: nowExcluded }, { onConflict: 'month_key' })
  }

  return { excludedMonths, toggleExclude }
}
