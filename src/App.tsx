import { useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import type { Booking } from './shared/types'
import { useBookings } from './features/booking-input/useBookings'
import { useExpenses } from './features/expenses/useExpenses'
import { BookingForm } from './features/booking-input/BookingForm'
import { BookingList } from './features/booking-table/BookingList'
import { ExpenseForm } from './features/expenses/ExpenseForm'
import { MonthlyBreakdown } from './features/monthly-chart/MonthlyBreakdown'
import { OccupancyTable } from './features/occupancy/OccupancyTable'
import './App.css'

const TABS = [
  { path: '/bookings', label: 'Bookings' },
  { path: '/expenses', label: 'Expenses' },
  { path: '/monthly', label: 'Monthly Breakdown' },
  { path: '/occupancy', label: 'Occupancy' },
]

function App() {
  const { bookings, addBooking, updateBooking, deleteBooking } = useBookings()
  const { expenses, setExpense } = useExpenses()
  const [editingId, setEditingId] = useState<string | null>(null)
  const navigate = useNavigate()

  const editingBooking = editingId ? bookings.find(b => b.id === editingId) : undefined

  function handleBookingSubmit(values: Omit<Booking, 'id'>) {
    if (editingId) {
      updateBooking(editingId, values)
      setEditingId(null)
    } else {
      addBooking(values)
    }
  }

  function handleEdit(id: string) {
    setEditingId(id)
    navigate('/bookings')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Rental Cashflow Tracker</h1>
      </header>

      <nav className="tab-nav">
        {TABS.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => `tab-btn${isActive ? ' tab-btn--active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/bookings" replace />} />

          <Route path="/bookings" element={
            <>
              <section className="card">
                <BookingForm
                  onSubmit={handleBookingSubmit}
                  initialValues={editingBooking}
                  onCancel={() => setEditingId(null)}
                />
              </section>
              <section className="card">
                <BookingList bookings={bookings} onEdit={handleEdit} onDelete={deleteBooking} />
              </section>
            </>
          } />

          <Route path="/expenses" element={
            <section className="card">
              <ExpenseForm expenses={expenses} onSubmit={setExpense} />
            </section>
          } />

          <Route path="/monthly" element={
            <section className="card">
              <MonthlyBreakdown bookings={bookings} expenses={expenses} />
            </section>
          } />

          <Route path="/occupancy" element={
            <section className="card">
              <OccupancyTable bookings={bookings} />
            </section>
          } />
        </Routes>
      </main>
    </div>
  )
}

export default App
