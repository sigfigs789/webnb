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
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function mergeData(bookings: Booking[], expenses: MonthExpense[]): MonthRow[] {
  const map = new Map<string, MonthRow>()

  for (const rev of aggregateMonthlyRevenue(bookings)) {
    const key = `${rev.year}-${String(rev.month).padStart(2, '0')}`
    map.set(key, {
      key,
      label: rev.label,
      year: rev.year,
      month: rev.month,
      revenue: rev.revenue,
      cleaning: 0, support: 0, tax: 0, misc: 0,
      totalExpenses: 0,
      net: rev.revenue,
    })
  }

  for (const exp of expenses) {
    const key = `${exp.year}-${String(exp.month).padStart(2, '0')}`
    const total = exp.cleaning + exp.support + exp.tax + exp.misc
    const existing = map.get(key)
    if (existing) {
      existing.cleaning = exp.cleaning
      existing.support = exp.support
      existing.tax = exp.tax
      existing.misc = exp.misc
      existing.totalExpenses = total
      existing.net = existing.revenue - total
    } else {
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

  if (data.length === 0) {
    return (
      <div className="monthly-breakdown">
        <h2>Monthly Breakdown</h2>
        <p className="empty-state">Monthly breakdown will appear here once bookings or expenses are added.</p>
      </div>
    )
  }

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = data.reduce((s, d) => s + d.totalExpenses, 0)
  const totalNet = totalRevenue - totalExpenses

  return (
    <div className="monthly-breakdown">
      <h2>Monthly Breakdown</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
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
              <th>Cleaning</th>
              <th>Support</th>
              <th>Tax</th>
              <th>Misc</th>
              <th>Total Expenses</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.key}>
                <td>{d.label}</td>
                <td>{formatCurrency(d.revenue)}</td>
                <td>{formatCurrency(d.cleaning)}</td>
                <td>{formatCurrency(d.support)}</td>
                <td>{formatCurrency(d.tax)}</td>
                <td>{formatCurrency(d.misc)}</td>
                <td>{formatCurrency(d.totalExpenses)}</td>
                <td className={d.net < 0 ? 'negative' : ''}>{formatCurrency(d.net)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Total</td>
              <td>{formatCurrency(totalRevenue)}</td>
              <td colSpan={4}></td>
              <td>{formatCurrency(totalExpenses)}</td>
              <td className={totalNet < 0 ? 'negative' : ''}>{formatCurrency(totalNet)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
