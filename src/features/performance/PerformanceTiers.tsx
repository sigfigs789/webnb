import { useState, useRef, useEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { Booking, MonthExpense } from '../../shared/types'
import { aggregateMonthlyRevenue } from '../../shared/revenueDistribution'
import { getPrincipalGained, allPrincipalMonths } from '../../shared/principalGained'
import { getFixedCosts, applyOurDaysAdjustment } from '../../shared/fixedCosts'
import { getExpectedVarCost, getExpectedVarTotal } from '../../shared/expectedVariableCost'
import { getDefaultCollapsedYears } from '../../shared/yearCollapse'
import { usePerformanceMonthFlags } from './usePerformanceMonthFlags'
import { usePerformanceNotes } from './usePerformanceNotes'
import { useActualTaxes } from './useActualTaxes'
import { useOccupancy, OccupancyEntry } from '../occupancy/useOccupancy'

import { getTax } from '../../shared/taxCalculation'

interface Props {
  bookings: Booking[]
  expenses: MonthExpense[]
  onSetExpense: (
    year: number,
    month: number,
    values: Omit<MonthExpense, 'id' | 'year' | 'month'>
  ) => void | Promise<void>
}

interface MonthPerf {
  key: string
  label: string
  year: number
  month: number
  revenue: number
  taxes: number
  cleaning: number
  support: number
  misc: number
  variableExpenses: number
  fixedCosts: number
  countedFixedCosts: number
  allExpenses: number
  principal: number
  tier2: number
  tier1: number
  hasActualExpenses: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function mergePerf(bookings: Booking[], expenses: MonthExpense[], actualTaxes: Record<string, number>, occupancyEntries: OccupancyEntry[], proratedMonths: Set<string>, variableOnlyMonths: Set<string>): MonthPerf[] {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const occupancyMap = new Map<string, number>()
  for (const e of occupancyEntries) {
    occupancyMap.set(`${e.year}-${String(e.month).padStart(2, '0')}`, e.ourDays)
  }

  function isPastMonth(year: number, month: number) {
    return year < currentYear || (year === currentYear && month < currentMonth)
  }

  // Fixed costs are flat unless the month is explicitly flagged for proration,
  // in which case they scale down by that month's owner-use days.
  function adjustedFixedCosts(key: string, year: number, month: number): number {
    const full = getFixedCosts(year, month) ?? 0
    if (!proratedMonths.has(key)) return full
    const ourDays = occupancyMap.get(key) ?? 0
    return applyOurDaysAdjustment(full, ourDays, getDaysInMonth(year, month))
  }

  // Variable-only months still display their fixed costs, but the tier math
  // counts everything except them.
  function countFixed(key: string, fixedCosts: number): number {
    return variableOnlyMonths.has(key) ? 0 : fixedCosts
  }

  const map = new Map<string, MonthPerf>()

  for (const { year, month } of allPrincipalMonths()) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const fixedCosts = adjustedFixedCosts(key, year, month)
    const principal = getPrincipalGained(year, month) ?? 0
    const { cleaning, support, misc } = getExpectedVarCost(year, month)
    const varExp = getExpectedVarTotal(year, month)
    const countedFixedCosts = countFixed(key, fixedCosts)
    const allExpenses = varExp + countedFixedCosts
    map.set(key, {
      key,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      year,
      month,
      revenue: 0,
      taxes: 0,
      cleaning,
      support,
      misc,
      variableExpenses: varExp,
      fixedCosts,
      countedFixedCosts,
      allExpenses,
      principal,
      tier2: -allExpenses,
      tier1: principal - allExpenses,
      hasActualExpenses: false,
    })
  }

  for (const rev of aggregateMonthlyRevenue(bookings)) {
    const key = `${rev.year}-${String(rev.month).padStart(2, '0')}`
    const taxes = getTax(key, rev.netRevenue, actualTaxes)
    const existing = map.get(key)
    if (existing) {
      existing.revenue = rev.revenue
      existing.taxes = taxes
      existing.allExpenses = existing.variableExpenses + existing.countedFixedCosts + taxes
      existing.tier2 = rev.revenue - existing.allExpenses
      existing.tier1 = rev.revenue + existing.principal - existing.allExpenses
    } else {
      const fixedCosts = adjustedFixedCosts(key, rev.year, rev.month)
      const principal = getPrincipalGained(rev.year, rev.month) ?? 0
      const { cleaning, support, misc } = getExpectedVarCost(rev.year, rev.month)
      const varExp = getExpectedVarTotal(rev.year, rev.month)
      const countedFixedCosts = countFixed(key, fixedCosts)
      const allExpenses = varExp + countedFixedCosts + taxes
      map.set(key, {
        key,
        label: rev.label,
        year: rev.year,
        month: rev.month,
        revenue: rev.revenue,
        taxes,
        cleaning,
        support,
        misc,
        variableExpenses: varExp,
        fixedCosts,
        countedFixedCosts,
        allExpenses,
        principal,
        tier2: rev.revenue - allExpenses,
        tier1: rev.revenue + principal - allExpenses,
        hasActualExpenses: false,
      })
    }
  }

  for (const exp of expenses) {
    const key = `${exp.year}-${String(exp.month).padStart(2, '0')}`
    const { cleaning, support, misc } = exp
    const varExp = cleaning + support + misc
    const hasActualExpenses = isPastMonth(exp.year, exp.month)
    const existing = map.get(key)
    if (existing) {
      existing.cleaning = cleaning
      existing.support = support
      existing.misc = misc
      existing.variableExpenses = varExp
      existing.allExpenses = varExp + existing.countedFixedCosts + existing.taxes
      existing.tier2 = existing.revenue - existing.allExpenses
      existing.tier1 = existing.revenue + existing.principal - existing.allExpenses
      existing.hasActualExpenses = hasActualExpenses
    } else {
      const fixedCosts = adjustedFixedCosts(key, exp.year, exp.month)
      const principal = getPrincipalGained(exp.year, exp.month) ?? 0
      const countedFixedCosts = countFixed(key, fixedCosts)
      const allExpenses = varExp + countedFixedCosts
      map.set(key, {
        key,
        label: `${MONTH_NAMES[exp.month - 1]} ${exp.year}`,
        year: exp.year,
        month: exp.month,
        revenue: 0,
        taxes: 0,
        cleaning,
        support,
        misc,
        variableExpenses: varExp,
        fixedCosts,
        countedFixedCosts,
        allExpenses,
        principal,
        tier2: -allExpenses,
        tier1: principal - allExpenses,
        hasActualExpenses,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  )
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatCurrencyWithCents(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// Amounts are stored to the cent. Inputs show whole dollars at rest and switch to
// the exact stored value on focus, so editing a cell never truncates its cents.
function roundToCents(n: number) {
  return Math.round(n * 100) / 100
}

function amountAtRest(n: number) {
  return String(Math.round(n))
}

function amountWhileEditing(n: number) {
  return String(roundToCents(n))
}

const COL_COUNT = 11
const REVENUE_CHECK_TOLERANCE = 0.01
type VariableExpenseKey = 'cleaning' | 'support' | 'misc'

const VARIABLE_EXPENSE_FIELDS: { key: VariableExpenseKey; label: string }[] = [
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'support', label: 'Support' },
  { key: 'misc', label: 'Misc' },
]

export function PerformanceTiers({ bookings, expenses, onSetExpense }: Props) {
  const { actualTaxes, upsertTax } = useActualTaxes()
  const { entries: occupancyEntries } = useOccupancy()
  const [taxDrafts, setTaxDrafts] = useState<Record<string, string>>({})
  const taxOriginalsRef = useRef<Record<string, number>>({})
  const [expenseDrafts, setExpenseDrafts] = useState<Record<string, Partial<Record<VariableExpenseKey, string>>>>({})
  const expenseOriginalsRef = useRef<Record<string, Partial<Record<VariableExpenseKey, number>>>>({})
  const { excludedMonths, proratedMonths, variableOnlyMonths, toggleFlag } = usePerformanceMonthFlags()
  const data = mergePerf(bookings, expenses, actualTaxes, occupancyEntries, proratedMonths, variableOnlyMonths)
  const thisYear = new Date().getFullYear()
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(
    () => getDefaultCollapsedYears(data.map(d => d.year), thisYear)
  )
  const { notes, saveNote: persistNote } = usePerformanceNotes()
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [notePos, setNotePos] = useState<{ top: number; right: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bookingRevenueTotal = bookings.reduce((sum, booking) => sum + booking.revenue, 0)
  const distributedRevenueTotal = data.reduce((sum, month) => sum + month.revenue, 0)
  const revenueDifference = distributedRevenueTotal - bookingRevenueTotal
  const revenueCheckPassed = Math.abs(revenueDifference) <= REVENUE_CHECK_TOLERANCE

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [editingNote])

  function openNote(key: string, btn: HTMLElement) {
    const rect = btn.getBoundingClientRect()
    setNotePos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setEditingNote(key)
    setNoteDraft(notes[key] ?? '')
  }

  function saveNote(key: string) {
    persistNote(key, noteDraft)
    setEditingNote(null)
  }

  function saveVariableExpense(month: MonthPerf, field: VariableExpenseKey, inputValue: string) {
    const original = roundToCents(expenseOriginalsRef.current[month.key]?.[field] ?? month[field])
    const val = roundToCents(Math.max(0, Number(inputValue) || 0))
    setExpenseDrafts(prev => {
      const next = { ...prev }
      const row = { ...(next[month.key] ?? {}) }
      delete row[field]
      if (Object.keys(row).length) next[month.key] = row
      else delete next[month.key]
      return next
    })
    if (val === original) return

    const ok = window.confirm(
      `Change ${field} for ${month.label} from $${original.toFixed(2)} to $${val.toFixed(2)}?`
    )
    if (!ok) return

    const existing = expenses.find(e => e.year === month.year && e.month === month.month)
    onSetExpense(month.year, month.month, {
      cleaning: field === 'cleaning' ? val : month.cleaning,
      support: field === 'support' ? val : month.support,
      misc: field === 'misc' ? val : month.misc,
      tax: existing?.tax ?? 0,
    })
  }

  const toggleYear = (year: number) =>
    setCollapsedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })

  // Compute YTD running totals — reset at each new year, excluded months skipped
  let ytd2 = 0
  let ytd1 = 0
  let currentYear = -1
  const rows = data.map(d => {
    if (d.year !== currentYear) { ytd2 = 0; ytd1 = 0; currentYear = d.year }
    const excluded = excludedMonths.has(d.key)
    if (!excluded) {
      ytd2 += d.tier2
      ytd1 += d.tier1
    }
    // Net mirrors Tier 1 (revenue + equity gained − costs), just monthly rather
    // than YTD. A skipped month nets zero, so it drops out of the year total too.
    return { ...d, net: excluded ? 0 : d.tier1, tier2Ytd: ytd2, tier1Ytd: ytd1 }
  })

  // Group by year
  const years = Array.from(new Set(rows.map(r => r.year)))
  const byYear = new Map<number, typeof rows>()
  for (const r of rows) {
    const g = byYear.get(r.year) ?? []
    g.push(r)
    byYear.set(r.year, g)
  }


  return (
    <>
    <div className="performance-tiers">
      <div className="section-heading-row">
        <h2>Performance Tiers</h2>
        <div className={`revenue-check ${revenueCheckPassed ? 'revenue-check--pass' : 'revenue-check--fail'}`}>
          <span className="revenue-check__status">
            {revenueCheckPassed ? 'Revenue check passed' : 'Revenue check failed'}
          </span>
          <span>
            Bookings {formatCurrencyWithCents(bookingRevenueTotal)}
            {' · '}
            Performance {formatCurrencyWithCents(distributedRevenueTotal)}
            {' · '}
            Difference {formatCurrencyWithCents(revenueDifference)}
          </span>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Gross Revenue</th>
              <th>Fixed Costs</th>
              {VARIABLE_EXPENSE_FIELDS.map(({ key, label }) => <th key={key}>{label}</th>)}
              <th>Taxes</th>
              <th className="col-divider">Tier 1 Net</th>
              <th>Tier 1 YTD</th>
              <th>Tier 2 YTD</th>
              <th className="note-cell" />
            </tr>
          </thead>
          <tbody>
            {years.map(year => {
              const group = byYear.get(year)!
              const collapsed = collapsedYears.has(year)
              const lastRow = group[group.length - 1]
              const groupNet = group.reduce((s, d) => s + d.net, 0)
              return (
                <Fragment key={`year-${year}`}>
                  <tr className="year-header-row">
                    <td colSpan={COL_COUNT}>
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
                  {!collapsed && group.map((d, i) => {
                    const excluded = excludedMonths.has(d.key)
                    const prorated = proratedMonths.has(d.key)
                    const variableOnly = variableOnlyMonths.has(d.key)
                    const prev = group[i - 1]
                    const showDivider = prev && prev.hasActualExpenses && !d.hasActualExpenses
                    return (
                      <Fragment key={d.key}>
                        {showDivider && (
                          <tr className="expense-divider">
                            <td colSpan={COL_COUNT}><span>▲ actual&ensp;·&ensp;expected ▼</span></td>
                          </tr>
                        )}
                        <tr className={[excluded ? 'row-excluded' : '', !d.hasActualExpenses ? 'expense-row--expected' : ''].filter(Boolean).join(' ')}>
                          <td>
                            <div className="month-cell">
                              <button
                                className={`month-flag-btn month-flag-btn--skip${excluded ? ' active' : ''}`}
                                onClick={() => toggleFlag(d.key, 'excluded')}
                                title={excluded ? 'Skipped: not counted in YTD' : 'Skip this month in YTD'}
                                aria-label={`${excluded ? 'Include' : 'Skip'} ${d.label} in YTD`}
                                aria-pressed={excluded}
                              >
                                S
                              </button>
                              <button
                                className={`month-flag-btn month-flag-btn--prorate${prorated ? ' active' : ''}`}
                                onClick={() => toggleFlag(d.key, 'prorated')}
                                title={prorated ? 'Prorated: fixed costs reduced by owner-use days' : 'Prorate fixed costs by owner-use days'}
                                aria-label={`${prorated ? 'Stop prorating' : 'Prorate'} fixed costs for ${d.label}`}
                                aria-pressed={prorated}
                              >
                                P
                              </button>
                              <button
                                className={`month-flag-btn month-flag-btn--variable-only${variableOnly ? ' active' : ''}`}
                                onClick={() => toggleFlag(d.key, 'variable_only')}
                                title={variableOnly ? 'Variable only: every cost but fixed costs counts' : 'Count every cost except fixed costs'}
                                aria-label={`${variableOnly ? 'Stop excluding' : 'Exclude'} fixed costs for ${d.label}`}
                                aria-pressed={variableOnly}
                              >
                                V
                              </button>
                              {d.label}
                            </div>
                          </td>
                          <td className="positive">{formatCurrency(d.revenue)}</td>
                          <td
                            className={[prorated ? 'fixed-cost-prorated' : '', variableOnly ? 'fixed-cost-uncounted' : ''].filter(Boolean).join(' ')}
                            title={variableOnly ? 'Not counted: variable costs only' : prorated ? 'Prorated by owner-use days' : undefined}
                          >
                            {formatCurrency(d.fixedCosts)}
                          </td>
                          {VARIABLE_EXPENSE_FIELDS.map(({ key }) => (
                            <td key={key}>
                              <input
                                className="expense-input"
                                type="text"
                                inputMode="decimal"
                                value={expenseDrafts[d.key]?.[key] ?? amountAtRest(d[key])}
                                onFocus={() => {
                                  expenseOriginalsRef.current[d.key] = {
                                    ...(expenseOriginalsRef.current[d.key] ?? {}),
                                    [key]: d[key],
                                  }
                                  setExpenseDrafts(prev => ({
                                    ...prev,
                                    [d.key]: { ...(prev[d.key] ?? {}), [key]: amountWhileEditing(d[key]) },
                                  }))
                                }}
                                onChange={e => setExpenseDrafts(prev => ({
                                  ...prev,
                                  [d.key]: { ...(prev[d.key] ?? {}), [key]: e.target.value },
                                }))}
                                onBlur={e => saveVariableExpense(d, key, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                              />
                            </td>
                          ))}
                          <td>
                            <input
                              className="expense-input"
                              type="text"
                              inputMode="decimal"
                              value={taxDrafts[d.key] ?? amountAtRest(d.taxes)}
                              onFocus={() => {
                                taxOriginalsRef.current[d.key] = d.taxes
                                setTaxDrafts(prev => ({ ...prev, [d.key]: amountWhileEditing(d.taxes) }))
                              }}
                              onChange={e => setTaxDrafts(prev => ({ ...prev, [d.key]: e.target.value }))}
                              onBlur={e => {
                                const original = roundToCents(taxOriginalsRef.current[d.key] ?? d.taxes)
                                const val = roundToCents(Math.max(0, Number(e.target.value) || 0))
                                setTaxDrafts(prev => { const next = { ...prev }; delete next[d.key]; return next })
                                if (val !== original) {
                                  const ok = window.confirm(
                                    `Change tax for ${d.label} from $${original.toFixed(2)} to $${val.toFixed(2)}?`
                                  )
                                  if (ok) upsertTax(d.year, d.month, val)
                                }
                              }}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            />
                          </td>
                          <td className={`col-divider ${d.net >= 0 ? 'positive' : 'negative'}`}>
                            {formatCurrency(d.net)}
                          </td>
                          <td>{formatCurrency(d.tier1Ytd)}</td>
                          <td>{formatCurrency(d.tier2Ytd)}</td>
                          <td className="note-cell">
                            <div className="note-wrapper">
                              <button
                                className={`note-btn${notes[d.key] ? ' note-btn--active' : ''}${editingNote === d.key ? ' note-btn--editing' : ''}`}
                                onClick={e => openNote(d.key, e.currentTarget)}
                                aria-label={notes[d.key] ? 'Edit note' : 'Add note'}
                              >
                                {notes[d.key] ? '●' : '+'}
                              </button>
                              {notes[d.key] && editingNote !== d.key && (
                                <div className="note-tooltip">{notes[d.key]}</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                  {collapsed && (
                    <tr className="year-summary-row">
                      <td className="year-summary-label">{group.length} {group.length === 1 ? 'month' : 'months'} hidden</td>
                      <td className="positive">{formatCurrency(group.reduce((s, d) => s + d.revenue, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.countedFixedCosts, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.cleaning, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.support, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.misc, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.taxes, 0))}</td>
                      <td className={`col-divider ${groupNet >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(groupNet)}
                      </td>
                      <td>{formatCurrency(lastRow.tier1Ytd)}</td>
                      <td>{formatCurrency(lastRow.tier2Ytd)}</td>
                      <td className="note-cell" />
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
    {editingNote && notePos && createPortal(
      <div
        className="note-popover"
        style={{ top: notePos.top, right: notePos.right }}
      >
        <textarea
          ref={textareaRef}
          className="note-textarea"
          autoFocus
          value={noteDraft}
          onChange={e => {
            setNoteDraft(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          onBlur={() => saveNote(editingNote)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(editingNote) }
            if (e.key === 'Escape') setEditingNote(null)
          }}
          placeholder="Add a note…"
        />
      </div>,
      document.body
    )}
    </>
  )
}
