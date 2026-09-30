// Spreadsheet-style input: a cell may hold a plain number ("850") or a formula
// ("=500+350"), which is evaluated when the cell is committed.

/** Tooltip shown on every formula-capable cell. */
export const FORMULA_HINT = 'Type a number, or a formula like =500+350'

type Token = { type: 'number'; value: number } | { type: 'op'; value: string }

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === ' ' || ch === ',') {
      i++
      continue
    }
    if (ch >= '0' && ch <= '9') {
      let j = i
      while (j < input.length && ((input[j] >= '0' && input[j] <= '9') || input[j] === ',')) j++
      if (input[j] === '.') {
        j++
        while (j < input.length && input[j] >= '0' && input[j] <= '9') j++
      }
      tokens.push({ type: 'number', value: Number(input.slice(i, j).replace(/,/g, '')) })
      i = j
      continue
    }
    if (ch === '.') {
      let j = i + 1
      while (j < input.length && input[j] >= '0' && input[j] <= '9') j++
      if (j === i + 1) return null
      tokens.push({ type: 'number', value: Number(input.slice(i, j)) })
      i = j
      continue
    }
    if ('+-*/^()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    return null
  }
  return tokens
}

// Recursive descent: expr → term (+|- term)*, term → factor (*|/ factor)*,
// factor → unary (^ factor)?, unary → (+|-)* primary, primary → number | ( expr )
function parse(tokens: Token[]): number | null {
  let pos = 0

  function peek(): Token | undefined {
    return tokens[pos]
  }

  function eatOp(...ops: string[]): string | null {
    const t = peek()
    if (t && t.type === 'op' && ops.includes(t.value)) {
      pos++
      return t.value
    }
    return null
  }

  function expr(): number | null {
    let left = term()
    if (left === null) return null
    for (;;) {
      const op = eatOp('+', '-')
      if (!op) return left
      const right = term()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
  }

  function term(): number | null {
    let left = factor()
    if (left === null) return null
    for (;;) {
      const op = eatOp('*', '/')
      if (!op) return left
      const right = factor()
      if (right === null) return null
      if (op === '/' && right === 0) return null
      left = op === '*' ? left * right : left / right
    }
  }

  function factor(): number | null {
    const base = unary()
    if (base === null) return null
    if (!eatOp('^')) return base
    const exponent = factor() // right associative
    if (exponent === null) return null
    const result = base ** exponent
    return Number.isFinite(result) ? result : null
  }

  function unary(): number | null {
    const op = eatOp('+', '-')
    if (op) {
      const value = unary()
      if (value === null) return null
      return op === '-' ? -value : value
    }
    return primary()
  }

  function primary(): number | null {
    const t = peek()
    if (!t) return null
    if (t.type === 'number') {
      pos++
      return t.value
    }
    if (t.value === '(') {
      pos++
      const value = expr()
      if (value === null) return null
      return eatOp(')') ? value : null
    }
    return null
  }

  const value = expr()
  if (value === null || pos !== tokens.length) return null
  return value
}

// Trim the binary-float dust from things like =0.1+0.2 without losing precision
// that the user actually typed.
function tidy(value: number): number {
  return Number(value.toPrecision(12))
}

/**
 * Evaluate a spreadsheet-style cell value. Returns null when the input is not a
 * usable number — an empty cell, a half-typed formula, or a bad expression.
 */
export function evaluateFormula(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const body = trimmed.startsWith('=') ? trimmed.slice(1) : trimmed
  const tokens = tokenize(body)
  if (!tokens || tokens.length === 0) return null
  const value = parse(tokens)
  if (value === null || !Number.isFinite(value)) return null
  return tidy(value)
}

/** Evaluate a cell value for arithmetic, treating anything unusable as 0. */
export function cellNumber(raw: string): number {
  return evaluateFormula(raw) ?? 0
}

/**
 * What a cell should show once it is committed: a resolved formula collapses to
 * its result, anything else is left exactly as the user typed it.
 */
export function resolveCell(raw: string): string {
  if (!raw.trim().startsWith('=')) return raw
  const value = evaluateFormula(raw)
  return value === null ? raw : String(value)
}

/** True when the cell holds a formula that cannot be evaluated. */
export function isBrokenFormula(raw: string): boolean {
  return raw.trim().startsWith('=') && evaluateFormula(raw) === null
}
