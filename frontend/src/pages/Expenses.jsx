import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import Combobox from '../components/Combobox'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { toCSV, downloadCSV } from '../lib/csv'
import { EXPENSE_COLUMNS as CSV_COLUMNS } from '../lib/csvColumns'

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'PayPal', 'Other']
const DEFAULT_EXPENSE_CATEGORIES = [
  'Equipment', 'Travel', 'Software', 'Marketing', 'Studio Rental', 'Insurance',
  'Props', 'Printing', 'Editing / Post-Production', 'Subcontractor', 'Other',
]
const EMPTY = { project_id: '', category: '', description: '', amount: '', date: '', payment_method: '', notes: '' }

export default function Expenses() {
  const [rows, setRows] = useState([])
  const [projects, setProjects] = useState([])
  const [cats, setCats] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.getExpenses(search, catFilter).then(setRows).catch(e => toast(e.message, 'error'))
  }, [search, catFilter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)
  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {})
    api.expenseCategories().then(setCats).catch(() => {})
  }, [])

  function openNew() { setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModal('new') }
  function exportCsv() { downloadCSV(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, CSV_COLUMNS)) }
  function openEdit() {
    if (!selected) return
    setForm({
      project_id: selected.project_id || '', category: selected.category || '',
      description: selected.description || '', amount: selected.amount || '',
      date: selected.date || '', payment_method: selected.payment_method || '',
      notes: selected.notes || '',
    })
    setModal('edit')
  }

  async function save() {
    if (!form.description.trim()) { toast('Description is required', 'error'); return }
    setSaving(true)
    try {
      const data = { ...form, project_id: form.project_id ? Number(form.project_id) : null, amount: Number(form.amount) || 0 }
      if (modal === 'edit') { await api.updateExpense(selected.id, data); toast('Expense updated') }
      else { await api.createExpense(data); toast('Expense added') }
      setModal(null); setSelected(null); load()
      api.expenseCategories().then(setCats).catch(() => {})
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function del() {
    if (!selected || !confirm(`Delete this expense?`)) return
    try { await api.deleteExpense(selected.id); toast('Expense deleted'); setSelected(null); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  const categoryOptions = [...new Set([...DEFAULT_EXPENSE_CATEGORIES, ...cats])].sort((a, b) => a.localeCompare(b))

  return (
    <div className="page">
      <div className="page-header">
        <h1>Expenses</h1>
        <div className="search-bar">
          <input className="search-input" placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All categories</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>⬇️ Export</button>
          <button className="btn btn-primary" onClick={openNew}>＋ Add Expense</button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={openEdit} disabled={!selected}>✏️ Edit</button>
          <button className="btn btn-danger btn-sm" onClick={del} disabled={!selected}>🗑 Delete</button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div className="empty"><span className="icon">💰</span>No expenses found</div>
          ) : (
            <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Project</th><th>Method</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={selected?.id === r.id ? 'selected' : ''} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === r.id ? null : r)}>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.date || '—'}</td>
                    <td><span className="badge badge-amber">{r.category || '—'}</span></td>
                    <td>{r.description}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.project_title || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.payment_method || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>£{Number(r.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--muted)', fontSize: 12, paddingTop: 10 }}>Total:</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>£{total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Expense' : 'Add Expense'} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>}>
          <div className="grid-2">
            <div className="field">
              <label>Date</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Amount (£)</label>
              <input className="input" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Category</label>
            <Combobox value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={categoryOptions} placeholder="Choose or type a category" />
          </div>
          <div className="field">
            <label>Description *</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="field">
            <label>Project</label>
            <select className="input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
              <option value="">— None —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Payment Method</label>
            <select className="input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="">— Select —</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  )
}
