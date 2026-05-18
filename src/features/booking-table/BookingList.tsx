import { useState, Fragment } from 'react'
import { Booking } from '../../shared/types'

interface Props {
  bookings: Booking[]
  onUpdate: (id: string, updates: Omit<Booking, 'id'>) => void
  onDelete: (id: string) => void
}

type EditValues = {
  name: string
  revenue: string
  bookingDate: string
  startDate: string
  endDate: string
}

function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${m}/${day}/${y}`
}

function calcNights(start: string, end: string) {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const nights = Math.round(ms / 86400000)
  return nights > 0 ? `${nights}n` : '—'
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function BookingList({ bookings, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditValues | null>(null)
  const currentYear = new Date().getFullYear()
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(
    () => new Set(bookings.map(b => Number(b.startDate.slice(0, 4))).filter(y => y < currentYear - 1))
  )

  function startEdit(b: Booking) {
    setEditingId(b.id)
    setEditValues({
      name: b.name,
      revenue: String(b.revenue),
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
    const existing = bookings.find(b => b.id === editingId)
    onUpdate(editingId, {
      name: editValues.name.trim(),
      revenue: Number(editValues.revenue),
      passThroughTax: existing?.passThroughTax ?? 0,
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

  const toggleYear = (year: number) =>
    setCollapsedYears(prev => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })

  const sorted = [...bookings].sort((a, b) => b.startDate.localeCompare(a.startDate))

  // Group by check-in year, newest year first
  const years = Array.from(new Set(sorted.map(b => Number(b.startDate.slice(0, 4))))).sort((a, b) => b - a)
  const byYear = new Map<number, typeof sorted>()
  for (const b of sorted) {
    const year = Number(b.startDate.slice(0, 4))
    const g = byYear.get(year) ?? []
    g.push(b)
    byYear.set(year, g)
  }

  return (
    <div className="booking-list">
      <h2>Bookings</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Gross Revenue</th>
              <th>Booking Date</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Duration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {years.map(year => {
              const group = byYear.get(year)!
              const collapsed = collapsedYears.has(year)
              const yearRevenue = group.reduce((s, b) => s + b.revenue, 0)
              return (
                <Fragment key={`year-${year}`}>
                  <tr className="year-header-row">
                    <td colSpan={7}>
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
                      <td className="year-summary-label">{group.length} bookings hidden</td>
                      <td>{formatCurrency(yearRevenue)}</td>
                      <td colSpan={5}>—</td>
                    </tr>
                  ) : (
                    group.map(b => {
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
                          <td>
                            {isEditing
                              ? calcNights(editValues!.startDate, editValues!.endDate)
                              : calcNights(b.startDate, b.endDate)
                            }
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div className="actions">
                              {isEditing ? (
                                <>
                                  <button className="btn-sm" onClick={saveEdit}>Save</button>
                                  <button className="btn-sm btn-secondary" onClick={cancelEdit}>Cancel</button>
                                </>
                              ) : (
                                <button className="btn-sm btn-danger" onClick={() => {
                                  if (window.confirm(`Delete booking for "${b.name}"?`)) onDelete(b.id)
                                }}>
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
