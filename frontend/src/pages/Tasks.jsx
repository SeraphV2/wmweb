import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const STATUSES = ['Not Started', 'Working On It', 'Stuck', 'Done']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

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
const GROUP_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const EMPTY_FORM = { title: '', group_name: 'General', status: 'Not Started', priority: 'Medium', assignee: '', due_date: '', notes: '' }

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
  const [groupNames, setGroupNames] = useState([])
  const [people, setPeople] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'new' | 'edit'
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dragOver, setDragOver] = useState(null) // { group, beforeId } | null
  const dragging = useRef(false)

  const load = useCallback(() => {
    if (dragging.current) return
    api.getTasks(search).then(setRows).catch(e => toast(e.message, 'error'))
  }, [search])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)
  useEffect(() => { api.taskGroups().then(setGroupNames).catch(() => {}) }, [])
  useEffect(() => { api.assignableUsers().then(setPeople).catch(() => {}) }, [])

  const groups = useMemo(() => {
    const map = {}
    for (const t of rows) {
      const g = t.group_name || 'General'
      if (!map[g]) map[g] = []
      map[g].push(t)
    }
    return Object.entries(map)
  }, [rows])

  function openNew() { setForm(EMPTY_FORM); setEditId(null); setModal('form') }
  function openEdit(t) {
    setForm({
      title: t.title || '', group_name: t.group_name || 'General',
      status: t.status || 'Not Started', priority: t.priority || 'Medium',
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
    api.updateTaskStatus(t.id, status).catch(e => { toast(e.message, 'error'); load() })
  }

  function setPriority(t, priority) {
    setRows(rs => rs.map(r => r.id === t.id ? { ...r, priority } : r))
    api.updateTaskPriority(t.id, priority).catch(e => { toast(e.message, 'error'); load() })
  }

  // Drag-and-drop: reorder within a group, or move to a different group.
  // beforeId === null means "drop at the end of this group".
  function moveTask(draggedId, targetGroup, beforeId) {
    setRows(rs => {
      const dragged = rs.find(r => r.id === draggedId)
      if (!dragged) return rs
      const rest = rs.filter(r => r.id !== draggedId)
      const moved = { ...dragged, group_name: targetGroup }

      let insertAt = rest.length
      if (beforeId != null) {
        const idx = rest.findIndex(r => r.id === beforeId)
        if (idx !== -1) insertAt = idx
      } else {
        let lastIdx = -1
        rest.forEach((r, i) => { if ((r.group_name || 'General') === targetGroup) lastIdx = i })
        insertAt = lastIdx === -1 ? rest.length : lastIdx + 1
      }

      const next = [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)]

      const counters = {}
      const items = next.map(r => {
        const g = r.group_name || 'General'
        counters[g] = (counters[g] ?? -1) + 1
        return { id: r.id, group_name: g, position: counters[g] }
      })
      api.reorderTasks(items).catch(e => { toast(e.message, 'error'); load() })

      return next
    })
  }

  function onRowDragStart(t) {
    dragging.current = true
    setDragId(t.id)
  }
  function onRowDragEnd() {
    dragging.current = false
    setDragId(null)
    setDragOver(null)
  }
  function onRowDrop(e, targetGroup, targetId) {
    e.preventDefault()
    if (dragId != null && dragId !== targetId) moveTask(dragId, targetGroup, targetId)
    onRowDragEnd()
  }
  function onZoneDrop(e, targetGroup) {
    e.preventDefault()
    if (dragId != null) moveTask(dragId, targetGroup, null)
    onRowDragEnd()
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
          <button className="btn btn-primary" onClick={openNew}>＋ New Task</button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {rows.length === 0 ? (
          <div className="card empty">
            <span className="icon">✅</span>No tasks yet — click + New Task to get started
          </div>
        ) : groups.map(([groupName, items], gi) => (
          <div key={groupName} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
              borderLeft: `4px solid ${GROUP_COLORS[gi % GROUP_COLORS.length]}`,
              background: 'rgba(245,239,229,.7)', borderBottom: '1px solid var(--border-soft)',
            }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{groupName}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{items.length} task{items.length === 1 ? '' : 's'}</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th style={{ width: 28 }}></th><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due Date</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map(t => (
                    <tr
                      key={t.id}
                      className={dragOver?.beforeId === t.id ? 'drag-over' : ''}
                      style={{ cursor: 'pointer', opacity: dragId === t.id ? 0.35 : 1 }}
                      onClick={() => openEdit(t)}
                      onDragOver={e => { e.preventDefault(); setDragOver({ group: groupName, beforeId: t.id }) }}
                      onDragLeave={() => setDragOver(dv => (dv?.beforeId === t.id ? null : dv))}
                      onDrop={e => onRowDrop(e, groupName, t.id)}
                    >
                      <td
                        className="drag-handle"
                        draggable
                        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onRowDragStart(t) }}
                        onDragEnd={onRowDragEnd}
                        onClick={e => e.stopPropagation()}
                        title="Drag to reorder"
                      >⠿</td>
                      <td style={{ fontWeight: 600 }}>{t.title}</td>
                      <td><Pill value={t.status} options={STATUSES} colors={STATUS_COLORS} onChange={v => setStatus(t, v)} /></td>
                      <td><Pill value={t.priority} options={PRIORITIES} colors={PRIORITY_COLORS} onChange={v => setPriority(t, v)} /></td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{t.assignee || '—'}</td>
                      <td style={{ fontSize: 12 }}>{t.due_date || '—'}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); del(t) }}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  <tr
                    className={dragOver?.group === groupName && dragOver?.beforeId == null ? 'drag-over' : ''}
                    onDragOver={e => { e.preventDefault(); setDragOver({ group: groupName, beforeId: null }) }}
                    onDragLeave={() => setDragOver(dv => (dv?.group === groupName && dv?.beforeId == null ? null : dv))}
                    onDrop={e => onZoneDrop(e, groupName)}
                  >
                    <td colSpan={7} style={{ height: 12, padding: 0 }} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
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
          <div className="grid-2">
            <div className="field">
              <label>Group</label>
              <input className="input" list="taskgroups" value={form.group_name} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))} placeholder="e.g. This Week" />
              <datalist id="taskgroups">{groupNames.map(g => <option key={g} value={g} />)}</datalist>
            </div>
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
