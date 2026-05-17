import { useState } from 'react'
import { Booking } from '../../shared/types'

interface Props {
  bookings: Booking[]
  onUpdate: (id: string, updates: Omit<Booking, 'id'>) => void
  onDelete: (id: string) => void
}

type EditValues = {
  name: string
  revenue: string
  passThroughTax: string
  bookingDate: string
  startDate: string
  endDate: string
}

function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function BookingList({ bookings, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditValues | null>(null)

  function startEdit(b: Booking) {
    setEditingId(b.id)
    setEditValues({
      name: b.name,
      revenue: String(b.revenue),
      passThroughTax: String(b.passThroughTax),
      bookingDate: b.bookingDate,
      startDate: b.startDate,
      endDate: b.endDate,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues(null)
  }

  function saveEdit() {
    if (!editingId || !editValues) return
    onUpdate(editingId, {
      name: editValues.name.trim(),
      revenue: Number(editValues.revenue),
      passThroughTax: Number(editValues.passThroughTax) || 0,
      bookingDate: editValues.bookingDate,
      startDate: editValues.startDate,
      endDate: editValues.endDate,
    })
    setEditingId(null)
    setEditValues(null)
  }

  function setField(key: keyof EditValues, value: string) {
    setEditValues(v => (v ? { ...v, [key]: value } : v))
  }

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
              <th>Pass Through Tax</th>
              <th>Booking Date</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(b => {
              const isEditing = b.id === editingId
              return (
                <tr
                  key={b.id}
                  className={isEditing ? 'row-editing' : 'row-clickable'}
                  onClick={!isEditing ? () => startEdit(b) : undefined}
                >
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValues!.name}
                        onChange={e => setField('name', e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      b.name
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues!.revenue}
                        onChange={e => setField('revenue', e.target.value)}
                        min="0"
                        step="any"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      formatCurrency(b.revenue)
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues!.passThroughTax}
                        onChange={e => setField('passThroughTax', e.target.value)}
                        min="0"
                        step="any"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      formatCurrency(b.passThroughTax)
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editValues!.bookingDate}
                        onChange={e => setField('bookingDate', e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      formatDate(b.bookingDate)
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editValues!.startDate}
                        onChange={e => setField('startDate', e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      formatDate(b.startDate)
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editValues!.endDate}
                        onChange={e => setField('endDate', e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      formatDate(b.endDate)
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="actions">
                      {isEditing ? (
                        <>
                          <button className="btn-sm" onClick={saveEdit}>Save</button>
                          <button className="btn-sm btn-secondary" onClick={cancelEdit}>Cancel</button>
                        </>
                      ) : (
                        <button className="btn-sm btn-danger" onClick={() => onDelete(b.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
