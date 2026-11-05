import React, { useEffect, useState } from 'react'

export default function Account({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [values, setValues] = useState({ name: '', email: '', password: '', teamName: '', invitation: '' })
  useEffect(() => {
    const invitation = new URLSearchParams(window.location.search).get('invite')
    if (invitation) {
      setValues(current => ({ ...current, invitation }))
      setMode('join')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])
  const field = key => ({ value: values[key], onChange: event => setValues({ ...values, [key]: event.target.value }) })
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/auth/' + mode, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to sign in.')
      onLogin(data.user)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <main className="shell workspace"><section className="schedule" style={{ maxWidth: 520, margin: '40px auto' }}>
    <div className="eyebrow section-index">ServiceArea Planner</div>
    <h2>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your team' : 'Join your team'}</h2>
    <p>Plan visits together, one area at a time.</p>
    <form onSubmit={submit} className="account-form">
      {mode !== 'login' && <label>Your name<input {...field('name')} required maxLength={120}/></label>}
      {mode === 'register' && <label>Team name<input {...field('teamName')} required maxLength={120}/></label>}
      {mode === 'join' && <label>Invitation code<input {...field('invitation')} required /></label>}
      <label>Email<input {...field('email')} type="email" required maxLength={254}/></label>
      <label>Password<input {...field('password')} type="password" required minLength={12} maxLength={256} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
    </form>
    <div className="account-switch"><button className="secondary" onClick={() => { setMode('login'); setError('') }}>Log in</button><button className="secondary" onClick={() => { setMode('register'); setError('') }}>Create team</button><button className="secondary" onClick={() => { setMode('join'); setError('') }}>Join team</button></div>
  </section></main>
}
