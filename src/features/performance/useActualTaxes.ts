import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function useActualTaxes() {
  const [actualTaxes, setActualTaxes] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('actual_taxes')
      .select('year, month, amount')
      .then(({ data, error }) => {
        if (!error && data) {
          const map: Record<string, number> = {}
          data.forEach((r: { year: number; month: number; amount: number }) => {
            map[`${r.year}-${String(r.month).padStart(2, '0')}`] = r.amount
          })
          setActualTaxes(map)
        }
        setLoading(false)
      })
  }, [])

  return { actualTaxes, loading }
}
