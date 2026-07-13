import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { toCSV, downloadCSV } from '../lib/csv'
import { BOOKING_COLUMNS as CSV_COLUMNS } from '../lib/csvColumns'

const STATUSES = ['Inquiry', 'Confirmed', 'In Progress', 'Completed', 'Cancelled']
const TYPES = ['Photography', 'Videography', 'Both', 'Other']
const BADGE = { Confirmed: 'badge-green', Inquiry: 'badge-amber', 'In Progress': 'badge-blue', Completed: 'badge-gray', Cancelled: 'badge-gray' }
const CHIP_COLORS = {
  Confirmed:     { bg: '#dcfce7', color: '#15803d' },
  Inquiry:       { bg: '#fef3c7', color: '#92400e' },
  'In Progress': { bg: '#dbeafe', color: '#1e40af' },
  Completed:     { bg: '#f3f4f6', color: '#6b7280' },
  Cancelled:     { bg: '#f3f4f6', color: '#6b7280' },
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const EMPTY = { client_id: '', title: '', type: 'Photography', status: 'Inquiry', date: '', start_time: '', end_time: '', location: '', package: '', rate: '', deposit: '', notes: '' }

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthGrid(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = startWeekday - 1; i >= 0; i--) cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true })
  while (cells.length % 7 !== 0) {
    const next = new Date(cells[cells.length - 1].date)
    next.setDate(next.getDate() + 1)
    cells.push({ date: next, inMonth: false })
  }
  return cells
}

export default function Bookings() {
  const [rows, setRows] = useState([])
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'calendar'
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d })

  const load = useCallback(() => {
    api.getProjects(search, statusFilter).then(setRows).catch(e => toast(e.message, 'error'))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)
  useEffect(() => { api.getClients().then(setClients).catch(() => {}) }, [])

  const byDate = useMemo(() => {
    const map = {}
    for (const r of rows) {
      if (!r.date) continue
      if (!map[r.date]) map[r.date] = []
      map[r.date].push(r)
    }
    return map
  }, [rows])

  function openNew(dateStr) { setForm(dateStr ? { ...EMPTY, date: dateStr } : EMPTY); setModal('new') }
  function exportCsv() { downloadCSV(`bookings-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, CSV_COLUMNS)) }
  function openEdit(booking) {
    const b = booking || selected
    if (!b) return
    setSelected(b)
    setForm({
      client_id: b.client_id || '', title: b.title || '',
      type: b.type || 'Photography', status: b.status || 'Inquiry',
      date: b.date || '', start_time: b.start_time || '',
      end_time: b.end_time || '', location: b.location || '',
      package: b.package || '', rate: b.rate || '',
      deposit: b.deposit || '', notes: b.notes || '',
    })
    setModal('edit')
  }

  function prevMonth() { setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function nextMonth() { setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }
  function goToday() { const d = new Date(); d.setDate(1); setMonthDate(d) }

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
          <div className="view-toggle">
            <button className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('list')}>📋 List</button>
            <button className={`btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('calendar')}>📅 Calendar</button>
          </div>
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>⬇️ Export</button>
          <button className="btn btn-primary" onClick={() => openNew()}>＋ New Booking</button>
        </div>
      </div>

      <div className="page-body">
        {view === 'calendar' ? (
          <div className="card" style={{ padding: 16 }}>
            <div className="calendar-nav">
              <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 15, minWidth: 150, textAlign: 'center' }}>
                {monthDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={nextMonth}>›</button>
              <button className="btn btn-ghost btn-sm" onClick={goToday} style={{ marginLeft: 8 }}>Today</button>
            </div>
            <div className="calendar-grid calendar-dow-row">
              {DOW.map(d => <div key={d} className="calendar-dow-cell">{d}</div>)}
            </div>
            <div className="calendar-grid">
              {monthGrid(monthDate).map(({ date, inMonth }) => {
                const key = ymd(date)
                const items = byDate[key] || []
                const isToday = key === ymd(new Date())
                return (
                  <div
                    key={key}
                    className={`calendar-cell${inMonth ? '' : ' outside'}${isToday ? ' today' : ''}`}
                    onClick={() => openNew(key)}
                  >
                    <div className="calendar-daynum">{date.getDate()}</div>
                    {items.slice(0, 3).map(b => {
                      const c = CHIP_COLORS[b.status] || CHIP_COLORS.Inquiry
                      return (
                        <div
                          key={b.id}
                          className="calendar-chip"
                          style={{ background: c.bg, color: c.color }}
                          onClick={e => { e.stopPropagation(); openEdit(b) }}
                        >
                          {b.start_time ? `${b.start_time} ` : ''}{b.title}
                        </div>
                      )
                    })}
                    {items.length > 3 && <div className="calendar-more">+{items.length - 3} more</div>}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
        <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => openEdit()} disabled={!selected}>✏️ Edit</button>
          <button className="btn btn-danger btn-sm" onClick={del} disabled={!selected}>🗑 Delete</button>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>{rows.length} booking(s)</span>
        </div>
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
        </>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Booking' : 'New Booking'} onClose={() => setModal(null)} size="lg"
          footer={<>
            {modal === 'edit' && (
              <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => { setModal(null); del() }}>🗑 Delete</button>
            )}
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
