import { describe, it, expect, beforeEach } from 'vitest'
import { createFixtureClient, resetFixtures } from './fixtureClient'

describe('fixture client', () => {
  beforeEach(() => resetFixtures())

  it('serves the seeded bookings, sorted', async () => {
    const { data } = await createFixtureClient().from('bookings').select('*').order('start_date', { ascending: false })
    const rows = data as { start_date: string }[]
    expect(rows).toHaveLength(10)
    expect(rows[0].start_date > rows[rows.length - 1].start_date).toBe(true)
  })

  it('inserts, updates and deletes rows', async () => {
    const client = createFixtureClient()
    const { data: created } = await client.from('bookings').insert([{ name: 'New guest', revenue: 1 }]).select().single()
    const id = (created as { id: string }).id
    await client.from('bookings').update({ revenue: 2 }).eq('id', id).select().single()
    const { data: updated } = await client.from('bookings').select('*').eq('id', id)
    expect((updated as { revenue: number }[])[0].revenue).toBe(2)
    await client.from('bookings').delete().eq('id', id)
    const { data: all } = await client.from('bookings').select('*')
    expect(all).toHaveLength(10)
  })

  it('upserts on the conflict columns', async () => {
    const client = createFixtureClient()
    await client.from('expenses').upsert([{ year: 2026, month: 1, cleaning: 100 }], { onConflict: 'year,month' })
    await client.from('expenses').upsert([{ year: 2026, month: 1, cleaning: 150 }], { onConflict: 'year,month' })
    const { data } = await client.from('expenses').select('*')
    expect(data).toEqual([expect.objectContaining({ year: 2026, month: 1, cleaning: 150 })])
  })
})
