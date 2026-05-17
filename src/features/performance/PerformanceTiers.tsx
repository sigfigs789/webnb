import { useState } from 'react'
import { Booking, MonthExpense } from '../../shared/types'
import { aggregateMonthlyRevenue } from '../../shared/revenueDistribution'
import { getPrincipalGained, allPrincipalMonths } from '../../shared/principalGained'
import { getFixedCosts } from '../../shared/fixedCosts'

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
  variableExpenses: number
  fixedCosts: number
  allExpenses: number
  principal: number
  tier2: number
  tier1: number
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function mergePerf(bookings: Booking[], expenses: MonthExpense[]): MonthPerf[] {
  const map = new Map<string, MonthPerf>()

  for (const { year, month } of allPrincipalMonths()) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const fixedCosts = getFixedCosts(year, month) ?? 0
    const principal = getPrincipalGained(year, month) ?? 0
    map.set(key, {
      key,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      year,
      month,
      revenue: 0,
      variableExpenses: 0,
      fixedCosts,
      allExpenses: fixedCosts,
      principal,
      tier2: -fixedCosts,
      tier1: principal - fixedCosts,
    })
  }

  for (const rev of aggregateMonthlyRevenue(bookings)) {
    const key = `${rev.year}-${String(rev.month).padStart(2, '0')}`
    const existing = map.get(key)
    if (existing) {
      existing.revenue = rev.revenue
      existing.tier2 = rev.revenue - existing.allExpenses
      existing.tier1 = rev.revenue + existing.principal - existing.allExpenses
    } else {
      const fixedCosts = getFixedCosts(rev.year, rev.month) ?? 0
      const principal = getPrincipalGained(rev.year, rev.month) ?? 0
      map.set(key, {
        key,
        label: rev.label,
        year: rev.year,
        month: rev.month,
        revenue: rev.revenue,
        variableExpenses: 0,
        fixedCosts,
        allExpenses: fixedCosts,
        principal,
        tier2: rev.revenue - fixedCosts,
        tier1: rev.revenue + principal - fixedCosts,
      })
    }
  }

  for (const exp of expenses) {
    const key = `${exp.year}-${String(exp.month).padStart(2, '0')}`
    const varExp = exp.cleaning + exp.support + exp.misc
    const existing = map.get(key)
    if (existing) {
      existing.variableExpenses = varExp
      existing.allExpenses = varExp + existing.fixedCosts
      existing.tier2 = existing.revenue - existing.allExpenses
      existing.tier1 = existing.revenue + existing.principal - existing.allExpenses
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
        variableExpenses: varExp,
        fixedCosts,
        allExpenses,
        principal,
        tier2: -allExpenses,
        tier1: principal - allExpenses,
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

export function PerformanceTiers({ bookings, expenses }: Props) {
  const data = mergePerf(bookings, expenses)
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set([2023, 2024, 2025]))

  const toggleYear = (year: number) =>
    setCollapsedYears(prev => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })

  // Compute YTD running totals — reset at each new year
  let ytd2 = 0
  let ytd1 = 0
  let currentYear = -1
  const rows = data.map(d => {
    if (d.year !== currentYear) { ytd2 = 0; ytd1 = 0; currentYear = d.year }
    ytd2 += d.tier2
    ytd1 += d.tier1
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

  const totRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totVarExp = data.reduce((s, d) => s + d.variableExpenses, 0)
  const totFixed = data.reduce((s, d) => s + d.fixedCosts, 0)
  const totPrincipal = data.reduce((s, d) => s + d.principal, 0)
  const totTier2 = data.reduce((s, d) => s + d.tier2, 0)
  const totTier1 = data.reduce((s, d) => s + d.tier1, 0)

  return (
    <div className="performance-tiers">
      <h2>Performance Tiers</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Revenue</th>
              <th>Fixed Costs</th>
              <th>Variable Exp</th>
              <th className="col-divider">Tier 2</th>
              <th>Tier 2 YTD</th>
              <th className="col-divider">Principal</th>
              <th>Tier 1</th>
              <th>Tier 1 YTD</th>
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
                    <td colSpan={9}>
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
                  {!collapsed && group.map(d => (
                    <tr key={d.key}>
                      <td>{d.label}</td>
                      <td className="positive">{formatCurrency(d.revenue)}</td>
                      <td>{formatCurrency(d.fixedCosts)}</td>
                      <td>{formatCurrency(d.variableExpenses)}</td>
                      <td className={`col-divider${d.tier2 < 0 ? ' negative' : ''}`}>{formatCurrency(d.tier2)}</td>
                      <td className={d.tier2Ytd < 0 ? 'negative' : ''}>{formatCurrency(d.tier2Ytd)}</td>
                      <td className="col-divider positive">{formatCurrency(d.principal)}</td>
                      <td className={d.tier1 < 0 ? 'negative' : ''}>{formatCurrency(d.tier1)}</td>
                      <td className={d.tier1Ytd < 0 ? 'negative' : ''}>{formatCurrency(d.tier1Ytd)}</td>
                    </tr>
                  ))}
                  {collapsed && (
                    <tr key={`year-${year}-summary`} className="year-summary-row">
                      <td className="year-summary-label">12 months hidden</td>
                      <td className="positive">{formatCurrency(group.reduce((s, d) => s + d.revenue, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.fixedCosts, 0))}</td>
                      <td>{formatCurrency(group.reduce((s, d) => s + d.variableExpenses, 0))}</td>
                      <td className={`col-divider${lastRow.tier2Ytd < 0 ? ' negative' : ''}`}>{formatCurrency(lastRow.tier2Ytd)}</td>
                      <td>—</td>
                      <td className="col-divider positive">{formatCurrency(group.reduce((s, d) => s + d.principal, 0))}</td>
                      <td className={lastRow.tier1Ytd < 0 ? 'negative' : ''}>{formatCurrency(lastRow.tier1Ytd)}</td>
                      <td>—</td>
                    </tr>
                  )}
                </>
              )
            })}
            <tr className="total-row">
              <td>Total</td>
              <td className="positive">{formatCurrency(totRevenue)}</td>
              <td>{formatCurrency(totFixed)}</td>
              <td>{formatCurrency(totVarExp)}</td>
              <td className={`col-divider${totTier2 < 0 ? ' negative' : ''}`}>{formatCurrency(totTier2)}</td>
              <td>—</td>
              <td className="col-divider positive">{formatCurrency(totPrincipal)}</td>
              <td className={totTier1 < 0 ? 'negative' : ''}>{formatCurrency(totTier1)}</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
