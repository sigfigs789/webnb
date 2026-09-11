import { useState, useEffect } from 'react'

type Status = 'checking' | 'locked' | 'unlocked'

const ENDPOINT = '/api/auth'

export function useAuth() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    let active = true
    read().then(authenticated => {
      if (active) setStatus(authenticated ? 'unlocked' : 'locked')
    })
    return () => {
      active = false
    }
  }, [])

  // Resolves to an error message, or null once the session cookie is set.
  async function login(password: string): Promise<string | null> {
    let response: Response
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
    } catch {
      return 'Could not reach the server. Try again.'
    }

    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.authenticated) {
      return body?.error ?? 'Incorrect password'
    }

    setStatus('unlocked')
    return null
  }

  async function logout() {
    await fetch(ENDPOINT, { method: 'DELETE' }).catch(() => {})
    setStatus('locked')
  }

  return { status, login, logout }
}

async function read(): Promise<boolean> {
  try {
    const response = await fetch(ENDPOINT)
    const body = await response.json()
    return body?.authenticated === true
  } catch {
    // A missing or non-JSON response means we cannot prove the visitor is
    // allowed in, so stay locked.
    return false
  }
}
