export const TAX_RATE = 0.04712 + 0.03 + 0.1025

export function getTax(key: string, netRevenue: number, actualTaxes: Record<string, number>): number {
  if (key in actualTaxes) return actualTaxes[key]
  return netRevenue * TAX_RATE
}
