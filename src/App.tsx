import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useBookings } from './features/booking-input/useBookings'
import { useExpenses } from './features/expenses/useExpenses'
import { BookingForm } from './features/booking-input/BookingForm'
import { BookingList } from './features/booking-table/BookingList'
import { ExpenseForm } from './features/expenses/ExpenseForm'
import { OccupancyTable } from './features/occupancy/OccupancyTable'
import { PerformanceTiers } from './features/performance/PerformanceTiers'
import './App.css'

const TABS = [
  { path: '/performance', label: 'Performance' },
  { path: '/bookings', label: 'Booking' },
  { path: '/occupancy', label: 'Occupancy' },
  { path: '/expenses', label: 'Expected expenses' },
]

const WIDE_ROUTES = new Set(TABS.map(tab => tab.path))

function App() {
  const { bookings, loading: bookingsLoading, addBooking, updateBooking, deleteBooking } = useBookings()
  const { expenses, loading: expensesLoading, setExpense } = useExpenses()
  const isLoading = bookingsLoading || expensesLoading
  const location = useLocation()
  const isWideRoute = WIDE_ROUTES.has(location.pathname)

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

      <main className={`app-main${isWideRoute ? ' app-main--wide' : ''}`}>
        {isLoading ? (
          <div className="loading-state">Loading…</div>
        ) : (
        <Routes>
          <Route path="/" element={<Navigate to="/performance" replace />} />

          <Route path="/bookings" element={
            <>
              <section className="card">
                <BookingForm onSubmit={addBooking} />
              </section>
              <section className="card">
                <BookingList bookings={bookings} onUpdate={updateBooking} onDelete={deleteBooking} />
              </section>
            </>
          } />

          <Route path="/expenses" element={
            <section className="card">
              <ExpenseForm expenses={expenses} onSubmit={setExpense} />
            </section>
          } />

          <Route path="/occupancy" element={
            <section className="card">
              <OccupancyTable bookings={bookings} />
            </section>
          } />

          <Route path="/performance" element={
            <section className="card">
              <PerformanceTiers bookings={bookings} expenses={expenses} onSetExpense={setExpense} />
            </section>
          } />
        </Routes>
        )}
      </main>
    </div>
  )
}

export default App
