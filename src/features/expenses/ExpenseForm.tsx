import React, { useState, useEffect, useRef, Fragment } from 'react'
import { MonthExpense } from '../../shared/types'
import { getFixedCosts, applyOurDaysAdjustment } from '../../shared/fixedCosts'
import { allPrincipalMonths } from '../../shared/principalGained'
import { getExpectedVarCost, resolveExpectedForMonth, isScheduleActive, EXPECTED_VAR_COST } from '../../shared/expectedVariableCost'
import { getDefaultCollapsedYears } from '../../shared/yearCollapse'
import { useExpenseMonthFlags } from './useExpenseMonthFlags'
import { useOccupancy } from '../occupancy/useOccupancy'

type ExpenseKey = 'cleaning' | 'support' | 'tax' | 'misc'
type RowDraft = Record<ExpenseKey, string>

interface Props {
  expenses: MonthExpense[]
  onSubmit: (year: number, month: number, values: Record<ExpenseKey, number>) => void | Promise<void>
  onUpdateFutureExpected: (values: Pick<MonthExpense, 'cleaning' | 'support' | 'misc'>) => void | Promise<void>
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

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
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

function expectedValue(field: ExpenseKey, year: number, month: number) {
  const expected = getExpectedVarCost(year, month) as Partial<Record<ExpenseKey, number>>
  return expected[field] ?? 0
}

export function ExpenseForm({ expenses, onSubmit, onUpdateFutureExpected }: Props) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [orderedKeys, setOrderedKeys] = useState<string[]>(ALL_MONTHS)
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(
    () => getDefaultCollapsedYears(ALL_MONTHS.map(k => parseKey(k).year), currentYear)
  )
  const [futureDraft, setFutureDraft] = useState<RowDraft>(() => ({
    cleaning: String(EXPECTED_VAR_COST.cleaning),
    support: String(EXPECTED_VAR_COST.support),
    tax: '0',
    misc: String(EXPECTED_VAR_COST.misc),
  }))
  // Months touched by an edit since their last save. Expected months have no
  // saved row until edited, so blur alone must not materialize one.
  const dirtyKeys = useRef<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const { excludedMonths, proratedMonths, variableOnlyMonths, toggleFlag } = useExpenseMonthFlags()
  const { entries: occupancyEntries } = useOccupancy()
  const ourDaysByKey = new Map(
    occupancyEntries.map(e => [monthKey(e.year, e.month), e.ourDays])
  )

  // Fixed costs are flat unless the month is flagged for proration, in which
  // case they scale down by that month's owner-use days.
  function fixedCostFor(key: string): number | null {
    const { year, month } = parseKey(key)
    const full = getFixedCosts(year, month)
    if (full === null || !proratedMonths.has(key)) return full
    return applyOurDaysAdjustment(full, ourDaysByKey.get(key) ?? 0, daysInMonth(year, month))
  }

  // Variable-only months still show their fixed cost, but the totals count
  // every other cost and leave that one out.
  function countedFixedCostFor(key: string): number {
    if (variableOnlyMonths.has(key)) return 0
    return fixedCostFor(key) ?? 0
  }

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

  function isPastMonth(year: number, month: number) {
    return year < currentYear || (year === currentYear && month < currentMonth)
  }

