import { describe, it, expect } from 'vitest'
import { createFormulaMemory } from './useFormulaMemory'

describe('createFormulaMemory', () => {
  it('shows the result at rest and the formula on focus', () => {
    const m = createFormulaMemory()
    expect(m.commit('jan:cleaning', '=500+350')).toBe('850')
    expect(m.recall('jan:cleaning', '850')).toBe('=500+350')
  })

  it('keeps cells apart', () => {
    const m = createFormulaMemory()
    m.commit('jan:cleaning', '=500+350')
    expect(m.recall('feb:cleaning', '850')).toBeNull()
  })

  it('has nothing to recall for a plain number', () => {
    const m = createFormulaMemory()
    expect(m.commit('jan:cleaning', '850')).toBe('850')
    expect(m.recall('jan:cleaning', '850')).toBeNull()
  })

  it('forgets the formula once the cell is typed over', () => {
    const m = createFormulaMemory()
    m.commit('jan:cleaning', '=500+350')
    m.commit('jan:cleaning', '900')
    expect(m.recall('jan:cleaning', '900')).toBeNull()
  })

  it('drops a formula the value has moved away from', () => {
    const m = createFormulaMemory()
    m.commit('jan:cleaning', '=500+350')
    expect(m.recall('jan:cleaning', 1200)).toBeNull()
    expect(m.recall('jan:cleaning', 850)).toBeNull()
  })

  it('tolerates rounding to the cent', () => {
    const m = createFormulaMemory()
    m.commit('jan:cleaning', '=1000/3')
    expect(m.recall('jan:cleaning', 333.33)).toBe('=1000/3')
  })

  it('keeps the raw text of a broken formula and remembers nothing', () => {
    const m = createFormulaMemory()
    expect(m.commit('jan:cleaning', '=500+')).toBe('=500+')
    expect(m.recall('jan:cleaning', '=500+')).toBeNull()
  })

  it('forgets on request', () => {
    const m = createFormulaMemory()
    m.commit('jan:cleaning', '=500+350')
    m.forget('jan:cleaning')
    expect(m.recall('jan:cleaning', '850')).toBeNull()
  })
})
