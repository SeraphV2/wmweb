import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const COLORS = ['#f59e0b','#22c55e','#3b82f6','#ef4444','#f97316','#8b5cf6','#ec4899','#14b8a6']

function fmt(v) { return `£${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` }

export default function Reports() {
  const year = new Date().getFullYear()
  const years = Array.from({ length: 8 }, (_, i) => year - i)
  const [selYear, setSelYear] = useState(year)
  const [summary, setSummary] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [catData, setCatData] = useState([])

  const load = useCallback(() => {
    Promise.all([
      api.reportSummary(selYear),
      api.monthlyRevenue(selYear),
      api.monthlyExpenses(selYear),
      api.expenseByCategory(selYear),
    ]).then(([sum, rev, exp, cat]) => {
      setSummary(sum)
      const revMap = Object.fromEntries(rev.map(r => [r.month, r.revenue]))
      const expMap = Object.fromEntries(exp.map(r => [r.month, r.total]))
      setMonthly(MONTHS.map((name, i) => {
        const key = String(i + 1).padStart(2, '0')
        return { name, revenue: revMap[key] || 0, expenses: expMap[key] || 0 }
      }))
      setCatData(cat.filter(r => r.category).map(r => ({ name: r.category, value: Number(r.total) })))
    }).catch(e => toast(e.message, 'error'))
  }, [selYear])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Year:</span>
          <select className="input" style={{ width: 90 }} value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Summary cards */}
        <div className="stat-grid">
          <div className="stat-card"><div className="label">Revenue (Paid)</div><div className="value">{summary ? fmt(summary.revenue) : '—'}</div></div>
          <div className="stat-card"><div className="label">Total Expenses</div><div className="value" style={{ color: '#ef4444' }}>{summary ? fmt(summary.expenses) : '—'}</div></div>
          <div className="stat-card">
            <div className="label">Net Profit</div>
            <div className="value" style={{ color: summary?.profit >= 0 ? '#15803d' : '#dc2626' }}>{summary ? fmt(summary.profit) : '—'}</div>
          </div>
          <div className="stat-card"><div className="label">Total Projects</div><div className="value">{summary?.projects ?? '—'}</div></div>
        </div>

        <div className="grid-reports">
          {/* Bar chart */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#f5efe5', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
              📊 Revenue vs Expenses
            </div>
            <div style={{ padding: '16px 12px' }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthly} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#7a6850', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7a6850', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `£${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip formatter={(v, n) => [fmt(v), n === 'revenue' ? 'Revenue' : 'Expenses']} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                  <Legend formatter={n => n === 'revenue' ? 'Revenue' : 'Expenses'} />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[4,4,0,0]} />
                  <Bar dataKey="expenses" fill="#ef4444" opacity={0.75} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Pie chart */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '14px 18px', background: '#f5efe5', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                🍕 Expense Breakdown
              </div>
              {catData.length === 0 ? (
                <div className="empty" style={{ padding: '20px' }}>No expense data</div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={catData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ name, percent }) => `${name.slice(0,8)} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Category table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '14px 18px', background: '#f5efe5', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                Expenses by Category
              </div>
              {catData.length === 0 ? (
                <div className="empty" style={{ padding: '16px' }}>No expenses this year</div>
              ) : (
                <table className="tbl" style={{ fontSize: 12 }}>
                  <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                  <tbody>
                    {catData.map((r, i) => (
                      <tr key={i}>
                        <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                          {r.name || 'Other'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