  function isFutureExpectedMonth(year: number, month: number) {
    return !isPastMonth(year, month)
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
    dirtyKeys.current.add(key)
    setDrafts(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? rowDraft(key)), [field]: value },
    }))
  }

  function setFutureField(field: ExpenseKey, value: string) {
    setFutureDraft(prev => ({ ...prev, [field]: value }))
  }

  // A month with no saved row falls back to its scheduled expected amounts,
  // so the inputs are pre-filled with what the projection assumes.
  function scheduledDraft(year: number, month: number): RowDraft {
    return {
      cleaning: String(expectedValue('cleaning', year, month)),
      support: String(expectedValue('support', year, month)),
      tax: '0',
      misc: String(expectedValue('misc', year, month)),
    }
  }

  function rowDraft(key: string): RowDraft {
    const existing = drafts[key]
    if (existing) return existing
    const { year, month } = parseKey(key)
    return isPastMonth(year, month) ? zeroDraft() : scheduledDraft(year, month)
  }

  function fieldValue(key: string, field: ExpenseKey) {
    const value = Number(rowDraft(key)[field])
    return Number.isFinite(value) ? value : 0
  }

  async function handleUpdateFutureExpected() {
    const values = {
      cleaning: Number(futureDraft.cleaning) || 0,
      support: Number(futureDraft.support) || 0,
      misc: Number(futureDraft.misc) || 0,
    }

    setBulkSaving(true)
    setBulkError(null)
    try {
      await onUpdateFutureExpected(values)
      setDrafts(prev => {
        const next = { ...prev }
        for (const key of orderedKeys) {
          const { year, month } = parseKey(key)
          // Mirror the rows the bulk write actually touched (schedule start onward)
          if (isFutureExpectedMonth(year, month) && isScheduleActive(year, month)) {
            const scheduled = resolveExpectedForMonth(year, month, values)
            next[key] = {
              ...(next[key] ?? zeroDraft()),
              cleaning: String(scheduled.cleaning),
              support: String(scheduled.support),
              misc: String(scheduled.misc),
            }
          }
        }
        return next
      })
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Could not update future expected expenses.')
    } finally {
      setBulkSaving(false)
    }
  }

  function save(key: string) {
    if (!dirtyKeys.current.delete(key)) return
    const draft = rowDraft(key)
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

  // Skipped months are shown but left out of every total.
  const includedKeys = orderedKeys.filter(k => !excludedMonths.has(k))
  const colTotals = FIELDS.map(({ key: field }) =>
    includedKeys.reduce((s, mk) => s + fieldValue(mk, field), 0)
  )
  const grandTotal = colTotals.reduce((s, v) => s + v, 0)
  const totalFixedCosts = includedKeys.reduce((s, mk) => s + countedFixedCostFor(mk), 0)

  return (
    <div className="expense-table">
      <h2>Monthly expected expenses</h2>

      <div className="expense-bulk-row">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="expense-bulk-field">
            <span>{label}</span>
            <input
              className="expense-input"
              type="number"
              min="0"
              step="any"
              value={futureDraft[key]}
              onChange={e => setFutureField(key, e.target.value)}
            />
          </label>
        ))}
        <button type="button" onClick={handleUpdateFutureExpected} disabled={bulkSaving}>
          {bulkSaving ? 'Updating…' : 'Update future expected'}
        </button>
      </div>
      {bulkError && <p className="form-error">{bulkError}</p>}

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
                const includedYearKeys = keys.filter(k => !excludedMonths.has(k))
                const yearFixed = includedYearKeys.reduce((s, k) => s + countedFixedCostFor(k), 0)
                const yearColTotals = FIELDS.map(({ key: field }) =>
                  includedYearKeys.reduce((s, k) => s + fieldValue(k, field), 0)
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
                        <td className="year-summary-label">
                          {keys.length} months hidden
                          {keys.length - includedYearKeys.length > 0 &&
                            ` · ${keys.length - includedYearKeys.length} skipped`}
                        </td>
                        <td>{formatCurrency(yearFixed)}</td>
                        {yearColTotals.map((t, i) => <td key={i}>{formatCurrency(t)}</td>)}
                        <td>{formatCurrency(yearGrandTotal)}</td>
                      </tr>
                    ) : (
                      keys.map(key => {
                        const draft = rowDraft(key)
                        const { year: y, month: m } = parseKey(key)
                        const expected = !isPastMonth(y, m)
                        const fixedCosts = fixedCostFor(key)
                        const excluded = excludedMonths.has(key)
                        const prorated = proratedMonths.has(key)
                        const variableOnly = variableOnlyMonths.has(key)
                        const rowTotal = FIELDS.reduce((s, { key: f }) => s + fieldValue(key, f), 0)
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
                            <tr className={[excluded ? 'row-excluded' : '', expected ? 'expense-row--expected' : ''].filter(Boolean).join(' ') || undefined}>
                              <td>
                                <div className="month-cell">
                                  <button
                                    type="button"
                                    className={`month-flag-btn month-flag-btn--skip${excluded ? ' active' : ''}`}
                                    onClick={() => toggleFlag(key, 'excluded')}
                                    title={excluded ? 'Skipped: not counted in totals' : 'Skip this month in totals'}
                                    aria-label={`${excluded ? 'Include' : 'Skip'} ${monthLabel(y, m)} in totals`}
                                    aria-pressed={excluded}
                                  >
                                    S
                                  </button>
                                  <button
                                    type="button"
                                    className={`month-flag-btn month-flag-btn--prorate${prorated ? ' active' : ''}`}
                                    onClick={() => toggleFlag(key, 'prorated')}
                                    title={prorated ? 'Prorated: fixed costs reduced by owner-use days' : 'Prorate fixed costs by owner-use days'}
                                    aria-label={`${prorated ? 'Stop prorating' : 'Prorate'} fixed costs for ${monthLabel(y, m)}`}
                                    aria-pressed={prorated}
                                  >
                                    P
                                  </button>
                                  <button
                                    type="button"
                                    className={`month-flag-btn month-flag-btn--variable-only${variableOnly ? ' active' : ''}`}
                                    onClick={() => toggleFlag(key, 'variable_only')}
                                    title={variableOnly ? 'Variable only: every cost but fixed costs counts' : 'Count every cost except fixed costs'}
                                    aria-label={`${variableOnly ? 'Stop excluding' : 'Exclude'} fixed costs for ${monthLabel(y, m)}`}
                                    aria-pressed={variableOnly}
                                  >
                                    V
                                  </button>
                                  {monthLabel(y, m)}
                                </div>
                              </td>
                              <td
                                className={[prorated ? 'fixed-cost-prorated' : '', variableOnly ? 'fixed-cost-uncounted' : ''].filter(Boolean).join(' ')}
                                title={variableOnly ? 'Not counted: variable costs only' : prorated ? 'Prorated by owner-use days' : undefined}
                              >
                                {fixedCosts !== null ? formatCurrency(fixedCosts) : '—'}
                              </td>
                              {FIELDS.map(({ key: field }) => (
                                <td key={field}>
                                  <input
                                    className={`expense-input${expected ? ' expense-input--expected' : ''}`}
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
