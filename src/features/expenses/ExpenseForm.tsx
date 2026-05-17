import { useState, useEffect } from 'react'
import { MonthExpense } from '../../shared/types'

type ExpenseKey = 'cleaning' | 'support' | 'tax' | 'misc'
type RowDraft = Record<ExpenseKey, string>

interface Props {
  expenses: MonthExpense[]
  onSubmit: (year: number, month: number, values: Record<ExpenseKey, number>) => void
}

const FIELDS: { key: ExpenseKey; label: string }[] = [
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'support', label: 'Support' },
  { key: 'tax', label: 'Tax' },
  { key: 'misc', label: 'Misc' },
]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseKey(key: string) {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month: m }
}

function monthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function toDraft(e: MonthExpense): RowDraft {
  return {
    cleaning: String(e.cleaning),
    support: String(e.support),
    tax: String(e.tax),
    misc: String(e.misc),
  }
}

const zeroDraft = (): RowDraft => ({ cleaning: '0', support: '0', tax: '0', misc: '0' })

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function ExpenseForm({ expenses, onSubmit }: Props) {
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [orderedKeys, setOrderedKeys] = useState<string[]>([])

  // Merge rows arriving from Supabase without overwriting in-progress local edits
  useEffect(() => {
    setDrafts(prev => {
      const next = { ...prev }
      for (const e of expenses) {
        const key = monthKey(e.year, e.month)
        if (!(key in prev)) next[key] = toDraft(e)
      }
      return next
    })
    setOrderedKeys(prev => {
      const incoming = expenses.map(e => monthKey(e.year, e.month))
      const merged = Array.from(new Set([...prev, ...incoming])).sort()
      return merged.length === prev.length ? prev : merged
    })
  }, [expenses])

  const today = new Date()
  const [newMonth, setNewMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  )

  function setField(key: string, field: ExpenseKey, value: string) {
    setDrafts(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? zeroDraft()), [field]: value },
    }))
  }

  function save(key: string) {
    const draft = drafts[key] ?? zeroDraft()
    const { year, month } = parseKey(key)
    onSubmit(year, month, {
      cleaning: Number(draft.cleaning) || 0,
      support: Number(draft.support) || 0,
      tax: Number(draft.tax) || 0,
      misc: Number(draft.misc) || 0,
    })
  }

  function handleAddMonth() {
    const [y, m] = newMonth.split('-').map(Number)
    const key = monthKey(y, m)
    if (orderedKeys.includes(key)) return
    setOrderedKeys(prev => [...prev, key].sort())
    setDrafts(prev => ({ ...prev, [key]: zeroDraft() }))
    onSubmit(y, m, { cleaning: 0, support: 0, tax: 0, misc: 0 })
  }

  const colTotals = FIELDS.map(({ key: field }) =>
    orderedKeys.reduce((s, mk) => s + (Number(drafts[mk]?.[field]) || 0), 0)
  )
  const grandTotal = colTotals.reduce((s, v) => s + v, 0)

  return (
    <div className="expense-table">
      <h2>Monthly Expenses</h2>

      {orderedKeys.length === 0 ? (
        <p className="empty-state">No expense records yet. Add a month below.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                {FIELDS.map(({ key, label }) => <th key={key}>{label}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orderedKeys.map(key => {
                const draft = drafts[key] ?? zeroDraft()
                const { year, month } = parseKey(key)
                const rowTotal = FIELDS.reduce((s, { key: f }) => s + (Number(draft[f]) || 0), 0)
                return (
                  <tr key={key}>
                    <td>{monthLabel(year, month)}</td>
                    {FIELDS.map(({ key: field }) => (
                      <td key={field}>
                        <input
                          className="expense-input"
                          type="number"
                          min="0"
                          step="any"
                          value={draft[field]}
                          onChange={e => setField(key, field, e.target.value)}
                          onBlur={() => save(key)}
                        />
                      </td>
                    ))}
                    <td>{formatCurrency(rowTotal)}</td>
                  </tr>
                )
              })}
              <tr className="total-row">
                <td>Total</td>
                {colTotals.map((total, i) => <td key={i}>{formatCurrency(total)}</td>)}
                <td>{formatCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="expense-add-row">
        <input
          className="expense-month-picker"
          type="month"
          value={newMonth}
          onChange={e => setNewMonth(e.target.value)}
        />
        <button type="button" onClick={handleAddMonth}>+ Add Month</button>
      </div>
    </div>
  )
}
