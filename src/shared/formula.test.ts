import { describe, it, expect } from 'vitest'
import { evaluateFormula, cellNumber, resolveCell, isBrokenFormula } from './formula'

describe('evaluateFormula', () => {
  it('reads plain numbers', () => {
    expect(evaluateFormula('850')).toBe(850)
    expect(evaluateFormula('  12.5 ')).toBe(12.5)
    expect(evaluateFormula('.75')).toBe(0.75)
    expect(evaluateFormula('1,250')).toBe(1250)
  })

  it('adds and subtracts', () => {
    expect(evaluateFormula('=500+350')).toBe(850)
    expect(evaluateFormula('=500 + 350 - 100')).toBe(750)
  })

  it('honours operator precedence and parentheses', () => {
    expect(evaluateFormula('=2+3*4')).toBe(14)
    expect(evaluateFormula('=(2+3)*4')).toBe(20)
    expect(evaluateFormula('=100/4/5')).toBe(5)
    expect(evaluateFormula('=2^3^2')).toBe(512)
  })

  it('handles negative and unary signs', () => {
    expect(evaluateFormula('=-50')).toBe(-50)
    expect(evaluateFormula('=100+-25')).toBe(75)
    expect(evaluateFormula('-40')).toBe(-40)
  })

  it('works without the leading equals sign', () => {
    expect(evaluateFormula('500+350')).toBe(850)
  })

  it('trims floating point dust', () => {
    expect(evaluateFormula('=0.1+0.2')).toBe(0.3)
    expect(evaluateFormula('=1250.55*3')).toBe(3751.65)
  })

  it('rejects unusable input', () => {
    expect(evaluateFormula('')).toBeNull()
    expect(evaluateFormula('=')).toBeNull()
    expect(evaluateFormula('=500+')).toBeNull()
    expect(evaluateFormula('=(500+350')).toBeNull()
    expect(evaluateFormula('=500/0')).toBeNull()
    expect(evaluateFormula('=A1+2')).toBeNull()
    expect(evaluateFormula('abc')).toBeNull()
  })
})

describe('cellNumber', () => {
  it('falls back to zero', () => {
    expect(cellNumber('=500+350')).toBe(850)
    expect(cellNumber('')).toBe(0)
    expect(cellNumber('=oops')).toBe(0)
  })
})

describe('resolveCell', () => {
  it('collapses a formula to its result', () => {
    expect(resolveCell('=500+350')).toBe('850')
  })

  it('leaves plain values and broken formulas alone', () => {
    expect(resolveCell('850')).toBe('850')
    expect(resolveCell('')).toBe('')
    expect(resolveCell('=500+')).toBe('=500+')
  })
})

describe('isBrokenFormula', () => {
  it('only flags unusable formulas', () => {
    expect(isBrokenFormula('=500+')).toBe(true)
    expect(isBrokenFormula('=500+350')).toBe(false)
    expect(isBrokenFormula('not a formula')).toBe(false)
  })
})
