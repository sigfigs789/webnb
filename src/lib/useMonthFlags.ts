import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Per-month boolean flags live in single-purpose tables shaped as
// (month_key text primary key, <flagColumn> boolean, updated_at timestamptz).
export function useMonthFlags(table: string, flagColumn: string, defaults?: Set<string>) {
  const fallback = defaults ?? new Set<string>()
  const [flagged, setFlagged] = useState<Set<string>>(new Set(fallback))

  useEffect(() => {
    supabase
      .from(table)
      .select('*')
      .then(({ data, error }) => {
        if (!error && data) {
          const result = new Set(fallback)
          for (const row of data as unknown as Record<string, unknown>[]) {
            const key = row.month_key as string
            if (row[flagColumn]) result.add(key)
            else result.delete(key)
          }
          setFlagged(result)
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, flagColumn])

  async function toggle(key: string) {
    const nowSet = !flagged.has(key)
    setFlagged(prev => {
      const next = new Set(prev)
      if (nowSet) next.add(key)
      else next.delete(key)
      return next
    })
    await supabase
      .from(table)
      .upsert({ month_key: key, [flagColumn]: nowSet }, { onConflict: 'month_key' })
  }

  return { flagged, toggle }
}
