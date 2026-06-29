import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { MonthExpense } from '../../shared/types'
import { allPrincipalMonths } from '../../shared/principalGained'

type ExpectedExpenseValues = Pick<MonthExpense, 'cleaning' | 'support' | 'misc'>

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

  async function updateFutureExpectedExpenses(values: ExpectedExpenseValues) {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const existingByMonth = new Map(expenses.map(e => [`${e.year}-${e.month}`, e]))
    const rows = allPrincipalMonths()
      .filter(({ year, month }) => year > currentYear || (year === currentYear && month >= currentMonth))
      .map(({ year, month }) => {
        const existing = existingByMonth.get(`${year}-${month}`)
        return {
          year,
          month,
          cleaning: values.cleaning,
          support: values.support,
          misc: values.misc,
          tax: existing?.tax ?? 0,
        }
      })

    if (!rows.length) return

    const { data, error } = await supabase
      .from('expenses')
      .upsert(rows, { onConflict: 'year,month' })
      .select()

    if (error) throw error
    if (!data) return

    setExpenses(prev => {
      const next = new Map(prev.map(e => [`${e.year}-${e.month}`, e]))
      for (const row of data) {
        const expense = toExpense(row)
        next.set(`${expense.year}-${expense.month}`, expense)
      }
      return Array.from(next.values()).sort((a, b) =>
        a.year !== b.year ? a.year - b.year : a.month - b.month
      )
    })
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) setExpenses(prev => prev.filter(e => e.id !== id))
  }

  return { expenses, loading, setExpense, updateFutureExpectedExpenses, deleteExpense }
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
