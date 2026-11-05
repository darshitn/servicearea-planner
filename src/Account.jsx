import React, { useEffect, useState } from 'react'
import { Icon, RouteMap } from './icons'
import './account.css'

const modes = {
  login: { tab: 'Sign in', title: 'Welcome back', description: 'Sign in to see your team’s visit schedule.', submit: 'Sign in' },
  register: { tab: 'Create team', title: 'Create your team', description: 'Set up a workspace and invite your technicians.', submit: 'Create team' },
  join: { tab: 'Join team', title: 'Join your team', description: 'Use the invitation from your coordinator to get started.', submit: 'Join team' },
}

export default function Account({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [values, setValues] = useState({ name: '', email: '', password: '', teamName: '', invitation: '' })
  const copy = modes[mode]

  useEffect(() => {
    const url = new URL(window.location.href)
    const invitation = url.searchParams.get('invite')
    if (invitation) {
      setValues(current => ({ ...current, invitation }))
      setMode('join')
      url.searchParams.delete('invite')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  }, [])

  function field(key) {
    return {
      name: key,
      value: values[key],
      onChange: event => {
        const value = event.target.value
        setValues(current => ({ ...current, [key]: value }))
        setError('')
      },
    }
  }

  function selectMode(next) {
    setMode(next)
    setError('')
    setShowPassword(false)
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/auth/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.user) {
        setError(data.error || 'The service is unavailable. Please try again.')
        return
      }
      onLogin(data.user)
    } catch {
      setError('Could not reach the service. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="account-page">
      <section className="account-intro" aria-labelledby="account-product">
        <RouteMap />
        <div className="account-brand">
          <span className="account-brand-icon"><Icon name="route" size={24} /></span>
          <span id="account-product">ServiceArea <strong>Planner</strong></span>
        </div>
        <div className="account-intro-copy">
          <span className="account-kicker">Field service workspace</span>
          <p className="account-headline">One plan for <br />every visit.</p>
          <p className="account-intro-description">Group visits by area, assign your team and track progress through the day.</p>
        </div>
        <ul className="account-benefits">
          <li><Icon name="pin" /> Plan by area</li>
          <li><Icon name="people" /> Assign visits</li>
          <li><Icon name="check" /> Track completion</li>
        </ul>
      </section>

      <section className="account-card" aria-labelledby="account-title">
        <div className="account-modes" role="group" aria-label="Account action">
          {Object.entries(modes).map(([key, item]) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === mode}
              disabled={busy}
              onClick={() => selectMode(key)}
            >
              {item.tab}
            </button>
          ))}
        </div>
        <h1 id="account-title">{copy.title}</h1>
        <p className="account-description">{copy.description}</p>
        <form onSubmit={submit} className="account-form" aria-busy={busy}>
          {mode !== 'login' && <label>Your name<input {...field('name')} required maxLength={120} autoComplete="name" /></label>}
          {mode === 'register' && <label>Team name<input {...field('teamName')} required maxLength={120} autoComplete="organization" /></label>}
          {mode === 'join' && (
            <label>
              Invitation link or code
              <input {...field('invitation')} required autoComplete="off" spellCheck={false} placeholder="Paste the invitation from your coordinator" />
            </label>
          )}
          <label>Email address<input {...field('email')} type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
          <div className="account-password">
            <label htmlFor="account-password">Password</label>
            <div className="account-password-input">
              <input
                {...field('password')}
                id="account-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={12}
                maxLength={256}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                aria-describedby={mode === 'login' ? undefined : 'account-password-hint'}
              />
              <button type="button" onClick={() => setShowPassword(current => !current)} aria-controls="account-password">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {mode !== 'login' && <small id="account-password-hint">Use at least 12 characters.</small>}
          </div>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary account-submit" disabled={busy}>
            {busy ? 'Please wait…' : copy.submit}
            {!busy && <Icon name="right" size={16} />}
          </button>
        </form>
      </section>
    </main>
  )
}
