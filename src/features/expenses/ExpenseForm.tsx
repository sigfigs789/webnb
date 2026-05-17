import { useState, useEffect } from 'react'
import { MonthExpense } from '../../shared/types'

interface ExpenseValues {
  cleaning: number
  support: number
  tax: number
  misc: number
}

interface Props {
  expenses: MonthExpense[]
  onSubmit: (year: number, month: number, values: ExpenseValues) => void
}

const EXPENSE_FIELDS: { key: keyof ExpenseValues; label: string }[] = [
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'support', label: 'Support' },
  { key: 'tax', label: 'Tax' },
  { key: 'misc', label: 'Misc' },
]

const emptyValues = { cleaning: '', support: '', tax: '', misc: '' }
type RawValues = Record<keyof ExpenseValues, string>

function toMonthString(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseMonthString(s: string): { year: number; month: number } {
  const [y, m] = s.split('-').map(Number)
  return { year: y, month: m }
}

export function ExpenseForm({ expenses, onSubmit }: Props) {
  const today = new Date()
  const defaultMonth = toMonthString(today.getFullYear(), today.getMonth() + 1)

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const [values, setValues] = useState<RawValues>(emptyValues)

  useEffect(() => {
    const { year, month } = parseMonthString(selectedMonth)
    const existing = expenses.find(e => e.year === year && e.month === month)
    if (existing) {
      setValues({
        cleaning: String(existing.cleaning),
        support: String(existing.support),
        tax: String(existing.tax),
        misc: String(existing.misc),
      })
    } else {
      setValues(emptyValues)
    }
  }, [selectedMonth, expenses])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { year, month } = parseMonthString(selectedMonth)
    onSubmit(year, month, {
      cleaning: Number(values.cleaning) || 0,
      support: Number(values.support) || 0,
      tax: Number(values.tax) || 0,
      misc: Number(values.misc) || 0,
    })
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <h2>Monthly Expenses</h2>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="expense-month">Month</label>
          <input
            id="expense-month"
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          />
        </div>
        {EXPENSE_FIELDS.map(({ key, label }) => (
          <div className="form-field" key={key}>
            <label htmlFor={`expense-${key}`}>{label} ($)</label>
            <input
              id={`expense-${key}`}
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={values[key]}
              onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button type="submit">Save Expenses</button>
      </div>
    </form>
  )
}
