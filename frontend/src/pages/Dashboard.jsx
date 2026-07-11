import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const STATUS_BADGE = {
  Paid:      'badge-green',
  Draft:     'badge-gray',
  Sent:      'badge-blue',
  Overdue:   'badge-red',
  Cancelled: 'badge-gray',
}

const PROJ_BADGE = {
  Confirmed:   'badge-green',
  Inquiry:     'badge-amber',
  'In Progress': 'badge-blue',
  Completed:   'badge-gray',
  Cancelled:   'badge-gray',
}

const TASK_STATUSES = ['Not Started', 'Working On It', 'Stuck', 'Done']
const TASK_STATUS_COLORS = {
  'Not Started':   { bg: '#f3f4f6', color: '#6b7280' },
  'Working On It': { bg: '#fef3c7', color: '#92400e' },
  'Stuck':         { bg: '#fee2e2', color: '#991b1b' },
  'Done':          { bg: '#dcfce7', color: '#15803d' },
}

function fmt(v) {
  const sym = '£'
  return `${sym}${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [recent, setRecent] = useState([])
  const [taskCounts, setTaskCounts] = useState({})
  const [dueSoon, setDueSoon] = useState([])
  const navigate = useNavigate()
  const todayStr = new Date().toISOString().slice(0, 10)

  const load = useCallback(() => {
    Promise.all([api.dashStats(), api.dashUpcoming(), api.dashRecent(), api.dashTaskCounts(), api.dashTasksDue()])
      .then(([s, u, r, tc, td]) => { setStats(s); setUpcoming(u); setRecent(r); setTaskCounts(tc); setDueSoon(td) })
      .catch(console.error)
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stat cards */}
        <div className="stat-grid">
          <Stat label="Revenue This Month" value={fmt(stats?.month_revenue)} sub="from paid invoices" />
          <Stat label="Outstanding" value={fmt(stats?.outstanding_total)} sub={`${stats?.outstanding_count ?? 0} invoice(s)`} />
          <Stat label="Expenses This Month" value={fmt(stats?.month_expenses)} sub="recorded expenses" />
          <Stat label="Year Projects" value={stats?.year_projects ?? '—'} sub={`${stats?.upcoming_7days ?? 0} in next 7 days`} />
        </div>

        <div className="grid-dash">
          {/* Upcoming bookings */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#f5efe5', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>📅 Upcoming Bookings</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bookings')}>View all</button>
            </div>
            {upcoming.length === 0 ? (
              <div className="empty" style={{ padding: '30px 20px' }}>
                <span className="icon">📅</span>No upcoming bookings
              </div>
            ) : (
              <table className="tbl">
                <tbody>
                  {upcoming.slice(0, 6).map(p => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.client_name}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.date}</td>
                      <td><span className={`badge ${PROJ_BADGE[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent invoices */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#f5efe5', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>🧾 Recent Invoices</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/invoices')}>View all</button>
            </div>
            {recent.length === 0 ? (
              <div className="empty" style={{ padding: '30px 20px' }}>
                <span className="icon">🧾</span>No invoices yet
              </div>
            ) : (
              <table className="tbl">
                <tbody>
                  {recent.map(inv => (
                    <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/invoices')}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.invoice_number}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{inv.client_name}</div>
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{fmt(inv.total)}</td>
                      <td><span className={`badge ${STATUS_BADGE[inv.status] || 'badge-gray'}`}>{inv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="grid-dash">
          {/* Tasks by status */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#f5efe5', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>📋 Tasks by Status</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>View all</button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {TASK_STATUSES.map(s => {
                const c = TASK_STATUS_COLORS[s]
                return (
                  <div key={s} onClick={() => navigate('/tasks')} style={{
                    cursor: 'pointer', flex: '1 1 100px', minWidth: 100,
                    background: c.bg, color: c.color, borderRadius: 12, padding: '12px 14px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{taskCounts[s] ?? 0}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{s}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tasks due soon */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#f5efe5', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>⏰ Tasks Due Soon</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>View all</button>
            </div>
            {dueSoon.length === 0 ? (
              <div className="empty" style={{ padding: '30px 20px' }}>
                <span className="icon">⏰</span>Nothing due in the next 7 days
              </div>
            ) : (
              <table className="tbl">
                <tbody>
                  {dueSoon.map(t => {
                    const overdue = t.due_date && t.due_date < todayStr
                    const c = TASK_STATUS_COLORS[t.status] || TASK_STATUS_COLORS['Not Started']
                    return (
                      <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.assignee || '—'}</div>
                        </td>
                        <td style={{ fontSize: 12, color: overdue ? '#dc2626' : 'var(--muted)', fontWeight: overdue ? 700 : 400 }}>
                          {overdue ? 'Overdue · ' : ''}{t.due_date}
                        </td>
                        <td><span className="badge" style={{ background: c.bg, color: c.color }}>{t.status}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value ?? '—'}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}
