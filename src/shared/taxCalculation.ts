export const TAX_RATE = 0.04712 + 0.03 + 0.1025

export function getTax(key: string, netRevenue: number, actualTaxes: Record<string, number>): number {
  if (key in actualTaxes) return actualTaxes[key]
  return netRevenue * TAX_RATE
}

/**
 * The pass-through tax inside a booking's recorded revenue. Recorded revenue is
 * the Airbnb payout: what you keep plus the Oahu taxes Airbnb passed through.
 * When no pass-through tax was entered, it is estimated as the tax share of
 * that payout, revenue × rate / (1 + rate).
 */
export function passThroughTaxOf(booking: { revenue: number; passThroughTax: number }): {
  amount: number
  estimated: boolean
} {
  if (booking.passThroughTax > 0) return { amount: booking.passThroughTax, estimated: false }
  return { amount: (Math.max(0, booking.revenue) * TAX_RATE) / (1 + TAX_RATE), estimated: true }
}
