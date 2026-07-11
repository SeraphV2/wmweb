import { useState, useEffect } from 'react'
import { api } from '../api'
import { toast } from '../components/Toast'

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

export default function Settings() {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getSettings().then(setForm).catch(e => toast(e.message, 'error'))
  }, [])

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
        <form onSubmit={save} style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
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
  )
}
