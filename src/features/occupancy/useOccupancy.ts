import { useState } from 'react'

const STORAGE_KEY = 'webnb-occupancy'

type OccupancyData = Record<string, { kindredDays: number; ourDays: number }>

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function useOccupancy() {
  const [data, setData] = useState<OccupancyData>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  function getEntry(year: number, month: number) {
    return data[monthKey(year, month)] ?? { kindredDays: 0, ourDays: 0 }
  }

  function setEntry(year: number, month: number, updates: { kindredDays?: number; ourDays?: number }) {
    const key = monthKey(year, month)
    setData(prev => {
      const current = prev[key] ?? { kindredDays: 0, ourDays: 0 }
      const next = { ...prev, [key]: { ...current, ...updates } }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  return { getEntry, setEntry }
}
