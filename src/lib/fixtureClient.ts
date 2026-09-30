import type { SupabaseClient } from '@supabase/supabase-js'
import { FIXTURE_TABLES } from './fixtures'

// A tiny in-memory stand-in for the Supabase client, covering only the calls
// the hooks make: select/insert/update/upsert/delete with eq, order and single.
// Changes persist in this browser's localStorage so they survive a reload.

type Row = Record<string, unknown>
type Result = { data: unknown; error: null }

const STORAGE_KEY = 'webnb-fixtures'

function load(): Record<string, Row[]> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // Storage unavailable or corrupt: start from the seed data
  }
  return structuredClone(FIXTURE_TABLES)
}

let tables = load()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tables))
  } catch {
    // Keep working in memory only
  }
}

export function resetFixtures() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing saved to clear
  }
  tables = structuredClone(FIXTURE_TABLES)
}

function rowsOf(table: string): Row[] {
  if (!tables[table]) tables[table] = []
  return tables[table]
}

let nextId = Date.now()

class Query implements PromiseLike<Result> {
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Row[] = []
  private conflict: string[] = []
  private filters: [string, unknown][] = []
  private sort: { column: string; ascending: boolean } | null = null
  private one = false

  constructor(private table: string) {}

  select() {
    // After a write, select() just asks for the written rows back
    return this
  }

  insert(rows: Row | Row[]) {
    this.action = 'insert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this
  }

  update(values: Row) {
    this.action = 'update'
    this.payload = [values]
    return this
  }

  upsert(rows: Row | Row[], options?: { onConflict?: string }) {
    this.action = 'upsert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    this.conflict = (options?.onConflict ?? 'id').split(',').map(c => c.trim())
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value])
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sort = { column, ascending: options?.ascending ?? true }
    return this
  }

  single() {
    this.one = true
    return this
  }

  private matches(row: Row) {
    return this.filters.every(([column, value]) => row[column] === value)
  }

  private run(): unknown {
    const rows = rowsOf(this.table)
    let result: Row[] = []

    if (this.action === 'select') {
      result = rows.filter(row => this.matches(row))
      if (this.sort) {
        const { column, ascending } = this.sort
        result = [...result].sort((a, b) => {
          const order = String(a[column]).localeCompare(String(b[column]))
          return ascending ? order : -order
        })
      }
    } else if (this.action === 'insert') {
      result = this.payload.map(row => ({ id: `fixture-${nextId++}`, ...row }))
      rows.push(...result)
    } else if (this.action === 'update') {
      for (const row of rows) if (this.matches(row)) Object.assign(row, this.payload[0])
      result = rows.filter(row => this.matches(row))
    } else if (this.action === 'upsert') {
      result = this.payload.map(incoming => {
        const existing = rows.find(row => this.conflict.every(c => row[c] === incoming[c]))
        if (existing) return Object.assign(existing, incoming)
        const created = { id: `fixture-${nextId++}`, ...incoming }
        rows.push(created)
        return created
      })
    } else {
      tables[this.table] = rows.filter(row => !this.matches(row))
    }

    if (this.action !== 'select') save()
    const copies = result.map(row => ({ ...row }))
    return this.one ? copies[0] ?? null : copies
  }

  then<T1 = Result, T2 = never>(
    onFulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve({ data: this.run(), error: null }).then(onFulfilled, onRejected)
  }
}

export function createFixtureClient(): SupabaseClient {
  return { from: (table: string) => new Query(table) } as unknown as SupabaseClient
}
