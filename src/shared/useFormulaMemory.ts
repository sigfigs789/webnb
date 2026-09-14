import { useRef } from 'react'
import { evaluateFormula, resolveCell } from './formula'

// Amounts are stored to the cent, so a remembered formula still counts as the
// source of the value it produced even after rounding.
const TOLERANCE = 0.005

/**
 * Remembers the formula behind a cell's value, so the cell can read like a
 * spreadsheet: the result while at rest, the formula again once focused.
 *
 * Cells are addressed by an arbitrary id — a month key, a field name, or both.
 */
export function createFormulaMemory() {
  const sources: Record<string, string> = {}

  /** Commit a cell. Returns the text to display, remembering any formula. */
  function commit(id: string, raw: string): string {
    const trimmed = raw.trim()
    const resolved = resolveCell(raw)
    if (trimmed.startsWith('=') && resolved !== raw) sources[id] = trimmed
    else delete sources[id]
    return resolved
  }

  /**
   * Focus a cell. Returns the formula to edit, or null when there is none — or
   * when the value has since moved on, in which case the formula is dropped.
   */
  function recall(id: string, current: string | number): string | null {
    const source = sources[id]
    if (!source) return null
    const result = evaluateFormula(source)
    const value = typeof current === 'number' ? current : evaluateFormula(current)
    if (result === null || value === null || Math.abs(result - value) > TOLERANCE) {
      delete sources[id]
      return null
    }
    return source
  }

  /** Drop a cell's formula, for values replaced from somewhere other than the cell. */
  function forget(id: string) {
    delete sources[id]
  }

  return { commit, recall, forget }
}

export type FormulaMemory = ReturnType<typeof createFormulaMemory>

/** React binding: one formula memory for the lifetime of the component. */
export function useFormulaMemory(): FormulaMemory {
  const memory = useRef<FormulaMemory>()
  if (!memory.current) memory.current = createFormulaMemory()
  return memory.current
}
