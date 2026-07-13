import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api'
import { toast } from '../components/Toast'
import { toCSV, downloadCSV } from '../lib/csv'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { CLIENT_COLUMNS, BOOKING_COLUMNS, INVOICE_COLUMNS, EXPENSE_COLUMNS, EQUIPMENT_COLUMNS, TASK_COLUMNS } from '../lib/csvColumns'

const EXPORTS = [
  { key: 'clients',   label: 'Clients',   fetch: () => api.getClients(),  columns: CLIENT_COLUMNS },
  { key: 'bookings',  label: 'Bookings',  fetch: () => api.getProjects(), columns: BOOKING_COLUMNS },
  { key: 'invoices',  label: 'Invoices',  fetch: () => api.getInvoices(), columns: INVOICE_COLUMNS },
  { key: 'expenses',  label: 'Expenses',  fetch: () => api.getExpenses(), columns: EXPENSE_COLUMNS },
  { key: 'equipment', label: 'Equipment', fetch: () => api.getEquipment(), columns: EQUIPMENT_COLUMNS },
  { key: 'tasks',     label: 'Tasks',     fetch: () => api.getTasks(),    columns: TASK_COLUMNS },
]

const COUNT_TILES = [
  { key: 'clients',  label: 'Clients',  icon: '👥' },
  { key: 'projects', label: 'Bookings', icon: '📅' },
  { key: 'invoices', label: 'Invoices', icon: '🧾' },
  { key: 'expenses', label: 'Expenses', icon: '💰' },
  { key: 'equipment',label: 'Equipment',icon: '📷' },
  { key: 'tasks',    label: 'Tasks',    icon: '✅' },
  { key: 'users',    label: 'Users',    icon: '🔐' },
]

export default function AdminTools() {
  const role = api.getRole()
  if (role !== 'admin') return <Navigate to="/dashboard" replace />

  const [exporting, setExporting] = useState(false)
  const [health, setHealth] = useState(null)

  const loadHealth = useCallback(() => {
    api.getAdminHealth().then(setHealth).catch(() => {})
  }, [])

  useEffect(() => { loadHealth() }, [loadHealth])
  useAutoRefresh(loadHealth)

  async function exportAll() {
    setExporting(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      for (const e of EXPORTS) {
        const rows = await e.fetch()
        downloadCSV(`${e.key}-${today}.csv`, toCSV(rows, e.columns))
        // Stagger downloads slightly - browsers throttle/block several
        // simultaneous file downloads triggered in the same tick.
        await new Promise(r => setTimeout(r, 350))
      }
      toast('Export complete — check your downloads folder')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin Tools</h1>
      </div>
      <div className="page-body">
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>System Overview</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {COUNT_TILES.map(t => (
                <div key={t.key} style={{
                  flex: '1 1 80px', minWidth: 80, background: 'var(--input)',
                  borderRadius: 12, padding: '12px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18 }}>{t.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{health ? (health.counts[t.key] ?? 0) : '—'}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{t.label}</div>
                </div>
              ))}
            </div>
            {health?.top_active_users?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                  Most Active
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {health.top_active_users.map(u => (
                    <div key={u.username} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{u.username}</span>
                      <span style={{ color: 'var(--muted)' }}>{u.c} action{u.c === 1 ? '' : 's'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>Data Backup</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Downloads every client, booking, invoice, expense, equipment, and task record as separate CSV files — a full snapshot of the database.
            </p>
            <button className="btn btn-primary" onClick={exportAll} disabled={exporting}>
              {exporting ? 'Exporting…' : '⬇️ Export All Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
