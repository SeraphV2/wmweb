import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const ACTION_BADGE = { created: 'badge-green', updated: 'badge-blue', deleted: 'badge-red' }
const ENTITY_ICON = { client: '👥', booking: '📅', invoice: '🧾', expense: '💰', equipment: '📷', task: '✅', user: '🔐' }

export default function ActivityLog() {
  const role = api.getRole()
  if (role !== 'admin') return <Navigate to="/dashboard" replace />

  const [rows, setRows] = useState([])

  const load = useCallback(() => {
    api.getActivity().then(setRows).catch(e => toast(e.message, 'error'))
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Activity Log</h1>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Most recent {rows.length} events</span>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div className="empty"><span className="icon">📜</span>No activity recorded yet</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th></th><th>What</th><th>By</th><th>Action</th><th>When</th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 16, textAlign: 'center' }}>{ENTITY_ICON[r.entity_type] || '📄'}</td>
                      <td style={{ fontWeight: 600 }}>{r.label}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.username}</td>
                      <td><span className={`badge ${ACTION_BADGE[r.action] || 'badge-gray'}`}>{r.action}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
