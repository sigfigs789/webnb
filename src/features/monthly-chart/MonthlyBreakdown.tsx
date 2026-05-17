import { useState, Fragment } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Booking, MonthExpense } from '../../shared/types'
import { aggregateMonthlyRevenue } from '../../shared/revenueDistribution'
import { getPrincipalGained, allPrincipalMonths } from '../../shared/principalGained'
import { getFixedCosts } from '../../shared/fixedCosts'

interface Props {
  bookings: Booking[]
  expenses: MonthExpense[]
}

interface MonthRow {
  key: string
  label: string
  year: number
  month: number
  revenue: number
  cleaning: number
  support: number
  tax: number
  misc: number
  totalExpenses: number
  net: number
  principal: number | null
  fixedCosts: number | null
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function mergeData(bookings: Booking[], expenses: MonthExpense[]): MonthRow[] {
  const map = new Map<string, MonthRow>()

  // Seed all months Dec 2023–Dec 2027 so every principal row appears
  for (const { year, month } of allPrincipalMonths()) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const fixedCosts = getFixedCosts(year, month) ?? 0
    map.set(key, {
      key,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      year,
      month,
      revenue: 0,
      cleaning: 0, support: 0, tax: 0, misc: 0,
      totalExpenses: fixedCosts,
      net: -fixedCosts,
      principal: getPrincipalGained(year, month),
      fixedCosts: getFixedCosts(year, month),
    })
  }

  for (const rev of aggregateMonthlyRevenue(bookings)) {
    const key = `${rev.year}-${String(rev.month).padStart(2, '0')}`
    const existing = map.get(key)
    if (existing) {
      existing.revenue = rev.revenue
      existing.net = rev.revenue - existing.totalExpenses
    } else {
      const fixedCosts = getFixedCosts(rev.year, rev.month) ?? 0
      map.set(key, {
        key,
        label: rev.label,
        year: rev.year,
        month: rev.month,
        revenue: rev.revenue,
        cleaning: 0, support: 0, tax: 0, misc: 0,
        totalExpenses: fixedCosts,
        net: rev.revenue - fixedCosts,
        principal: getPrincipalGained(rev.year, rev.month),
        fixedCosts: getFixedCosts(rev.year, rev.month),
      })
    }
  }

  for (const exp of expenses) {
    const key = `${exp.year}-${String(exp.month).padStart(2, '0')}`
    const varExpenses = exp.cleaning + exp.support + exp.tax + exp.misc
    const existing = map.get(key)
    if (existing) {
      existing.cleaning = exp.cleaning
      existing.support = exp.support
      existing.tax = exp.tax
      existing.misc = exp.misc
      existing.totalExpenses = varExpenses + (existing.fixedCosts ?? 0)
      existing.net = existing.revenue - existing.totalExpenses
    } else {
      const fixedCosts = getFixedCosts(exp.year, exp.month) ?? 0
      const total = varExpenses + fixedCosts
      map.set(key, {
        key,
        label: `${MONTH_NAMES[exp.month - 1]} ${exp.year}`,
        year: exp.year,
        month: exp.month,
        revenue: 0,
        cleaning: exp.cleaning,
        support: exp.support,
        tax: exp.tax,
        misc: exp.misc,
        totalExpenses: total,
        net: -total,
        principal: getPrincipalGained(exp.year, exp.month),
        fixedCosts: getFixedCosts(exp.year, exp.month),
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

function yAxisFormatter(v: number) {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`
  return `$${v}`
}

export function MonthlyBreakdown({ bookings, expenses }: Props) {
  const data = mergeData(bookings, expenses)
  const displayData = data.map(d =>
    d.revenue > 0 ? d : { ...d, totalExpenses: 0, net: 0 }
  )

  const totalRevenue = displayData.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = displayData.reduce((s, d) => s + d.totalExpenses, 0)
  const totalNet = totalRevenue - totalExpenses
  const totalPrincipal = displayData.reduce((s, d) => s + (d.principal ?? 0), 0)
  const totalFixedCosts = displayData.reduce((s, d) => s + (d.fixedCosts ?? 0), 0)

  return (
    <div className="monthly-breakdown">
      <h2>Monthly Breakdown</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={displayData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 12 }} width={55} />
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(value as number),
              name === 'revenue' ? 'Revenue' : name === 'totalExpenses' ? 'Expenses' : 'Net',
            ]}
            contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0' }}
          />
          <Legend formatter={name => name === 'revenue' ? 'Revenue' : name === 'totalExpenses' ? 'Expenses' : 'Net'} />
          <Bar dataKey="revenue" fill="#4f7ef8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="totalExpenses" fill="#fc8181" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Revenue</th>
              <th>Total Expenses</th>
              <th>Net</th>
              <th>Principal Gained</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map(d => (
              <tr key={d.key}>
                <td>{d.label}</td>
                <td>{formatCurrency(d.revenue)}</td>
                <td>{formatCurrency(d.totalExpenses)}</td>
                <td className={d.net < 0 ? 'negative' : ''}>{formatCurrency(d.net)}</td>
                <td>{d.principal !== null ? formatCurrency(d.principal) : '—'}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Total</td>
              <td>{formatCurrency(totalRevenue)}</td>
              <td>{formatCurrency(totalExpenses)}</td>
              <td className={totalNet < 0 ? 'negative' : ''}>{formatCurrency(totalNet)}</td>
              <td>{formatCurrency(totalPrincipal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  )
}
