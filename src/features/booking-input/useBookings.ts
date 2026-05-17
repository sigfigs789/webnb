import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Booking } from '../../shared/types'

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setBookings(data.map(toBooking))
        setLoading(false)
      })
  }, [])

  async function addBooking(booking: Omit<Booking, 'id'>) {
    const { data, error } = await supabase
      .from('bookings')
      .insert([toRow(booking)])
      .select()
      .single()
    if (!error && data) setBookings(prev => [toBooking(data), ...prev])
  }

  async function updateBooking(id: string, updates: Omit<Booking, 'id'>) {
    const { data, error } = await supabase
      .from('bookings')
      .update(toRow(updates))
      .eq('id', id)
      .select()
      .single()
    if (!error && data)
      setBookings(prev => prev.map(b => (b.id === id ? toBooking(data) : b)))
  }

  async function deleteBooking(id: string) {
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (!error) setBookings(prev => prev.filter(b => b.id !== id))
  }

  return { bookings, loading, addBooking, updateBooking, deleteBooking }
}

// Map between camelCase (app) and snake_case (Supabase)
function toBooking(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    name: row.name as string,
    revenue: row.revenue as number,
    bookingDate: row.booking_date as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
  }
}

function toRow(b: Omit<Booking, 'id'>) {
  return {
    name: b.name,
    revenue: b.revenue,
    booking_date: b.bookingDate,
    start_date: b.startDate,
    end_date: b.endDate,
  }
}
