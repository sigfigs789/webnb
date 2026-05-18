import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Booking, MonthExpense } from '../../shared/types'
import { aggregateMonthlyRevenue } from '../../shared/revenueDistribution'
import { getPrincipalGained, allPrincipalMonths } from '../../shared/principalGained'
import { getFixedCosts } from '../../shared/fixedCosts'
import { EXPECTED_VAR_TOTAL } from '../../shared/expectedVariableCost'
import { useExcludedMonths } from './useExcludedMonths'
import { usePerformanceNotes } from './usePerformanceNotes'

const TAX_RATE = 0.04712 + 0.03 + 0.1025

const ACTUAL_TAXES: Record<string, number> = {
  '2023-12': 621,
  '2024-01': 574,
  '2024-02': 0,
  '2024-03': 596,
  '2024-04': 529,
  '2024-05': 546,
  '2024-06': 749,
  '2024-07': 403,
  '2024-08': 582,
  '2024-09': 540,
  '2024-10': 20,
  '2024-11': 1045,
  '2024-12': 909,
  '2025-01': 965,
  '2025-02': 60,
  '2025-03': 60,
  '2025-04': 0,
  '2025-05': 725,
  '2025-06': 873,
  '2025-07': 808,
  '2025-08': 866,
  '2025-09': 750,
  '2025-10': 0,
  '2025-11': 739,
  '2025-12': 843,
  '2026-01': 947,
  '2026-02': 59,
  '2026-03': 35,
  '2026-04': 526,
}

function getTax(key: string, year: number, month: number, netRevenue: number): number {
  const now = new Date()
  const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)
  if (isPast && key in ACTUAL_TAXES) return ACTUAL_TAXES[key]
  return netRevenue * TAX_RATE
}

interface Props {
  bookings: Booking[]
  expenses: MonthExpense[]
}

interface MonthPerf {
  key: string
  label: string
  year: number
  month: number
  revenue: number
  taxes: number
  variableExpenses: number
  fixedCosts: number
  allExpenses: number
  principal: number
  tier2: number
  tier1: number
  hasActualExpenses: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function mergePerf(bookings: Booking[], expenses: MonthExpense[]): MonthPerf[] {
  const map = new Map<string, MonthPerf>()

  for (const { year, month } of allPrincipalMonths()) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const fixedCosts = getFixedCosts(year, month) ?? 0
    const principal = getPrincipalGained(year, month) ?? 0
    const varExp = EXPECTED_VAR_TOTAL
    const allExpenses = varExp + fixedCosts
    map.set(key, {
      key,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      year,
      month,
      revenue: 0,
      taxes: 0,
      variableExpenses: varExp,
      fixedCosts,
      allExpenses,
      principal,
      tier2: -allExpenses,
      tier1: principal - allExpenses,
      hasActualExpenses: false,
    })
  }

