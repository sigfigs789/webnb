// Heartbeat that keeps the Supabase project from being paused for inactivity.
//
// Free-tier Supabase projects are paused after ~7 days without activity, and a
// paused project stops resolving in DNS, so a ping cannot wake it back up — it
// has to be restored from the dashboard. This runs daily (see `crons` in
// vercel.json) to make sure that never happens.
//
// Runs server-side, so it reads the Supabase env vars from process.env rather
// than the VITE_-prefixed values that get inlined into the browser bundle.

const TABLE = 'bookings'
const TIMEOUT_MS = 10_000

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    return Response.json(
      { ok: false, error: 'missing SUPABASE_URL / SUPABASE_ANON_KEY' },
      { status: 500 },
    )
  }

  const startedAt = Date.now()
  try {
    const response = await fetch(`${url}/rest/v1/${TABLE}?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const body = {
      ok: response.ok,
      status: response.status,
      ms: Date.now() - startedAt,
      protected: Boolean(cronSecret),
      at: new Date().toISOString(),
    }

    // A non-2xx means the project may already be paused. Answer 500 so the run
    // is recorded as a failure and shows up in Vercel's logs and alerting.
    if (!response.ok) body.error = await response.text().catch(() => 'unreadable body')
    return Response.json(body, { status: response.ok ? 200 : 500 })
  } catch (error) {
    return Response.json(
      { ok: false, error: String(error), ms: Date.now() - startedAt },
      { status: 500 },
    )
  }
}
