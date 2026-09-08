import { describe, expect, it } from 'vitest'
import {
  getExpectedVarCost,
  getExpectedVarTotal,
  isScheduleActive,
  resolveExpectedForMonth,
} from './expectedVariableCost'

describe('getExpectedVarCost', () => {
  it('expects support only in December, January, June and August', () => {
    for (const month of [12, 1, 6, 8]) {
      expect(getExpectedVarCost(2027, month).support).toBe(150)
    }
    for (const month of [2, 3, 4, 5, 7, 9, 10, 11]) {
      expect(getExpectedVarCost(2027, month).support).toBe(0)
    }
  })

  it('expects a deep cleaning in January and June instead of a regular cleaning', () => {
    expect(getExpectedVarCost(2027, 1).cleaning).toBe(550)
    expect(getExpectedVarCost(2027, 6).cleaning).toBe(550)
    expect(getExpectedVarCost(2027, 7).cleaning).toBe(360)
  })

  it('totals the scheduled amounts for the month', () => {
    expect(getExpectedVarTotal(2027, 1)).toBe(550 + 150 + 200)
    expect(getExpectedVarTotal(2027, 8)).toBe(360 + 150 + 200)
    expect(getExpectedVarTotal(2027, 3)).toBe(360 + 200)
  })
})

describe('resolveExpectedForMonth', () => {
  it('zeroes support outside support months but keeps the base elsewhere', () => {
    const base = { cleaning: 400, support: 175, misc: 250 }
    expect(resolveExpectedForMonth(2027, 3, base)).toEqual({ cleaning: 400, support: 0, misc: 250 })
    expect(resolveExpectedForMonth(2027, 8, base)).toEqual({ cleaning: 400, support: 175, misc: 250 })
  })

  it('overrides cleaning with the deep cleaning cost in deep cleaning months', () => {
    const base = { cleaning: 400, support: 175, misc: 250 }
    expect(resolveExpectedForMonth(2027, 6, base)).toEqual({ cleaning: 550, support: 175, misc: 250 })
  })
})

describe('isScheduleActive', () => {
  it('starts the schedule in October 2026', () => {
    expect(isScheduleActive(2026, 9)).toBe(false)
    expect(isScheduleActive(2026, 10)).toBe(true)
    expect(isScheduleActive(2027, 1)).toBe(true)
    expect(isScheduleActive(2025, 12)).toBe(false)
  })

  it('leaves months before the start on the flat base amounts', () => {
    const base = { cleaning: 360, support: 150, misc: 200 }
    expect(resolveExpectedForMonth(2026, 9, base)).toEqual(base)
    // January would otherwise be a deep cleaning + support month
    expect(resolveExpectedForMonth(2026, 1, base)).toEqual(base)
  })
})
