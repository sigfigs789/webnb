import { Booking } from '../../shared/types'
import { aggregateAirbnbDays } from '../../shared/occupancyDays'
import { useOccupancy } from './useOccupancy'

interface Props {
  bookings: Booking[]
}

export function OccupancyTable({ bookings }: Props) {
  const { getEntry, setEntry } = useOccupancy()
  const months = aggregateAirbnbDays(bookings)

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
      const { kindredDays, ourDays } = getEntry(m.year, m.month)
      const unoccupied = Math.max(0, m.daysInMonth - m.airbnbDays - kindredDays - ourDays)
      return {
        airbnb: acc.airbnb + m.airbnbDays,
        kindred: acc.kindred + kindredDays,
        our: acc.our + ourDays,
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
              const { kindredDays, ourDays } = getEntry(m.year, m.month)
              const unoccupied = Math.max(0, m.daysInMonth - m.airbnbDays - kindredDays - ourDays)
              const airbnbPct = (m.airbnbDays / m.daysInMonth) * 100
              const totalOccupiedDays = m.airbnbDays + kindredDays + ourDays
              const totalPct = (totalOccupiedDays / m.daysInMonth) * 100

              return (
                <tr key={`${m.year}-${m.month}`}>
                  <td>{m.label}</td>
                  <td>{m.airbnbDays}</td>
                  <td>
                    <input
                      className="occupancy-input"
                      type="number"
                      min={0}
                      value={kindredDays}
                      onChange={e =>
                        setEntry(m.year, m.month, { kindredDays: Math.max(0, Math.floor(Number(e.target.value))) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="occupancy-input"
                      type="number"
                      min={0}
                      value={ourDays}
                      onChange={e =>
                        setEntry(m.year, m.month, { ourDays: Math.max(0, Math.floor(Number(e.target.value))) })
                      }
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
