import { useState } from 'react'
import type { Booking } from './shared/types'
import { useBookings } from './features/booking-input/useBookings'
import { useExpenses } from './features/expenses/useExpenses'
import { BookingForm } from './features/booking-input/BookingForm'
import { BookingList } from './features/booking-table/BookingList'
import { ExpenseForm } from './features/expenses/ExpenseForm'
import { MonthlyBreakdown } from './features/monthly-chart/MonthlyBreakdown'
import { OccupancyTable } from './features/occupancy/OccupancyTable'
import './App.css'

type Tab = 'bookings' | 'expenses' | 'monthly' | 'occupancy'

const TABS: { id: Tab; label: string }[] = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'monthly', label: 'Monthly Breakdown' },
  { id: 'occupancy', label: 'Occupancy' },
]

function App() {
  const { bookings, addBooking, updateBooking, deleteBooking } = useBookings()
  const { expenses, setExpense } = useExpenses()
  const [activeTab, setActiveTab] = useState<Tab>('bookings')
  const [editingId, setEditingId] = useState<string | null>(null)

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
    setActiveTab('bookings')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Rental Cashflow Tracker</h1>
      </header>

      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'bookings' && (
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
        )}

        {activeTab === 'expenses' && (
          <section className="card">
            <ExpenseForm expenses={expenses} onSubmit={setExpense} />
          </section>
        )}

        {activeTab === 'monthly' && (
          <section className="card">
            <MonthlyBreakdown bookings={bookings} expenses={expenses} />
          </section>
        )}

        {activeTab === 'occupancy' && (
          <section className="card">
            <OccupancyTable bookings={bookings} />
          </section>
        )}
      </main>
    </div>
  )
}

export default App
