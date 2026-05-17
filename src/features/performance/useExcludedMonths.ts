import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function useExcludedMonths() {
  const [excludedMonths, setExcludedMonths] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase
      .from('excluded_months')
      .select('month_key')
      .eq('excluded', true)
      .then(({ data, error }) => {
        if (!error && data) setExcludedMonths(new Set(data.map((r: { month_key: string }) => r.month_key)))
      })
  }, [])

  function toggleExclude(key: string) {
    const nowExcluded = !excludedMonths.has(key)
    setExcludedMonths(prev => {
      const next = new Set(prev)
      nowExcluded ? next.add(key) : next.delete(key)
      return next
    })
    supabase
      .from('excluded_months')
      .upsert({ month_key: key, excluded: nowExcluded }, { onConflict: 'month_key' })
  }

  return { excludedMonths, toggleExclude }
}
