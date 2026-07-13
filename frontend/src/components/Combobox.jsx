import { useState, useRef, useEffect, useMemo } from 'react'

// Styled replacement for <input list="..."> + <datalist> - the native
// datalist popup can't be themed and looks like unstyled browser chrome.
// Still allows typing a value that isn't in the option list.
export default function Combobox({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.toLowerCase().includes(q))
  }, [value, options])

  function pick(opt) {
    onChange(opt)
    setOpen(false)
  }

  return (
    <div className="combo-wrap" ref={wrapRef}>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
      />
      <span className="combo-chevron">▾</span>
      {open && (
        <div className="combo-panel">
          {filtered.length === 0 ? (
            <div className="combo-empty">No matches — keep typing to add a new one</div>
          ) : filtered.map(o => (
            <div key={o} className="combo-option" onMouseDown={e => { e.preventDefault(); pick(o) }}>{o}</div>
          ))}
        </div>
      )}
    </div>
  )
}
