import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import Combobox from '../components/Combobox'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const STATUSES = ['Inquiry', 'Confirmed', 'In Progress', 'Completed', 'Cancelled']
const TYPES = ['Photography', 'Videography', 'Both', 'Other']
const BADGE = {
  Confirmed: 'badge-green', Inquiry: 'badge-amber',
  'In Progress': 'badge-blue', Completed: 'badge-gray', Cancelled: 'badge-gray',
}
const CLIENT_COLORS = [
  '#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

const EMPTY = {
  client_id: '', title: '', type: 'Photography', status: 'Inquiry',
  date: '', start_time: '', end_time: '', location: '',
  package: '', rate: '', deposit: '', notes: '',
}

export default function Projects() {
  const [rows, setRows] = useState([])
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.getProjects(search, statusFilter).then(setRows).catch(e => toast(e.message, 'error'))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)
  useEffect(() => { api.getClients().then(setClients).catch(() => {}) }, [])

  // Group projects by client name
  const clientGroups = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const name = r.client_name || 'Unknown Client'
      if (!map[name]) map[name] = []
      map[name].push(r)
    }
    // Sort clients by most projects first, then alphabetically
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [rows])

  // Derive per-client colors from CLIENT_COLORS
  const groupColors = useMemo(() => {
    const c = {}
    clientGroups.forEach(([name], i) => { c[name] = CLIENT_COLORS[i % CLIENT_COLORS.length] })
    return c
  }, [clientGroups])

  function openNew() { setForm(EMPTY); setModal('new') }
  function openEdit(project) {
    const p = project || selected
    if (!p) return
    setSelected(p)
    setForm({
      client_id: p.client_id || '', title: p.title || '',
      type: p.type || 'Photography', status: p.status || 'Inquiry',
      date: p.date || '', start_time: p.start_time || '',
      end_time: p.end_time || '', location: p.location || '',
      package: p.package || '', rate: p.rate || '',
      deposit: p.deposit || '', notes: p.notes || '',
    })
    setModal('edit')
  }

  async function save() {
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    setSaving(true)
    try {
      const data = {
        ...form,
        client_id: form.client_id ? Number(form.client_id) : null,
        rate: Number(form.rate) || 0, deposit: Number(form.deposit) || 0,
      }
      if (modal === 'edit') { await api.updateProject(selected.id, data); toast('Project updated') }
      else { await api.createProject(data); toast('Project created') }
      setModal(null); setSelected(null); load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function del() {
    if (!selected || !confirm(`Delete "${selected.title}"?`)) return
    try { await api.deleteProject(selected.id); toast('Project deleted'); setSelected(null); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const totalRevenue = rows.reduce((s, r) => s + Number(r.rate || 0), 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Projects</h1>
        <div className="search-bar">
          <input className="search-input" placeholder="🔍 Search projects…" value={search}
            onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: 150 }} value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openNew}>＋ New Project</button>
        </div>
      </div>

      <div className="page-body">
        {/* Action bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => openEdit()} disabled={!selected}>✏️ Edit</button>
          <button className="btn btn-danger btn-sm" onClick={del} disabled={!selected}>🗑 Delete</button>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>
            {rows.length} project(s) · £{totalRevenue.toFixed(2)} total value
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="card empty"><span className="icon">📁</span>No projects found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {clientGroups.map(([clientName, items]) => {
              const color = groupColors[clientName]
              const clientTotal = items.reduce((s, r) => s + Number(r.rate || 0), 0)
              return (
                <div key={clientName} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{
                    padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
                    borderLeft: `4px solid ${color}`,
                    background: 'var(--input)', borderBottom: '1px solid var(--border-soft)',
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{clientName}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{items.length} project{items.length === 1 ? '' : 's'}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>£{clientTotal.toFixed(2)}</span>
                  </div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Title</th><th>Type</th><th>Date</th><th>Location</th><th>Rate</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(r => (
                          <tr key={r.id}
                            className={selected?.id === r.id ? 'selected' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelected(selected?.id === r.id ? null : r)}>
                            <td style={{ fontWeight: 600 }}>{r.title}</td>
                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.type}</td>
                            <td style={{ fontSize: 12 }}>{r.date || '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.location || '—'}</td>
                            <td style={{ fontWeight: 600 }}>£{Number(r.rate || 0).toFixed(2)}</td>
                            <td><span className={`badge ${BADGE[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Project' : 'New Project'} onClose={() => setModal(null)} size="lg"
          footer={<>
            {modal === 'edit' && (
              <button className="btn btn-danger" style={{ marginRight: 'auto' }}
                onClick={() => { setModal(null); del() }}>🗑 Delete</button>
            )}
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>}>
          <div className="field">
            <label>Client</label>
            <select className="input" value={form.client_id}
              onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">— No client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Title *</label>
            <input className="input" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Type</label>
              <select className="input" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select className="input" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-3">
            <div className="field">
              <label>Date</label>
              <input className="input" type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Start Time</label>
              <input className="input" type="time" value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div className="field">
              <label>End Time</label>
              <input className="input" type="time" value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Location</label>
            <input className="input" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="field">
            <label>Package</label>
            <input className="input" value={form.package}
              onChange={e => setForm(f => ({ ...f, package: e.target.value }))} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Rate (£)</label>
              <input className="input" type="number" step="0.01" value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
            </div>
            <div className="field">
              <label>Deposit (£)</label>
              <input className="input" type="number" step="0.01" value={form.deposit}
                onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))} />
            </div>
          </div>
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
