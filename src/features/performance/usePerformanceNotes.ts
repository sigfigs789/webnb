import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export function usePerformanceNotes() {
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase
      .from('performance_notes')
      .select('month_key, note_text')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {}
          data.forEach((r: { month_key: string; note_text: string }) => {
            if (r.note_text) map[r.month_key] = r.note_text
          })
          setNotes(map)
        }
      })
  }, [])

  function saveNote(key: string, text: string) {
    const trimmed = text.trim()
    setNotes(prev => {
      const next = { ...prev }
      if (trimmed) next[key] = trimmed
      else delete next[key]
      return next
    })
    supabase
      .from('performance_notes')
      .upsert({ month_key: key, note_text: trimmed }, { onConflict: 'month_key' })
  }

  return { notes, saveNote }
}
