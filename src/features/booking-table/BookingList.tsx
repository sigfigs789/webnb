import { Booking } from '../../shared/types'

interface Props {
  bookings: Booking[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function BookingList({ bookings, onEdit, onDelete }: Props) {
  if (bookings.length === 0) {
    return (
      <div className="booking-list">
        <h2>Bookings</h2>
        <p className="empty-state">No bookings yet. Add one above.</p>
      </div>
    )
  }

  const sorted = [...bookings].sort((a, b) => b.startDate.localeCompare(a.startDate))

  return (
    <div className="booking-list">
      <h2>Bookings</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Revenue</th>
              <th>Booking Date</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(b => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{formatCurrency(b.revenue)}</td>
                <td>{formatDate(b.bookingDate)}</td>
                <td>{formatDate(b.startDate)}</td>
                <td>{formatDate(b.endDate)}</td>
                <td>
                  <div className="actions">
                    <button className="btn-sm" onClick={() => onEdit(b.id)}>
                      Edit
                    </button>
                    <button className="btn-sm btn-danger" onClick={() => onDelete(b.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
