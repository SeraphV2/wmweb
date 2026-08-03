import { useState, useEffect } from 'react'
import { api } from '../api'
import { toast } from '../components/Toast'
import { getStoredTheme, applyTheme } from '../lib/theme'

const FIELDS = [
  { key: 'company_name',   label: 'Company Name',     section: 'Company' },
  { key: 'owner_name',     label: 'Owner Name',        section: 'Company' },
  { key: 'email',          label: 'Email',             section: 'Company' },
  { key: 'phone',          label: 'Phone',             section: 'Company' },
  { key: 'address',        label: 'Address',           section: 'Company' },
  { key: 'city',           label: 'City',              section: 'Company' },
  { key: 'state',          label: 'State',             section: 'Company' },
  { key: 'zip',            label: 'ZIP Code',          section: 'Company' },
  { key: 'website',        label: 'Website',           section: 'Company' },
  { key: 'currency_symbol',label: 'Currency Symbol',   section: 'Invoicing' },
  { key: 'invoice_prefix', label: 'Invoice Prefix',    section: 'Invoicing' },
  { key: 'payment_terms',  label: 'Payment Terms (days)', section: 'Invoicing' },
  { key: 'tax_rate',       label: 'Default Tax Rate (%)',  section: 'Invoicing' },
  { key: 'thank_you_note', label: 'Thank You Note',    section: 'Invoicing', textarea: true },
]

const MIN_PASSWORD_LENGTH = 8
const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' }

export default function Settings() {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState(getStoredTheme())
  const [pw, setPw] = useState(EMPTY_PASSWORDS)
  const [changingPw, setChangingPw] = useState(false)
  const [totpOn, setTotpOn] = useState(false)
  const [totpSetup, setTotpSetup] = useState(null)   // { secret, qr_svg } while enrolling
  const [totpCode, setTotpCode] = useState('')
  const [totpBusy, setTotpBusy] = useState(false)

  useEffect(() => {
    api.getSettings().then(setForm).catch(e => toast(e.message, 'error'))
    api.getTotpStatus().then(r => setTotpOn(r.enabled)).catch(() => {})
  }, [])

  async function startTotp() {
    setTotpBusy(true)
    try { setTotpSetup(await api.setupTotp()) }
    catch (e) { toast(e.message, 'error') }
    finally { setTotpBusy(false) }
  }

  async function confirmTotp(e) {
    e.preventDefault()
    setTotpBusy(true)
    try {
      await api.enableTotp(totpCode)
      toast('Two-factor enabled')
      setTotpOn(true); setTotpSetup(null); setTotpCode('')
    } catch (err) { toast(err.message, 'error') }
    finally { setTotpBusy(false) }
  }

  async function turnOffTotp() {
    const password = prompt('Enter your password to turn off two-factor:')
    if (!password) return
    setTotpBusy(true)
    try {
      await api.disableTotp(password)
      toast('Two-factor disabled')
      setTotpOn(false)
    } catch (e) { toast(e.message, 'error') }
    finally { setTotpBusy(false) }
  }

  async function chooseTheme(t) {
    setTheme(t)
    applyTheme(t)
    try { await api.updateMyTheme(t) } catch (e) { toast(e.message, 'error') }
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pw.next !== pw.confirm) { toast('New passwords do not match', 'error'); return }
    if (pw.next.length < MIN_PASSWORD_LENGTH) {
      toast(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`, 'error'); return
    }
    setChangingPw(true)
    try {
      await api.changeMyPassword(pw.current, pw.next)
      toast('Password changed')
      setPw(EMPTY_PASSWORDS)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setChangingPw(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateSettings(form)
      toast('Settings saved')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const sections = [...new Set(FIELDS.map(f => f.section))]

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      <div className="page-body">
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>Appearance</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => chooseTheme('light')}>☀️ Light</button>
              <button type="button" className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => chooseTheme('dark')}>🌙 Dark</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>Saved to your account, so it follows you to any device you log in on.</p>
          </div>

          <form onSubmit={changePassword} className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>Password</h3>
            <div className="field">
              <label>Current Password</label>
              <input className="input" type="password" autoComplete="current-password"
                value={pw.current} onChange={e => setPw(s => ({ ...s, current: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>New Password</label>
                <input className="input" type="password" autoComplete="new-password"
                  value={pw.next} onChange={e => setPw(s => ({ ...s, next: e.target.value }))} />
              </div>
              <div className="field">
                <label>Confirm New Password</label>
                <input className="input" type="password" autoComplete="new-password"
                  value={pw.confirm} onChange={e => setPw(s => ({ ...s, confirm: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 'auto' }}>
                At least {MIN_PASSWORD_LENGTH} characters. You'll stay logged in on this device.
              </span>
              <button className="btn btn-primary" type="submit" disabled={changingPw}>
                {changingPw ? 'Changing…' : 'Change Password'}
              </button>
            </div>
          </form>

          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>Two-Factor Authentication</h3>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 14 }}>
              Link an authenticator app so you can reset your own password from the login
              screen if you forget it, without waiting for an admin.
            </p>

            {totpOn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green, #166534)' }}>✓ Enabled</span>
                <button className="btn btn-ghost btn-sm" disabled={totpBusy} onClick={turnOffTotp}
                  style={{ marginLeft: 'auto' }}>Turn off</button>
              </div>
            ) : totpSetup ? (
              <form onSubmit={confirmTotp}>
                <p style={{ fontSize: 12, marginBottom: 10 }}>
                  1. Scan this with Google Authenticator, 1Password, or similar.
                </p>
                <div style={{ width: 168, background: '#fff', padding: 8, borderRadius: 8, marginBottom: 12 }}
                  dangerouslySetInnerHTML={{ __html: totpSetup.qr_svg }} />
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                  Can't scan? Enter this key manually:<br />
                  <code style={{ fontSize: 11.5, letterSpacing: 1, wordBreak: 'break-all' }}>{totpSetup.secret}</code>
                </p>
                <div className="field">
                  <label>2. Enter the 6-digit code it shows</label>
                  <input className="input" inputMode="numeric" maxLength={6} placeholder="000000"
                    value={totpCode} onChange={e => setTotpCode(e.target.value)} style={{ maxWidth: 160 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" type="submit" disabled={totpBusy}>
                    {totpBusy ? 'Verifying…' : 'Verify & Enable'}
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => { setTotpSetup(null); setTotpCode('') }}>Cancel</button>
                </div>
              </form>
            ) : (
              <button className="btn btn-ghost" disabled={totpBusy} onClick={startTotp}>
                {totpBusy ? 'Loading…' : 'Set up authenticator app'}
              </button>
            )}
          </div>

          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sections.map(section => (
            <div key={section} className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>{section}</h3>
              <div className="grid-2">
                {FIELDS.filter(f => f.section === section).map(f => (
                  <div key={f.key} className="field" style={f.textarea ? { gridColumn: '1 / -1' } : {}}>
                    <label>{f.label}</label>
                    {f.textarea ? (
                      <textarea className="input" rows={3} value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} />
                    ) : (
                      <input className="input" value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ padding: '10px 24px' }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
