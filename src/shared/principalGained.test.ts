import { describe, it, expect } from 'vitest'
import { getPrincipalGained, allPrincipalMonths } from './principalGained'

describe('getPrincipalGained', () => {
  it('returns $593 for Dec 2023 (index 0)', () => {
    expect(getPrincipalGained(2023, 12)).toBe(593)
  })

  it('increases by $2.86 each month', () => {
    const dec = getPrincipalGained(2023, 12)!
    const jan = getPrincipalGained(2024, 1)!
    expect(jan - dec).toBeCloseTo(2.86, 5)
  })

  it('returns null for months before Dec 2023', () => {
    expect(getPrincipalGained(2023, 11)).toBeNull()
    expect(getPrincipalGained(2022, 12)).toBeNull()
  })

  it('returns null for months after Dec 2027', () => {
    expect(getPrincipalGained(2028, 1)).toBeNull()
  })

  it('returns a value for Dec 2027 (last valid month)', () => {
    expect(getPrincipalGained(2027, 12)).not.toBeNull()
  })

  it('principal grows monotonically across the full range', () => {
    const months = allPrincipalMonths()
    for (let i = 1; i < months.length; i++) {
      const prev = getPrincipalGained(months[i - 1].year, months[i - 1].month)!
      const curr = getPrincipalGained(months[i].year, months[i].month)!
      expect(curr).toBeGreaterThan(prev)
    }
  })
})

describe('allPrincipalMonths', () => {
  it('starts at Dec 2023', () => {
    const months = allPrincipalMonths()
    expect(months[0]).toEqual({ year: 2023, month: 12 })
  })

  it('ends at Dec 2027', () => {
    const months = allPrincipalMonths()
    expect(months[months.length - 1]).toEqual({ year: 2027, month: 12 })
  })

  it('contains exactly 49 months (Dec 2023 through Dec 2027)', () => {
    expect(allPrincipalMonths()).toHaveLength(49)
  })

  it('has no gaps — consecutive months are always 1 apart', () => {
    const months = allPrincipalMonths()
    for (let i = 1; i < months.length; i++) {
      const prev = months[i - 1]
      const curr = months[i]
      const prevAbsolute = prev.year * 12 + prev.month
      const currAbsolute = curr.year * 12 + curr.month
      expect(currAbsolute - prevAbsolute).toBe(1)
    }
  })
})
