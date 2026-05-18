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

  async function upsertTax(year: number, month: number, amount: number) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    setActualTaxes(prev => ({ ...prev, [key]: amount }))
    await supabase
      .from('actual_taxes')
      .upsert({ year, month, amount }, { onConflict: 'year,month' })
  }

  return { actualTaxes, loading, upsertTax }
}
