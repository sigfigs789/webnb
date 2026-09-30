import { useState, FormEvent } from 'react'

type Props = {
  onSubmit: (password: string) => Promise<string | null>
}

export function PasswordGate({ onSubmit }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    const message = await onSubmit(password)
    setSubmitting(false)

    if (message) {
      setError(message)
      setPassword('')
    }
  }

  return (
    <div className="gate">
      <form className="gate-card card" onSubmit={handleSubmit}>
        <h1 className="gate-title">Rental Cashflow Tracker</h1>
        <p className="gate-hint">Enter the password to continue.</p>

        <div className="form-field">
          <label htmlFor="site-password">Password</label>
          <input
            id="site-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={event => {
              setPassword(event.target.value)
              setError(null)
            }}
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" disabled={submitting || !password}>
          {submitting ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
