import { useState, useEffect, Fragment } from 'react'
import { Booking } from '../../shared/types'
import { aggregateAirbnbDays } from '../../shared/occupancyDays'
import { useOccupancy } from './useOccupancy'

interface Props {
  bookings: Booking[]
}

type OccupancyDraft = { kindredDays: string; ourDays: string }

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

const zeroDraft = (): OccupancyDraft => ({ kindredDays: '0', ourDays: '0' })

export function OccupancyTable({ bookings }: Props) {
  const { entries, setEntry } = useOccupancy()
  const months = aggregateAirbnbDays(bookings)

  const [drafts, setDrafts] = useState<Record<string, OccupancyDraft>>({})
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set([2023, 2024]))

  // Sync Supabase data into draft state without overwriting in-progress edits
  useEffect(() => {
    setDrafts(prev => {
      const next = { ...prev }
      for (const e of entries) {
        const key = monthKey(e.year, e.month)
        if (!(key in prev)) {
          next[key] = { kindredDays: String(e.kindredDays), ourDays: String(e.ourDays) }
        }
      }
      return next
    })
  }, [entries])

  const toggleYear = (year: number) =>
    setCollapsedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })

  function getDraft(year: number, month: number): OccupancyDraft {
    return drafts[monthKey(year, month)] ?? zeroDraft()
  }

  function setField(year: number, month: number, field: keyof OccupancyDraft, value: string) {
    const key = monthKey(year, month)
    setDrafts(prev => ({ ...prev, [key]: { ...(prev[key] ?? zeroDraft()), [field]: value } }))
  }

  function save(year: number, month: number) {
    const draft = getDraft(year, month)
    setEntry(year, month, {
      kindredDays: Math.max(0, Math.floor(Number(draft.kindredDays) || 0)),
      ourDays: Math.max(0, Math.floor(Number(draft.ourDays) || 0)),
    })
  }

  if (months.length === 0) {
    return (
      <div className="occupancy-table">
        <h2>Total Occupancy</h2>
        <p className="empty-state">Occupancy data will appear once bookings are added.</p>
      </div>
    )
  }

  // Group months by year
  const years = Array.from(new Set(months.map(m => m.year))).sort((a, b) => a - b)
  const byYear = new Map<number, typeof months>()
  for (const m of months) {
    const g = byYear.get(m.year) ?? []
    g.push(m)
    byYear.set(m.year, g)
  }

  const totals = months.reduce(
    (acc, m) => {
      const { kindredDays, ourDays } = getDraft(m.year, m.month)
      const k = Number(kindredDays) || 0
      const o = Number(ourDays) || 0
      const unoccupied = Math.max(0, m.daysInMonth - m.airbnbDays - k - o)
      return {
        airbnb: acc.airbnb + m.airbnbDays,
        kindred: acc.kindred + k,
        our: acc.our + o,
        unoccupied: acc.unoccupied + unoccupied,
        total: acc.total + m.daysInMonth,
      }
    },
    { airbnb: 0, kindred: 0, our: 0, unoccupied: 0, total: 0 }
  )

  return (
    <div className="occupancy-table">
      <h2>Total Occupancy</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Airbnb Days</th>
              <th>Kindred Days</th>
              <th>Our Days</th>
              <th>Unoccupied Days</th>
              <th>Total Days</th>
              <th>Airbnb Occ %</th>
              <th>Total Occ %</th>
            </tr>
          </thead>
          <tbody>
            {years.map(year => {
              const group = byYear.get(year)!
              const collapsed = collapsedYears.has(year)
              const yearTotals = group.reduce(
                (acc, m) => {
                  const { kindredDays, ourDays } = getDraft(m.year, m.month)
                  const k = Number(kindredDays) || 0
                  const o = Number(ourDays) || 0
                  return {
                    airbnb: acc.airbnb + m.airbnbDays,
                    kindred: acc.kindred + k,
                    our: acc.our + o,
                    unoccupied: acc.unoccupied + Math.max(0, m.daysInMonth - m.airbnbDays - k - o),
                    total: acc.total + m.daysInMonth,
                  }
                },
                { airbnb: 0, kindred: 0, our: 0, unoccupied: 0, total: 0 }
              )
              const yearAirbnbPct = yearTotals.total > 0 ? (yearTotals.airbnb / yearTotals.total) * 100 : 0
              const yearTotalPct = yearTotals.total > 0
                ? ((yearTotals.airbnb + yearTotals.kindred + yearTotals.our) / yearTotals.total) * 100
                : 0
              return (
                <Fragment key={`year-${year}`}>
                  <tr className="year-header-row">
                    <td colSpan={8}>
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
                      <td className="year-summary-label">{group.length} months hidden</td>
                      <td>{yearTotals.airbnb}</td>
                      <td>{yearTotals.kindred}</td>
                      <td>{yearTotals.our}</td>
                      <td>{yearTotals.unoccupied}</td>
                      <td>{yearTotals.total}</td>
                      <td className={yearAirbnbPct > 85 ? 'occ-green' : ''}>{yearAirbnbPct.toFixed(1)}%</td>
                      <td className={yearTotalPct > 90 ? 'occ-green' : ''}>{yearTotalPct.toFixed(1)}%</td>
                    </tr>
                  ) : (
                    group.map(m => {
                      const { kindredDays, ourDays } = getDraft(m.year, m.month)
                      const k = Number(kindredDays) || 0
                      const o = Number(ourDays) || 0
                      const unoccupied = Math.max(0, m.daysInMonth - m.airbnbDays - k - o)
                      const airbnbPct = (m.airbnbDays / m.daysInMonth) * 100
                      const totalPct = ((m.airbnbDays + k + o) / m.daysInMonth) * 100
                      return (
                        <tr key={monthKey(m.year, m.month)}>
                          <td>{m.label}</td>
                          <td>{m.airbnbDays}</td>
                          <td>
                            <input
                              className="occupancy-input"
                              type="number"
                              min={0}
                              value={kindredDays}
                              onChange={e => setField(m.year, m.month, 'kindredDays', e.target.value)}
                              onBlur={() => save(m.year, m.month)}
                            />
                          </td>
                          <td>
                            <input
                              className="occupancy-input"
                              type="number"
                              min={0}
                              value={ourDays}
                              onChange={e => setField(m.year, m.month, 'ourDays', e.target.value)}
                              onBlur={() => save(m.year, m.month)}
                            />
                          </td>
                          <td>{unoccupied}</td>
                          <td>{m.daysInMonth}</td>
                          <td className={airbnbPct > 85 ? 'occ-green' : ''}>{airbnbPct.toFixed(1)}%</td>
                          <td className={totalPct > 90 ? 'occ-green' : ''}>{totalPct.toFixed(1)}%</td>
                        </tr>
                      )
                    })
                  )}
                </Fragment>
              )
            })}
            <tr className="total-row">
              <td>Total</td>
              <td>{totals.airbnb}</td>
              <td>{totals.kindred}</td>
              <td>{totals.our}</td>
              <td>{totals.unoccupied}</td>
              <td>{totals.total}</td>
              <td className={totals.total > 0 && (totals.airbnb / totals.total) * 100 > 85 ? 'occ-green' : ''}>
                {totals.total > 0 ? ((totals.airbnb / totals.total) * 100).toFixed(1) + '%' : '—'}
              </td>
              <td className={totals.total > 0 && ((totals.airbnb + totals.kindred + totals.our) / totals.total) * 100 > 90 ? 'occ-green' : ''}>
                {totals.total > 0 ? (((totals.airbnb + totals.kindred + totals.our) / totals.total) * 100).toFixed(1) + '%' : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
