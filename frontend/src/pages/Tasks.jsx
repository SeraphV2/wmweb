import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { toCSV, downloadCSV } from '../lib/csv'

const CSV_COLUMNS = [
  { label: 'Title', value: 'title' },
  { label: 'Status', value: 'status' },
  { label: 'Priority', value: 'priority' },
  { label: 'Assignee', value: 'assignee' },
  { label: 'Due Date', value: 'due_date' },
  { label: 'Notes', value: 'notes' },
]

const STATUSES = ['Not Started', 'Working On It', 'Stuck', 'Done']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const PRIORITY_RANK = { Low: 0, Medium: 1, High: 2, Critical: 3 }

const STATUS_COLORS = {
  'Not Started':   { bg: '#f3f4f6', color: '#6b7280' },
  'Working On It': { bg: '#fef3c7', color: '#92400e' },
  'Stuck':         { bg: '#fee2e2', color: '#991b1b' },
  'Done':          { bg: '#dcfce7', color: '#15803d' },
}
const PRIORITY_COLORS = {
  Low:      { bg: '#dbeafe', color: '#1e40af' },
  Medium:   { bg: '#fef3c7', color: '#92400e' },
  High:     { bg: '#ffedd5', color: '#c2410c' },
  Critical: { bg: '#fee2e2', color: '#991b1b' },
}

const EMPTY_FORM = { title: '', status: 'Not Started', priority: 'Medium', assignee: '', due_date: '', notes: '' }

function Pill({ value, options, colors, onChange }) {
  const c = colors[value] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <select
      className="pill-select"
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      style={{ background: c.bg, color: c.color }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export default function Tasks() {
  const [rows, setRows] = useState([])
  const [people, setPeople] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'form'
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dragOverStatus, setDragOverStatus] = useState(null)
  // Counts in-flight mutations (pill edits, drags) so auto-refresh can't land
  // between an optimistic update and its save and clobber it with stale data.
  const pending = useRef(0)
  function beginMutation() { pending.current += 1 }
  function endMutation() { pending.current = Math.max(0, pending.current - 1) }

  const load = useCallback(() => {
    if (pending.current > 0) return
    api.getTasks(search).then(rs => { if (pending.current === 0) setRows(rs) }).catch(e => toast(e.message, 'error'))
  }, [search])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)
  useEffect(() => { api.assignableUsers().then(setPeople).catch(() => {}) }, [])

  const columns = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map(s => [s, []]))
    for (const t of rows) {
      const s = STATUSES.includes(t.status) ? t.status : 'Not Started'
      map[s].push(t)
    }
    for (const s of STATUSES) {
      map[s].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) || a.id - b.id)
    }
    return map
  }, [rows])

  function openNew() { setForm(EMPTY_FORM); setEditId(null); setModal('form') }
  function exportCsv() { downloadCSV(`tasks-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, CSV_COLUMNS)) }
  function openEdit(t) {
    setForm({
      title: t.title || '', status: t.status || 'Not Started', priority: t.priority || 'Medium',
      assignee: t.assignee || '', due_date: t.due_date || '', notes: t.notes || '',
    })
    setEditId(t.id)
    setModal('form')
  }

  async function save() {
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    setSaving(true)
    try {
      if (editId) { await api.updateTask(editId, form); toast('Task updated') }
      else { await api.createTask(form); toast('Task added') }
      setModal(null); load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function del(t) {
    if (!confirm(`Delete "${t.title}"?`)) return
    try { await api.deleteTask(t.id); toast('Task deleted'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  function setStatus(t, status) {
    setRows(rs => rs.map(r => r.id === t.id ? { ...r, status } : r))
    beginMutation()
    api.updateTaskStatus(t.id, status)
      .catch(e => toast(e.message, 'error'))
      .finally(() => { endMutation(); load() })
  }

  function setPriority(t, priority) {
    setRows(rs => rs.map(r => r.id === t.id ? { ...r, priority } : r))
    beginMutation()
    api.updateTaskPriority(t.id, priority)
      .catch(e => toast(e.message, 'error'))
      .finally(() => { endMutation(); load() })
  }

  function onCardDragStart(t) {
    beginMutation()
    setDragId(t.id)
  }
  function onCardDragEnd() {
    setDragId(null)
    setDragOverStatus(null)
    endMutation()
  }
  function onColumnDrop(e, status) {
    e.preventDefault()
    const t = rows.find(r => r.id === dragId)
    if (t && t.status !== status) setStatus(t, status)
    onCardDragEnd()
  }

  function F(key) {
    return <input className="input" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tasks</h1>
        <div className="search-bar">
          <input className="search-input" placeholder="🔍 Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>⬇️ Export</button>
          <button className="btn btn-primary" onClick={openNew}>＋ New Task</button>
        </div>
      </div>

      <div className="page-body">
        {rows.length === 0 ? (
          <div className="card empty">
            <span className="icon">✅</span>No tasks yet — click + New Task to get started
          </div>
        ) : (
          <div className="kanban">
            {STATUSES.map(status => {
              const c = STATUS_COLORS[status]
              const items = columns[status]
              return (
                <div
                  key={status}
                  className={`kanban-col${dragOverStatus === status ? ' drag-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOverStatus(status) }}
                  onDragLeave={() => setDragOverStatus(s => (s === status ? null : s))}
                  onDrop={e => onColumnDrop(e, status)}
                >
                  <div className="kanban-col-header" style={{ borderTop: `3px solid ${c.color}` }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{status}</span>
                    <span className="badge" style={{ background: c.bg, color: c.color }}>{items.length}</span>
                  </div>
                  <div className="kanban-col-body">
                    {items.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '16px 8px' }}>No tasks</div>
                    ) : items.map(t => (
                      <div
                        key={t.id}
                        className="kanban-card"
                        draggable
                        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onCardDragStart(t) }}
                        onDragEnd={onCardDragEnd}
                        onClick={() => openEdit(t)}
                        style={{ opacity: dragId === t.id ? 0.35 : 1 }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</span>
                          <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', flexShrink: 0 }} onClick={e => { e.stopPropagation(); del(t) }}>🗑</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                          <Pill value={t.priority} options={PRIORITIES} colors={PRIORITY_COLORS} onChange={v => setPriority(t, v)} />
                          <Pill value={t.status} options={STATUSES} colors={STATUS_COLORS} onChange={v => setStatus(t, v)} />
                        </div>
                        {(t.assignee || t.due_date) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                            <span>{t.assignee || ''}</span>
                            <span>{t.due_date || ''}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal === 'form' && (
        <Modal
          title={editId ? 'Edit Task' : 'New Task'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Task'}
            </button>
          </>}
        >
          <div className="field"><label>Title *</label>{F('title')}</div>
          <div className="field">
            <label>Assignee</label>
            <select className="input" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}>
              <option value="">— Unassigned —</option>
              {people.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              {form.assignee && !people.some(p => p.name === form.assignee) && (
                <option value={form.assignee}>{form.assignee}</option>
              )}
            </select>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Due Date</label>
            <input className="input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
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
