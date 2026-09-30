// Made-up data for playing with the app locally without touching Supabase.
// Kept permanently as a reference playground; fixtures.test.ts pins what it shows.
// Revenue is the recorded Airbnb payout, pass-through tax included, just as the
// Booking tab records it. Some bookings leave pass-through tax at 0 so the
// booking table's estimate shows up.

type Row = Record<string, unknown>

function booking(
  id: number,
  name: string,
  startDate: string,
  endDate: string,
  revenue: number,
  passThroughTax: number,
  bookingDate: string
): Row {
  return {
    id: `fixture-${id}`,
    name,
    revenue,
    pass_through_tax: passThroughTax,
    booking_date: bookingDate,
    start_date: startDate,
    end_date: endDate,
  }
}

export const FIXTURE_TABLES: Record<string, Row[]> = {
  bookings: [
    booking(1, 'Kalani family', '2025-01-05', '2025-02-10', 7400, 1127, '2024-10-12'),
    booking(2, 'Traveling nurse (J. Ortiz)', '2025-06-01', '2025-07-06', 8900, 0, '2025-03-02'),
    booking(3, 'Summer sabbatical', '2025-07-06', '2025-08-15', 10800, 1645, '2025-02-20'),
    booking(4, 'Remote worker (P. Singh)', '2025-11-01', '2025-12-15', 8200, 1249, '2025-08-30'),
    booking(5, 'Spring family visit', '2026-03-01', '2026-04-05', 7600, 0, '2025-12-04'),
    booking(6, 'Mainland relocation', '2026-06-25', '2026-08-01', 10400, 1584, '2026-02-11'),
    booking(7, 'Surf season stay', '2026-08-01', '2026-09-05', 9100, 1386, '2026-04-18'),
    booking(8, 'Holiday snowbirds', '2026-12-10', '2027-01-20', 9800, 0, '2026-07-22'),
    // Leaves 24 nights before the analyzer's default Jul 4 check-in: too short for a 30-night stay
    booking(9, 'Spring researcher', '2027-05-01', '2027-06-10', 9200, 1401, '2026-09-10'),
    // Leaves 13 nights after the default Aug 7 check-out
    booking(10, 'Fall contract (M. Lee)', '2027-08-20', '2027-10-01', 10100, 0, '2026-09-25'),
  ],
}
