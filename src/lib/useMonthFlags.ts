import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Per-month boolean flags live in single-purpose tables shaped as
// (month_key text primary key, <flag> boolean, updated_at timestamptz), one
// table per flag per tab. The column is named after the flag it holds.
export type MonthFlag = 'excluded' | 'prorated' | 'variable_only'
export type FlagTables = Partial<Record<MonthFlag, string>>

// A month gets at most one flag: they are three different answers to how the
// month counts, so setting one clears the others. Nothing at the database level
// enforces that across separate tables, so a month found in more than one is
// read in this order and the rest ignored.
const FLAG_PRECEDENCE: MonthFlag[] = ['excluded', 'prorated', 'variable_only']

export function useMonthFlags(tables: FlagTables, defaults?: Map<string, MonthFlag>) {
  const fallback = defaults ?? new Map<string, MonthFlag>()
  const [flagByMonth, setFlagByMonth] = useState<Map<string, MonthFlag>>(new Map(fallback))

  useEffect(() => {
    const flags = FLAG_PRECEDENCE.filter(flag => tables[flag])
    Promise.all(
      flags.map(flag => supabase.from(tables[flag]!).select('*'))
    ).then(results => {
      const result = new Map(fallback)
      // Later flags never overwrite an earlier one, so precedence holds.
      const claimed = new Set<string>()
      flags.forEach((flag, i) => {
        const { data, error } = results[i]
        if (error || !data) return
        for (const row of data as unknown as Record<string, unknown>[]) {
          const key = row.month_key as string
          if (claimed.has(key)) continue
          if (row[flag]) {
            result.set(key, flag)
            claimed.add(key)
          } else if (result.get(key) === flag) {
            result.delete(key)
          }
        }
      })
      setFlagByMonth(result)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables])

  function write(key: string, flag: MonthFlag, value: boolean) {
    return supabase
      .from(tables[flag]!)
      .upsert({ month_key: key, [flag]: value }, { onConflict: 'month_key' })
  }

  // Clicking the flag a month already has clears it; any other flag replaces it,
  // which means clearing the old flag's row as well as setting the new one.
  async function toggle(key: string, flag: MonthFlag) {
    if (!tables[flag]) return
    const previous = flagByMonth.get(key) ?? null
    const next = previous === flag ? null : flag
    setFlagByMonth(prev => {
      const updated = new Map(prev)
      if (next) updated.set(key, next)
      else updated.delete(key)
      return updated
    })
    const writes = []
    if (previous && previous !== next && tables[previous]) writes.push(write(key, previous, false))
    if (next) writes.push(write(key, next, true))
    await Promise.all(writes)
  }

  function monthsWith(flag: MonthFlag): Set<string> {
    const keys = new Set<string>()
    for (const [key, value] of flagByMonth) if (value === flag) keys.add(key)
    return keys
  }

  return {
    excludedMonths: monthsWith('excluded'),
    proratedMonths: monthsWith('prorated'),
    variableOnlyMonths: monthsWith('variable_only'),
    toggleFlag: toggle,
  }
}
