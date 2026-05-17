import { useState, useEffect } from 'react'
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
            {months.map(m => {
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