  for (const rev of aggregateMonthlyRevenue(bookings)) {
    const key = `${rev.year}-${String(rev.month).padStart(2, '0')}`
    const taxes = getTax(key, rev.year, rev.month, rev.netRevenue)
    const existing = map.get(key)
    if (existing) {
      existing.revenue = rev.revenue
      existing.taxes = taxes
      existing.allExpenses = existing.variableExpenses + existing.fixedCosts + taxes
      existing.tier2 = rev.revenue - existing.allExpenses
      existing.tier1 = rev.revenue + existing.principal - existing.allExpenses
    } else {
      const fixedCosts = getFixedCosts(rev.year, rev.month) ?? 0
      const principal = getPrincipalGained(rev.year, rev.month) ?? 0
      const varExp = EXPECTED_VAR_TOTAL
      const allExpenses = varExp + fixedCosts + taxes
      map.set(key, {
        key,
        label: rev.label,
        year: rev.year,
        month: rev.month,
        revenue: rev.revenue,
        taxes,
        variableExpenses: varExp,
        fixedCosts,
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
    const varExp = exp.cleaning + exp.support + exp.misc
    const existing = map.get(key)
    if (existing) {
      existing.variableExpenses = varExp
      existing.allExpenses = varExp + existing.fixedCosts + existing.taxes
      existing.tier2 = existing.revenue - existing.allExpenses
      existing.tier1 = existing.revenue + existing.principal - existing.allExpenses
      existing.hasActualExpenses = true
    } else {
      const fixedCosts = getFixedCosts(exp.year, exp.month) ?? 0
      const principal = getPrincipalGained(exp.year, exp.month) ?? 0
      const allExpenses = varExp + fixedCosts
      map.set(key, {
        key,
        label: `${MONTH_NAMES[exp.month - 1]} ${exp.year}`,
        year: exp.year,
        month: exp.month,
        revenue: 0,
        taxes: 0,
        variableExpenses: varExp,
        fixedCosts,
        allExpenses,
        principal,
        tier2: -allExpenses,
        tier1: principal - allExpenses,
        hasActualExpenses: true,
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

const COL_COUNT = 11

export function PerformanceTiers({ bookings, expenses }: Props) {
  const data = mergePerf(bookings, expenses)
  const thisYear = new Date().getFullYear()
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(
    () => new Set(Array.from(new Set(data.map(d => d.year))).filter(y => y < thisYear))
  )
  const { excludedMonths, toggleExclude } = useExcludedMonths()
  const { notes, saveNote: persistNote } = usePerformanceNotes()
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [notePos, setNotePos] = useState<{ top: number; right: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const toggleYear = (year: number) =>
    setCollapsedYears(prev => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })

  // Compute YTD running totals — reset at each new year, excluded months skipped
  let ytd2 = 0
  let ytd1 = 0
  let currentYear = -1
  const rows = data.map(d => {
    if (d.year !== currentYear) { ytd2 = 0; ytd1 = 0; currentYear = d.year }
    if (!excludedMonths.has(d.key)) {
      ytd2 += d.tier2
      ytd1 += d.tier1
    }
    return { ...d, tier2Ytd: ytd2, tier1Ytd: ytd1 }
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
      <h2>Performance Tiers</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Gross Revenue</th>
              <th>Fixed Costs</th>
              <th>Variable Exp</th>
              <th>Taxes</th>
              <th className="col-divider">Tier 2</th>
              <th>Tier 2 YTD</th>
              <th className="col-divider">Principal</th>
              <th>Tier 1</th>
              <th>Tier 1 YTD</th>
              <th className="note-cell" />
            </tr>
          </thead>
          <tbody>
            {years.map(year => {
              const group = byYear.get(year)!
              const collapsed = collapsedYears.has(year)
              const lastRow = group[group.length - 1]
              return (
                <>
                  <tr key={`year-${year}`} className="year-header-row">
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
                    const prev = group[i - 1]
                    const showDivider = prev && prev.hasActualExpenses && !d.hasActualExpenses
                    return (
                      <>
                        {showDivider && (
                          <tr key={`${d.key}-divider`} className="expense-divider">
                            <td colSpan={COL_COUNT}><span>▲ actual&ensp;·&ensp;expected ▼</span></td>
                          </tr>
                        )}
                        <tr key={d.key} className={[excluded ? 'row-excluded' : '', !d.hasActualExpenses ? 'expense-row--expected' : ''].filter(Boolean).join(' ')}>
                          <td>
                            <div className="month-cell">
                              <button
                                className={`exclude-btn${excluded ? ' active' : ''}`}
                                onClick={() => toggleExclude(d.key)}
                                title={excluded ? 'Include in YTD' : 'Exclude from YTD'}
                              >
                                {excluded ? '✕' : ''}
                              </button>
                              {d.label}
                            </div>
                          </td>
                          <td className="positive">{formatCurrency(d.revenue)}</td>
                          <td>{formatCurrency(d.fixedCosts)}</td>
                          <td>{formatCurrency(d.variableExpenses)}</td>
                          <td>{formatCurrency(d.taxes)}</td>
                          <td className={`col-divider${d.tier2 < 0 ? ' negative' : ''}`}>{formatCurrency(d.tier2)}</td>
                          <td>{formatCurrency(d.tier2Ytd)}</td>
                          <td className="col-divider positive">{formatCurrency(d.principal)}</td>
                          <td className={d.tier1 < 0 ? 'negative' : ''}>{formatCurrency(d.tier1)}</td>
                          <td>{formatCurrency(d.tier1Ytd)}</td>
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
                      </>
                    )
                  })}
                  {collapsed && (
                    <tr key={`year-${year}-summary`} className="year-summary-row">
                      <td className="year-summary-label">{group.length} {group.length === 1 ? 'month' : 'months'} hidden</td>
                      <td className="positive">{formatCurrency(group.reduce((s, d) => s + d.revenue, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.fixedCosts, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.variableExpenses, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.taxes, 0))}</td>
                      <td className="col-divider">{formatCurrency(lastRow.tier2Ytd)}</td>
                      <td>—</td>
                      <td className="col-divider positive">{formatCurrency(group.reduce((s, d) => s + d.principal, 0))}</td>
                      <td>{formatCurrency(lastRow.tier1Ytd)}</td>
                      <td>—</td>
                      <td className="note-cell" />
                    </tr>
                  )}
                </>
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
