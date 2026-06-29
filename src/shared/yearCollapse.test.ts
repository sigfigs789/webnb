import { describe, expect, it } from 'vitest'
import { getDefaultCollapsedYears } from './yearCollapse'

describe('getDefaultCollapsedYears', () => {
  it('collapses only years before the current year', () => {
    expect(Array.from(getDefaultCollapsedYears([2023, 2024, 2025, 2026, 2027], 2026))).toEqual([
      2023,
      2024,
      2025,
    ])
  })

  it('keeps the current year and future years expanded by default', () => {
    expect(getDefaultCollapsedYears([2025, 2026, 2027], 2026).has(2026)).toBe(false)
    expect(getDefaultCollapsedYears([2025, 2026, 2027], 2026).has(2027)).toBe(false)
  })

  it('deduplicates repeated years', () => {
    expect(Array.from(getDefaultCollapsedYears([2024, 2024, 2025, 2025], 2026))).toEqual([
      2024,
      2025,
    ])
  })
})
