import React, { useState, useEffect, Fragment } from 'react'
import { MonthExpense } from '../../shared/types'
import { getFixedCosts } from '../../shared/fixedCosts'
import { allPrincipalMonths } from '../../shared/principalGained'
import { EXPECTED_VAR_COST, EXPECTED_VAR_TOTAL } from '../../shared/expectedVariableCost'

type ExpenseKey = 'cleaning' | 'support' | 'tax' | 'misc'
type RowDraft = Record<ExpenseKey, string>

interface Props {
  expenses: MonthExpense[]
  onSubmit: (year: number, month: number, values: Record<ExpenseKey, number>) => void
}

const FIELDS: { key: ExpenseKey; label: string }[] = [
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'support', label: 'Support' },
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

const ALL_MONTHS = allPrincipalMonths().map(({ year, month }) => monthKey(year, month))

const EXPECTED = EXPECTED_VAR_COST as Partial<Record<ExpenseKey, number>>
const EXPECTED_TOTAL = EXPECTED_VAR_TOTAL

function expectedValue(field: ExpenseKey) {
  return EXPECTED[field] ?? 0
}

export function ExpenseForm({ expenses, onSubmit }: Props) {
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [orderedKeys, setOrderedKeys] = useState<string[]>(ALL_MONTHS)
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set([2023, 2024]))

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
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  function isPastMonth(year: number, month: number) {
    return year < currentYear || (year === currentYear && month < currentMonth)
  }

  const toggleYear = (year: number) =>
    setCollapsedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })

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

  // Group keys by year
  const years = Array.from(new Set(orderedKeys.map(k => parseKey(k).year))).sort((a, b) => a - b)
  const keysByYear = new Map<number, string[]>()
  for (const k of orderedKeys) {
    const { year } = parseKey(k)
    const g = keysByYear.get(year) ?? []
    g.push(k)
    keysByYear.set(year, g)
  }

  // First future key (where the actual/expected divider goes)
  const firstFutureKey = orderedKeys.find(k => {
    const { year, month } = parseKey(k)
    return !isPastMonth(year, month)
  }) ?? null

  const colSpan = 2 + FIELDS.length + 1

  const colTotals = FIELDS.map(({ key: field }) =>
    orderedKeys.reduce((s, mk) => {
      const { year, month } = parseKey(mk)
      return s + (isPastMonth(year, month) ? Number(drafts[mk]?.[field]) || 0 : expectedValue(field))
    }, 0)
  )
  const grandTotal = colTotals.reduce((s, v) => s + v, 0)
  const totalFixedCosts = orderedKeys.reduce((s, mk) => {
    const { year, month } = parseKey(mk)
    return s + (getFixedCosts(year, month) ?? 0)
  }, 0)

  return (
    <div className="expense-table">
      <h2>Monthly expected expenses</h2>

      {orderedKeys.length === 0 ? (
        <p className="empty-state">No expense records yet. Add a month below.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Fixed Costs</th>
                {FIELDS.map(({ key, label }) => <th key={key}>{label}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {years.map(year => {
                const keys = keysByYear.get(year) ?? []
                const collapsed = collapsedYears.has(year)
                const yearFixed = keys.reduce((s, k) => s + (getFixedCosts(parseKey(k).year, parseKey(k).month) ?? 0), 0)
                const yearColTotals = FIELDS.map(({ key: field }) =>
                  keys.reduce((s, k) => {
                    const { year: y, month: m } = parseKey(k)
                    return s + (isPastMonth(y, m) ? Number(drafts[k]?.[field]) || 0 : expectedValue(field))
                  }, 0)
                )
                const yearGrandTotal = yearColTotals.reduce((s, v) => s + v, 0)
                return (
                  <Fragment key={`year-${year}`}>
                    <tr className="year-header-row">
                      <td colSpan={colSpan}>
                        <button
                          className="year-toggle"
                          onClick={() => toggleYear(year)}
                          aria-label={collapsed ? `Expand ${year}` : `Collapse ${year}`}
                        >
                          <span className={`chevron ${collapsed ? 'collapsed' : ''}`}>›</span>
                          <strong>{year}</strong>
                        </button>
                      </td>
                    </tr>
                    {collapsed ? (
                      <tr className="year-summary-row">
                        <td className="year-summary-label">{keys.length} months hidden</td>
                        <td>{formatCurrency(yearFixed)}</td>
                        {yearColTotals.map((t, i) => <td key={i}>{formatCurrency(t)}</td>)}
                        <td>{formatCurrency(yearGrandTotal)}</td>
                      </tr>
                    ) : (
                      keys.map(key => {
                        const draft = drafts[key] ?? zeroDraft()
                        const { year: y, month: m } = parseKey(key)
                        const expected = !isPastMonth(y, m)
                        const fixedCosts = getFixedCosts(y, m)
                        const rowTotal = expected
                          ? EXPECTED_TOTAL
                          : FIELDS.reduce((s, { key: f }) => s + (Number(draft[f]) || 0), 0)
                        const showDivider = key === firstFutureKey
                        return (
                          <React.Fragment key={key}>
                            {showDivider && (
                              <tr className="expense-divider">
                                <td colSpan={colSpan}>
                                  <span>▲ actual&ensp;·&ensp;expected ▼</span>
                                </td>
                              </tr>
                            )}
                            <tr className={expected ? 'expense-row--expected' : undefined}>
                              <td>{monthLabel(y, m)}</td>
                              <td>{fixedCosts !== null ? formatCurrency(fixedCosts) : '—'}</td>
                              {FIELDS.map(({ key: field }) => (
                                <td key={field}>
                                  {expected ? (
                                    <span className="expected-value">{formatCurrency(expectedValue(field))}</span>
                                  ) : (
                                    <input
                                      className="expense-input"
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={draft[field]}
                                      onChange={e => setField(key, field, e.target.value)}
                                      onBlur={() => save(key)}
                                    />
                                  )}
                                </td>
                              ))}
                              <td>{formatCurrency(rowTotal)}</td>
                            </tr>
                          </React.Fragment>
                        )
                      })
                    )}
                  </Fragment>
                )
              })}
              <tr className="total-row">
                <td>Total</td>
                <td>{formatCurrency(totalFixedCosts)}</td>
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
