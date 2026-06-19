import { describe, it, expect } from 'vitest'
import { getTax, TAX_RATE } from './taxCalculation'

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
