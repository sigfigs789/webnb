// Password gate for the whole site.
//
// The password itself never reaches the browser: the client POSTs a candidate
// here and the server compares it against SITE_PASSWORD (configured in the
// Vercel project env). On a match we hand back an HttpOnly cookie holding a
// signed, expiring token, and the client asks GET /api/auth on every load to
// find out whether it should render the app or the lock screen.
//
// Runs server-side, so it reads process.env rather than the VITE_-prefixed
// values that get inlined into the browser bundle.

import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE = 'webnb_session'
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export async function GET(request) {
  const password = process.env.SITE_PASSWORD
  if (!password) return notConfigured()

  return Response.json({ authenticated: isValidToken(readCookie(request, COOKIE), password) })
}

export async function POST(request) {
  const password = process.env.SITE_PASSWORD
  if (!password) return notConfigured()

  const body = await request.json().catch(() => null)
  const candidate = typeof body?.password === 'string' ? body.password : ''

  if (!matches(candidate, password)) {
    return Response.json({ authenticated: false, error: 'Incorrect password' }, { status: 401 })
  }

  return Response.json(
    { authenticated: true },
    { headers: { 'set-cookie': sessionCookie(issueToken(password), MAX_AGE_SECONDS) } },
  )
}

export async function DELETE() {
  return Response.json(
    { authenticated: false },
    { headers: { 'set-cookie': sessionCookie('', 0) } },
  )
}

function notConfigured() {
  return Response.json(
    { authenticated: false, error: 'SITE_PASSWORD is not set' },
    { status: 500 },
  )
}

// ── Token ──────────────────────────────────────────────
//
// `<expiry>.<signature>` — the signature covers the expiry so the deadline
// cannot be edited by hand, and signing with a key derived from the password
// means changing SITE_PASSWORD invalidates every session already handed out.

function secretFor(password) {
  return createHmac('sha256', process.env.SESSION_SECRET ?? 'webnb').update(password).digest()
}

function sign(payload, password) {
  return createHmac('sha256', secretFor(password)).update(payload).digest('hex')
}

function issueToken(password) {
  const expiresAt = String(Date.now() + MAX_AGE_SECONDS * 1000)
  return `${expiresAt}.${sign(expiresAt, password)}`
}

function isValidToken(token, password) {
  if (!token) return false
  const [expiresAt, signature] = token.split('.')
  if (!expiresAt || !signature) return false
  if (!matches(signature, sign(expiresAt, password))) return false
  return Number(expiresAt) > Date.now()
}

function matches(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so compare same-size digests of the two values instead.
  return timingSafeEqual(
    createHmac('sha256', 'compare').update(left).digest(),
    createHmac('sha256', 'compare').update(right).digest(),
  )
}

// ── Cookie ─────────────────────────────────────────────

function sessionCookie(value, maxAge) {
  const parts = [
    `${COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  // Vercel always serves over HTTPS; plain-HTTP localhost would reject Secure.
  if (process.env.VERCEL) parts.push('Secure')
  return parts.join('; ')
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}
