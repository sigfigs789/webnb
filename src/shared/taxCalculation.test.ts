import { describe, it, expect } from 'vitest'
import { getTax, passThroughTaxOf, TAX_RATE } from './taxCalculation'

describe('getTax', () => {
  it('returns computed rate when no actual tax exists for the key', () => {
    expect(getTax('2025-06', 1000, {})).toBeCloseTo(1000 * TAX_RATE)
  })

  it('returns personally-entered value when key exists in actualTaxes', () => {
    expect(getTax('2025-06', 1000, { '2025-06': 75 })).toBe(75)
  })

  it('uses personally-entered value for past months', () => {
    expect(getTax('2024-01', 2000, { '2024-01': 150 })).toBe(150)
  })

  it('uses personally-entered value for current and future months', () => {
    expect(getTax('2099-12', 2000, { '2099-12': 99 })).toBe(99)
  })

  it('ignores other keys and falls back to computed rate', () => {
    expect(getTax('2025-06', 500, { '2025-05': 999 })).toBeCloseTo(500 * TAX_RATE)
  })

  it('returns personally-entered 0 rather than computing rate', () => {
    expect(getTax('2025-06', 1000, { '2025-06': 0 })).toBe(0)
  })
})

describe('passThroughTaxOf', () => {
  it('uses the pass-through tax entered on the booking', () => {
    expect(passThroughTaxOf({ revenue: 5000, passThroughTax: 700 })).toEqual({ amount: 700, estimated: false })
  })

  it('estimates the tax share of the payout when none was entered', () => {
    // $5,000 kept plus 17.962% tax on it is a $5,898.10 payout
    const result = passThroughTaxOf({ revenue: 5000 * (1 + TAX_RATE), passThroughTax: 0 })
    expect(result.estimated).toBe(true)
    expect(result.amount).toBeCloseTo(5000 * TAX_RATE)
  })
})
