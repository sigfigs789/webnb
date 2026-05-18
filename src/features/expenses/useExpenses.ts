import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { MonthExpense } from '../../shared/types'

export function useExpenses() {
  const [expenses, setExpenses] = useState<MonthExpense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('expenses')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data) setExpenses(data.map(toExpense))
        setLoading(false)
      })
  }, [])

  async function setExpense(
    year: number,
    month: number,
    values: Omit<MonthExpense, 'id' | 'year' | 'month'>
  ) {
    const { data, error } = await supabase
      .from('expenses')
      .upsert([{ year, month, ...values }], { onConflict: 'year,month' })
      .select()
      .single()
    if (!error && data) {
      setExpenses(prev => {
        const exists = prev.find(e => e.year === year && e.month === month)
        if (exists) return prev.map(e => (e.year === year && e.month === month ? toExpense(data) : e))
        return [...prev, toExpense(data)]
      })
    }
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) setExpenses(prev => prev.filter(e => e.id !== id))
  }

  return { expenses, loading, setExpense, deleteExpense }
}

function toExpense(row: Record<string, unknown>): MonthExpense {
  return {
    id: row.id as string,
    year: row.year as number,
    month: row.month as number,
    cleaning: row.cleaning as number,
    support: row.support as number,
    tax: row.tax as number,
    misc: row.misc as number,
  }
}
