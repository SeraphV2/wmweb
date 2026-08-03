import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const EMPTY_RESET = { username: '', code: '', password: '', confirm: '' }

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [reset, setReset] = useState(EMPTY_RESET)
  const [resetBusy, setResetBusy] = useState(false)
  const navigate = useNavigate()

  async function submitReset(e) {
    e.preventDefault()
    setError('')
    if (reset.password !== reset.confirm) { setError('New passwords do not match.'); return }
    if (reset.password.length < 8) { setError('New password must be at least 8 characters.'); return }
    setResetBusy(true)
    try {
      await api.resetWithTotp(reset.username, reset.code, reset.password)
      setResetting(false)
      setUsername(reset.username)
      setReset(EMPTY_RESET)
      setError('')
      setPassword('')
      alert('Password reset. You can sign in with your new password now.')
    } catch (err) {
      setError(err.message || 'Reset failed.')
    } finally {
      setResetBusy(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.login(username, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.detail || 'Incorrect username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, background: 'var(--input)', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, margin: '0 auto 16px',
          }}>🎬</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Waffle Media</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Business Suite</p>
        </div>

        <div className="card">
          {resetting ? (
            <form onSubmit={submitReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700 }}>Reset your password</h2>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  Enter the current 6-digit code from your authenticator app.
                </p>
              </div>
              <div className="field">
                <label>Username</label>
                <input className="input" value={reset.username} autoFocus required
                  onChange={e => setReset(s => ({ ...s, username: e.target.value }))} />
              </div>
              <div className="field">
                <label>Authenticator Code</label>
                <input className="input" inputMode="numeric" maxLength={6} placeholder="000000" required
                  value={reset.code} onChange={e => setReset(s => ({ ...s, code: e.target.value }))} />
              </div>
              <div className="field">
                <label>New Password</label>
                <input className="input" type="password" autoComplete="new-password" required
                  value={reset.password} onChange={e => setReset(s => ({ ...s, password: e.target.value }))} />
              </div>
              <div className="field">
                <label>Confirm New Password</label>
                <input className="input" type="password" autoComplete="new-password" required
                  value={reset.confirm} onChange={e => setReset(s => ({ ...s, confirm: e.target.value }))} />
              </div>
              {error && <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p>}
              <button className="btn btn-primary" type="submit" disabled={resetBusy}
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                {resetBusy ? 'Resetting…' : 'Reset Password'}
              </button>
              <button type="button" onClick={() => { setResetting(false); setError('') }}
                style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 11.5, cursor: 'pointer' }}>
                Back to sign in
              </button>
            </form>
          ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label>Username</label>
              <input
                className="input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          )}
          {!resetting && (
            <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 14, textAlign: 'center' }}>
              <button type="button" onClick={() => { setResetting(true); setError('') }}
                style={{ background: 'none', border: 0, color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                Forgot your password?
              </button>
              {' '}Reset it with your authenticator app, or ask an admin.
            </p>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, marginTop: 16 }}>
          Waffle Media · Business Management
        </p>
      </div>
    </div>
  )
}
