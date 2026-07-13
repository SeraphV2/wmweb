function csvEscape(val) {
  const s = val == null ? '' : String(val)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows, columns) {
  const header = columns.map(c => csvEscape(c.label)).join(',')
  const lines = rows.map(r =>
    columns.map(c => csvEscape(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','))
  return [header, ...lines].join('\r\n')
}

// Leading BOM so Excel opens the file as UTF-8 instead of mangling non-ASCII
// characters like the £ symbol used throughout this app.
export function downloadCSV(filename, csvString) {
  const blob = new Blob(['﻿' + csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
