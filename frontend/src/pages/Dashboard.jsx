import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

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

function fmt(v) {
  const sym = '£'
  return `${sym}${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [recent, setRecent] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.dashStats(), api.dashUpcoming(), api.dashRecent()])
      .then(([s, u, r]) => { setStats(s); setUpcoming(u); setRecent(r) })
      .catch(console.error)
  }, [])

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
