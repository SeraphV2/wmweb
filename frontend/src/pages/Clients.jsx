import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { toCSV, downloadCSV } from '../lib/csv'
import { CLIENT_COLUMNS as CSV_COLUMNS } from '../lib/csvColumns'

const EMPTY_FORM = { first_name: '', last_name: '', email: '', phone: '', address: '', city: '', state: '', zip: '', country: '', notes: '' }

const TYPE_ICONS = { Photography: '📷', Videography: '🎥', Both: '📽️', Other: '✨' }
const TYPE_COLORS = {
  Photography: { bg: '#dbeafe', color: '#1e40af' },
  Videography: { bg: '#fce7f3', color: '#9d174d' },
  Both:        { bg: '#ede9fe', color: '#5b21b6' },
  Other:       { bg: '#f3f4f6', color: '#6b7280' },
}

export default function Clients() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null) // null | 'new' | 'edit'
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [projectTypes, setProjectTypes] = useState(null)
  const [loadingTypes, setLoadingTypes] = useState(false)

  const load = useCallback(() => {
    api.getClients(search).then(setRows).catch(e => toast(e.message, 'error'))
  }, [search])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  // Load project type breakdown when a client is selected
  useEffect(() => {
    if (!selected) { setProjectTypes(null); return }
    setLoadingTypes(true)
    api.getClientProjects(selected.id).then(res => {
      setProjectTypes(res.types || [])
    }).catch(() => setProjectTypes([]))
    .finally(() => setLoadingTypes(false))
  }, [selected])

  function openNew() { setForm(EMPTY_FORM); setModal('new') }
  function exportCsv() { downloadCSV(`clients-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, CSV_COLUMNS)) }
  function openEdit() {
    if (!selected) return
    setForm({
      first_name: selected.first_name || '', last_name: selected.last_name || '',
      email: selected.email || '', phone: selected.phone || '', address: selected.address || '',
      city: selected.city || '', state: selected.state || '',
      zip: selected.zip || '', country: selected.country || '', notes: selected.notes || '',
    })
    setModal('edit')
  }

  async function save() {
    if (!form.first_name.trim()) { toast('First name is required', 'error'); return }
    setSaving(true)
    try {
      if (modal === 'edit') {
        await api.updateClient(selected.id, form)
        toast('Client updated')
      } else {
        await api.createClient(form)
        toast('Client added')
      }
      setModal(null)
      setSelected(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    if (!selected) return
    if (!confirm(`Delete "${selected.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.deleteClient(selected.id)
      toast('Client deleted')
      setSelected(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  function F(key) {
    return (
      <input className="input" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Clients</h1>
        <div className="search-bar">
          <input className="search-input" placeholder="🔍 Search clients…" value={search}
            onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>⬇️ Export</button>
          <button className="btn btn-primary" onClick={openNew}>＋ New Client</button>
        </div>
      </div>

      <div className="page-body">
        {/* Action bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={openEdit} disabled={!selected}>✏️ Edit</button>
          <button className="btn btn-danger btn-sm" onClick={del} disabled={!selected || deleting}>🗑 Delete</button>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>{rows.length} client(s)</span>
        </div>

        {/* Project type cards for selected client */}
        {selected && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {loadingTypes ? (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Loading project types…</span>
            ) : projectTypes && projectTypes.length > 0 ? (
              projectTypes.map(t => {
                const icon = TYPE_ICONS[t.type] || '📁'
                const colors = TYPE_COLORS[t.type] || TYPE_COLORS.Other
                return (
                  <div key={t.type} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 10,
                    background: colors.bg, color: colors.color,
                    fontSize: 13, fontWeight: 600,
                  }}>
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    {t.type}
                    <span style={{
                      marginLeft: 4, background: 'rgba(0,0,0,.08)', borderRadius: '50%',
                      width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>{t.cnt}</span>
                  </div>
                )
              })
            ) : projectTypes && projectTypes.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>No projects yet for this client</span>
            ) : null}
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div className="empty">
              <span className="icon">👥</span>
              {search ? 'No clients match your search' : 'No clients yet — click + New Client to get started'}
            </div>
          ) : (
            <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Projects</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={selected?.id === r.id ? 'selected' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelected(selected?.id === r.id ? null : r)}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ color: 'var(--muted)' }}>{r.email}</td>
                    <td>{r.phone}</td>
                    <td>{r.city}</td>
                    <td style={{ textAlign: 'center' }}>{r.project_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === 'edit' ? 'Edit Client' : 'New Client'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Client'}
            </button>
          </>}
        >
          <div className="grid-2">
            <div className="field"><label>First Name *</label>{F('first_name')}</div>
            <div className="field"><label>Last Name</label>{F('last_name')}</div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Email</label>{F('email')}</div>
            <div className="field"><label>Phone</label>{F('phone')}</div>
          </div>
          <div className="field"><label>Address</label>{F('address')}</div>
          <div className="grid-3">
            <div className="field"><label>City</label>{F('city')}</div>
            <div className="field"><label>State</label>{F('state')}</div>
            <div className="field"><label>ZIP</label>{F('zip')}</div>
          </div>
          <div className="field"><label>Country</label>{F('country')}</div>
          <div className="field">
            <label>Notes</label>
            <textarea className="input" rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  )
}
