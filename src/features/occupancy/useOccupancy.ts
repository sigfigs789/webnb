import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export interface OccupancyEntry {
  year: number
  month: number
  kindredDays: number
  ourDays: number
}

export function useOccupancy() {
  const [entries, setEntries] = useState<OccupancyEntry[]>([])

  useEffect(() => {
    supabase
      .from('occupancy')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data) setEntries(data.map(toEntry))
      })
  }, [])

  async function setEntry(year: number, month: number, updates: { kindredDays?: number; ourDays?: number }) {
    const existing = entries.find(e => e.year === year && e.month === month)
    const merged = { kindredDays: 0, ourDays: 0, ...existing, ...updates }

    const { data, error } = await supabase
      .from('occupancy')
      .upsert([{ year, month, kindred_days: merged.kindredDays, our_days: merged.ourDays }], {
        onConflict: 'year,month',
      })
      .select()
      .single()

    if (!error && data) {
      const updated = toEntry(data)
      setEntries(prev => {
        const idx = prev.findIndex(e => e.year === year && e.month === month)
        if (idx >= 0) return prev.map((e, i) => (i === idx ? updated : e))
        return [...prev, updated]
      })
    }
  }

  return { entries, setEntry }
}

function toEntry(row: Record<string, unknown>): OccupancyEntry {
  return {
    year: row.year as number,
    month: row.month as number,
    kindredDays: row.kindred_days as number,
    ourDays: row.our_days as number,
  }
}
