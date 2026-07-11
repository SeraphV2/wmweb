import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'

const STATUSES = ['Inquiry', 'Confirmed', 'In Progress', 'Completed', 'Cancelled']
const TYPES = ['Photography', 'Videography', 'Both', 'Other']
const BADGE = { Confirmed: 'badge-green', Inquiry: 'badge-amber', 'In Progress': 'badge-blue', Completed: 'badge-gray', Cancelled: 'badge-gray' }

const EMPTY = { client_id: '', title: '', type: 'Photography', status: 'Inquiry', date: '', start_time: '', end_time: '', location: '', package: '', rate: '', deposit: '', notes: '' }

export default function Bookings() {
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
  useEffect(() => { api.getClients().then(setClients).catch(() => {}) }, [])

  function openNew() { setForm(EMPTY); setModal('new') }
  function openEdit() {
    if (!selected) return
    setForm({
      client_id: selected.client_id || '', title: selected.title || '',
      type: selected.type || 'Photography', status: selected.status || 'Inquiry',
      date: selected.date || '', start_time: selected.start_time || '',
      end_time: selected.end_time || '', location: selected.location || '',
      package: selected.package || '', rate: selected.rate || '',
      deposit: selected.deposit || '', notes: selected.notes || '',
    })
    setModal('edit')
  }

  async function save() {
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    setSaving(true)
    try {
      const data = { ...form, client_id: form.client_id ? Number(form.client_id) : null, rate: Number(form.rate) || 0, deposit: Number(form.deposit) || 0 }
      if (modal === 'edit') { await api.updateProject(selected.id, data); toast('Booking updated') }
      else { await api.createProject(data); toast('Booking added') }
      setModal(null); setSelected(null); load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function del() {
    if (!selected || !confirm(`Delete "${selected.title}"?`)) return
    try { await api.deleteProject(selected.id); toast('Booking deleted'); setSelected(null); load() }
    catch (e) { toast(e.message, 'error') }
  }

  function F(key, type = 'text', opts = {}) {
    if (opts.select) {
      return (
        <select className="input" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
          {opts.select.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return <input className="input" type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Bookings</h1>
        <div className="search-bar">
          <input className="search-input" placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openNew}>＋ New Booking</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div className="empty"><span className="icon">📅</span>No bookings found</div>
          ) : (
            <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Title</th><th>Client</th><th>Type</th><th>Date</th><th>Rate</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={selected?.id === r.id ? 'selected' : ''} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === r.id ? null : r)}>
                    <td style={{ fontWeight: 600 }}>{r.title}</td>
                    <td style={{ color: 'var(--muted)' }}>{r.client_name || '—'}</td>
                    <td>{r.type}</td>
                    <td>{r.date || '—'}</td>
                    <td>£{Number(r.rate || 0).toFixed(2)}</td>
                    <td><span className={`badge ${BADGE[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={openEdit} disabled={!selected}>✏️ Edit</button>
          <button className="btn btn-danger btn-sm" onClick={del} disabled={!selected}>🗑 Delete</button>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>{rows.length} booking(s)</span>
        </div>
      </div>

      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Booking' : 'New Booking'} onClose={() => setModal(null)} size="lg"
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>}>
          <div className="field">
            <label>Client</label>
            <select className="input" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">— No client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Title *</label>{F('title')}</div>
          <div className="grid-2">
            <div className="field"><label>Type</label>{F('type', 'text', { select: TYPES })}</div>
            <div className="field"><label>Status</label>{F('status', 'text', { select: STATUSES })}</div>
          </div>
          <div className="grid-3">
            <div className="field"><label>Date</label>{F('date', 'date')}</div>
            <div className="field"><label>Start Time</label>{F('start_time', 'time')}</div>
            <div className="field"><label>End Time</label>{F('end_time', 'time')}</div>
          </div>
          <div className="field"><label>Location</label>{F('location')}</div>
          <div className="field"><label>Package</label>{F('package')}</div>
          <div className="grid-2">
            <div className="field"><label>Rate (£)</label>{F('rate', 'number')}</div>
            <div className="field"><label>Deposit (£)</label>{F('deposit', 'number')}</div>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  )
}
