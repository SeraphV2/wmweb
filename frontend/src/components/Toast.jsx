import { useState, useEffect, useCallback } from 'react'

let _push = null

export function toast(msg, type = 'info') {
  _push?.({ msg, type, id: Date.now() })
}

export default function Toast() {
  const [items, setItems] = useState([])

  useEffect(() => {
    _push = (item) => {
      setItems(prev => [...prev, item])
      setTimeout(() => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, leaving: true } : i))
        setTimeout(() => setItems(prev => prev.filter(i => i.id !== item.id)), 200)
      }, 3000)
    }
    return () => { _push = null }
  }, [])

  if (!items.length) return null

  return (
    <div className="toast-wrap">
      {items.map(i => (
        <div key={i.id} className={`toast${i.type === 'error' ? ' error' : ''}${i.leaving ? ' leaving' : ''}`}>
          {i.msg}
        </div>
      ))}
    </div>
  )
}
