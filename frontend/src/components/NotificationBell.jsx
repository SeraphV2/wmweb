import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { pushPopup } from './NotificationPopups'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const ENTITY_CONFIG = [
  { type: 'client',    label: 'Client',    path: '/clients',   fetch: api.getClients,   titleOf: r => r.name },
  { type: 'booking',   label: 'Booking',   path: '/bookings',  fetch: api.getProjects,  titleOf: r => r.title },
  { type: 'invoice',   label: 'Invoice',   path: '/invoices',  fetch: api.getInvoices,  titleOf: r => r.invoice_number },
  { type: 'expense',   label: 'Expense',   path: '/expenses',  fetch: api.getExpenses,  titleOf: r => r.description || r.category || 'Expense' },
  { type: 'equipment', label: 'Equipment', path: '/equipment', fetch: api.getEquipment, titleOf: r => r.name },
  { type: 'task',      label: 'Task',      path: '/tasks',     fetch: api.getTasks,     titleOf: r => r.title },
]

const STORAGE_KEY = 'wm_notifications'
const LAST_READ_KEY = 'wm_notif_last_read'
const MAX_STORED = 30

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
  })
  const [lastRead, setLastRead] = useState(() => Number(localStorage.getItem(LAST_READ_KEY)) || 0)
  const [open, setOpen] = useState(false)
  const snapshots = useRef({})
  const wrapRef = useRef(null)
  const navigate = useNavigate()

  const checkAll = useCallback(async () => {
    for (const cfg of ENTITY_CONFIG) {
      let rows
      try { rows = await cfg.fetch() } catch { continue }
      const prevMap = snapshots.current[cfg.type]
      const newMap = new Map(rows.map(r => [r.id, r]))
      if (prevMap) {
        for (const [id, r] of newMap) {
          let event = null
          if (!prevMap.has(id)) {
            event = { kind: 'added', label: `New ${cfg.label.toLowerCase()}: ${cfg.titleOf(r)}` }
          } else if (cfg.type === 'task') {
            const prevRow = prevMap.get(id)
            if (prevRow.assignee !== r.assignee && r.assignee) {
              event = { kind: 'assigned', label: `"${r.title}" assigned to ${r.assignee}` }
            }
          }
          if (event) {
            const note = { id: `${cfg.type}-${id}-${event.kind}-${Date.now()}`, type: cfg.type, path: cfg.path, ts: Date.now(), ...event }
            pushPopup(note)
            setNotifications(prev => {
              const next = [note, ...prev].slice(0, MAX_STORED)
              localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
              return next
            })
          }
        }
      }
      snapshots.current[cfg.type] = newMap
    }
  }, [])

  useEffect(() => { checkAll() }, [checkAll])
  useAutoRefresh(checkAll, 15000)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function toggleOpen() {
    setOpen(o => {
      const next = !o
      if (next) {
        const now = Date.now()
        setLastRead(now)
        localStorage.setItem(LAST_READ_KEY, String(now))
      }
      return next
    })
  }

  function goTo(note) {
    setOpen(false)
    navigate(note.path)
  }

  const unread = notifications.filter(n => n.ts > lastRead).length

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button className="nav-item notif-bell-row" onClick={toggleOpen}>
        <span style={{ fontSize: 16 }}>🔔</span>
        Notifications
        {unread > 0 && <span className="notif-badge-inline">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel notif-panel-up">
          <div className="notif-panel-header">Notifications</div>
          {notifications.length === 0 ? (
            <div className="notif-empty">Nothing yet</div>
          ) : notifications.map(n => (
            <div key={n.id} className="notif-item" onClick={() => goTo(n)}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{n.label}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{timeAgo(n.ts)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
