import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Booking } from '../../shared/types'
import {
  RevenuePerNightPoint,
  monthlyRevenuePerNight,
  yearlyRevenuePerNight,
} from '../../shared/revenuePerNight'

interface Props {
  bookings: Booking[]
}

type Granularity = 'monthly' | 'yearly'

const BAR_COLOR = '#4f7ef8'
const BAR_COLOR_ACTIVE = '#2f5fd8'
const AVERAGE_COLOR = '#e07a5f'

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatCurrencyPrecise(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function RevenuePerNightChart({ bookings }: Props) {
  const [granularity, setGranularity] = useState<Granularity>('monthly')
  const [excludedYears, setExcludedYears] = useState<Set<number>>(() => new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const monthlyPoints = useMemo(() => monthlyRevenuePerNight(bookings), [bookings])
  const yearlyPoints = useMemo(() => yearlyRevenuePerNight(bookings), [bookings])

  const years = useMemo(() => yearlyPoints.map(point => point.year), [yearlyPoints])

  const points = useMemo(() => {
    const source = granularity === 'monthly' ? monthlyPoints : yearlyPoints
    return source.filter(point => !excludedYears.has(point.year))
  }, [granularity, monthlyPoints, yearlyPoints, excludedYears])

  const chartData = useMemo(
    () => points.map(point => ({ ...point, value: point.revenuePerNight })),
    [points]
  )

  const totals = useMemo(() => {
    const revenue = points.reduce((sum, point) => sum + point.revenue, 0)
    const nights = points.reduce((sum, point) => sum + point.nights, 0)
    const values = points.map(point => point.revenuePerNight)
    return {
      average: nights > 0 ? revenue / nights : 0,
      nights,
      best: values.length > 0 ? points[values.indexOf(Math.max(...values))] : null,
      worst: values.length > 0 ? points[values.indexOf(Math.min(...values))] : null,
    }
  }, [points])

  const selected = points.find(point => point.key === selectedKey) ?? null

  const toggleYear = (year: number) =>
    setExcludedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })

  if (monthlyPoints.length === 0) {
    return (
      <div className="revenue-chart">
        <h2>Revenue per night</h2>
        <p className="revenue-chart__empty">Add a booking with check-in and check-out dates to see this chart.</p>
      </div>
    )
  }

  return (
    <div className="revenue-chart">
      <div className="revenue-chart__head">
        <h2>Revenue per night</h2>
        <div className="revenue-chart__controls">
          <div className="revenue-chart__toggle" role="group" aria-label="Granularity">
            {(['monthly', 'yearly'] as Granularity[]).map(option => (
              <button
                key={option}
                type="button"
                className={`revenue-chart__toggle-btn${granularity === option ? ' revenue-chart__toggle-btn--active' : ''}`}
                aria-pressed={granularity === option}
                onClick={() => {
                  setGranularity(option)
                  setSelectedKey(null)
                }}
              >
                {option === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {years.length > 1 && (
        <div className="revenue-chart__years" role="group" aria-label="Years shown">
          {years.map(year => {
            const shown = !excludedYears.has(year)
            return (
              <button
                key={year}
                type="button"
                className={`revenue-chart__year${shown ? ' revenue-chart__year--on' : ''}`}
                aria-pressed={shown}
                onClick={() => {
                  toggleYear(year)
                  setSelectedKey(null)
                }}
              >
                {year}
              </button>
            )
          })}
        </div>
      )}

      {chartData.length === 0 ? (
        <p className="revenue-chart__empty">No years selected. Turn a year back on to see the chart.</p>
      ) : (
        <>
          <div className="revenue-chart__plot">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="#edf1f7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#718096', fontSize: 11 }}
                  stroke="#cbd5e0"
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  tick={{ fill: '#718096', fontSize: 11 }}
                  stroke="#cbd5e0"
                  width={64}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(79, 126, 248, 0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as RevenuePerNightPoint & { value: number }
                    return (
                      <div className="revenue-chart__tooltip">
                        <strong>{point.label}</strong>
                        <span>{formatCurrencyPrecise(point.value)} / night</span>
                        <span>
                          {formatCurrency(point.revenue)} over{' '}
                          {point.nights} {point.nights === 1 ? 'night' : 'nights'}
                        </span>
                      </div>
                    )
                  }}
                />
                <ReferenceLine
                  y={totals.average}
                  stroke={AVERAGE_COLOR}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
                <Bar
                  dataKey="value"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                  onClick={(_, index) => {
                    const key = chartData[index]?.key ?? null
                    setSelectedKey(prev => (prev === key ? null : key))
                  }}
                >
                  {chartData.map(point => (
                    <Cell
                      key={point.key}
                      cursor="pointer"
                      fill={selectedKey === point.key ? BAR_COLOR_ACTIVE : BAR_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="revenue-chart__legend">
            <span className="revenue-chart__legend-line" /> Weighted average{' '}
            {formatCurrencyPrecise(totals.average)} / night across {totals.nights} nights
          </p>

          <div className="revenue-chart__stats">
            <div className="revenue-chart__stat">
              <span className="revenue-chart__stat-label">Best {granularity === 'monthly' ? 'month' : 'year'}</span>
              <span className="revenue-chart__stat-value">
                {totals.best ? `${totals.best.label} · ${formatCurrencyPrecise(totals.best.revenuePerNight)}` : '—'}
              </span>
            </div>
            <div className="revenue-chart__stat">
              <span className="revenue-chart__stat-label">Weakest {granularity === 'monthly' ? 'month' : 'year'}</span>
              <span className="revenue-chart__stat-value">
                {totals.worst ? `${totals.worst.label} · ${formatCurrencyPrecise(totals.worst.revenuePerNight)}` : '—'}
              </span>
            </div>
            <div className="revenue-chart__stat">
              <span className="revenue-chart__stat-label">
                {selected ? 'Selected' : 'Click a bar'}
              </span>
              <span className="revenue-chart__stat-value">
                {selected
                  ? `${selected.label} · ${formatCurrencyPrecise(selected.revenuePerNight)} · ${selected.nights} nights`
                  : 'to pin its detail here'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
