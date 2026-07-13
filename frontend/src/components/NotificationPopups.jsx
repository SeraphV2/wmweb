import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

let _push = null

const ICONS = {
  client: '👥', booking: '📅', invoice: '🧾', expense: '💰', equipment: '📷', task: '✅',
}

export function pushPopup(note) {
  _push?.(note)
}

export default function NotificationPopups() {
  const [items, setItems] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    _push = (note) => {
      const id = `${note.id}-popup`
      setItems(prev => [...prev, { ...note, popupId: id }])
      setTimeout(() => {
        setItems(prev => prev.map(i => i.popupId === id ? { ...i, leaving: true } : i))
        setTimeout(() => setItems(prev => prev.filter(i => i.popupId !== id)), 200)
      }, 6000)
    }
    return () => { _push = null }
  }, [])

  function dismiss(popupId) {
    setItems(prev => prev.map(i => i.popupId === popupId ? { ...i, leaving: true } : i))
    setTimeout(() => setItems(prev => prev.filter(i => i.popupId !== popupId)), 200)
  }

  function go(note) {
    dismiss(note.popupId)
    navigate(note.path)
  }

  if (!items.length) return null

  return (
    <div className="notif-popup-wrap">
      {items.map(n => (
        <div key={n.popupId} className={`notif-popup-card${n.leaving ? ' leaving' : ''}`} onClick={() => go(n)}>
          <span className="notif-popup-icon">{ICONS[n.type] || '🔔'}</span>
          <div className="notif-popup-body">
            <div className="notif-popup-title">{n.label}</div>
            <div className="notif-popup-sub">{n.kind === 'assigned' ? 'Task assignment' : 'New ' + n.type}</div>
          </div>
          <button className="notif-popup-close" onClick={e => { e.stopPropagation(); dismiss(n.popupId) }} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  )
}
