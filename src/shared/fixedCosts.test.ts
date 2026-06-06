import { describe, it, expect } from 'vitest'
import { getFixedCosts, applyOurDaysAdjustment } from './fixedCosts'

describe('getFixedCosts', () => {
  it('returns $4,150 for Dec 2023', () => {
    expect(getFixedCosts(2023, 12)).toBe(4150)
  })

  it('returns $4,150 for every month in 2024', () => {
    for (let m = 1; m <= 12; m++) {
      expect(getFixedCosts(2024, m)).toBe(4150)
    }
  })

  it('returns HOA+Mortgage+Utilities total for 2025', () => {
    const expected = 987.47 + 3148 + 180
    for (let m = 1; m <= 12; m++) {
      expect(getFixedCosts(2025, m)).toBeCloseTo(expected, 2)
    }
  })

  it('returns updated HOA+Mortgage+Utilities total for 2026', () => {
    const expected = 1100 + 3148.50 + 180
    for (let m = 1; m <= 12; m++) {
      expect(getFixedCosts(2026, m)).toBeCloseTo(expected, 2)
    }
  })

  it('returns same value for 2027 as 2026', () => {
    expect(getFixedCosts(2027, 6)).toBe(getFixedCosts(2026, 6))
  })

  it('returns null for months before Dec 2023', () => {
    expect(getFixedCosts(2023, 11)).toBeNull()
    expect(getFixedCosts(2022, 12)).toBeNull()
  })

  it('returns null for months after Dec 2027', () => {
    expect(getFixedCosts(2028, 1)).toBeNull()
  })
})

describe('applyOurDaysAdjustment', () => {
  it('returns full cost when ourDays is 0', () => {
    expect(applyOurDaysAdjustment(4150, 0, 30)).toBe(4150)
  })

  it('returns full cost when ourDays is negative', () => {
    expect(applyOurDaysAdjustment(4150, -5, 30)).toBe(4150)
  })

  it('returns 0 when ourDays equals daysInMonth', () => {
    expect(applyOurDaysAdjustment(4150, 30, 30)).toBe(0)
  })

  it('reduces cost proportionally — 20 of 30 days means 1/3 of cost', () => {
    expect(applyOurDaysAdjustment(3000, 20, 30)).toBeCloseTo(1000, 5)
  })

  it('reduces cost proportionally — 10 of 31 days', () => {
    expect(applyOurDaysAdjustment(3100, 10, 31)).toBeCloseTo(2100, 5)
  })

  it('clamps to 0 when ourDays exceeds daysInMonth', () => {
    expect(applyOurDaysAdjustment(4150, 35, 30)).toBe(0)
  })
})
