import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { toCSV, downloadCSV } from '../lib/csv'

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']
const EMPTY = { name: '', category: '', brand: '', model_name: '', serial_number: '', purchase_date: '', purchase_price: '', condition: 'Excellent', insured: false, insurance_value: '', notes: '' }
const CSV_COLUMNS = [
  { label: 'Name', value: 'name' },
  { label: 'Category', value: 'category' },
  { label: 'Brand', value: 'brand' },
  { label: 'Model', value: 'model_name' },
  { label: 'Serial', value: 'serial_number' },
  { label: 'Purchase Date', value: 'purchase_date' },
  { label: 'Purchase Price', value: 'purchase_price' },
  { label: 'Condition', value: 'condition' },
  { label: 'Insured', value: r => r.insured ? 'Yes' : 'No' },
  { label: 'Insurance Value', value: 'insurance_value' },
]

export default function Equipment() {
  const [rows, setRows] = useState([])
  const [cats, setCats] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.getEquipment(search, catFilter).then(setRows).catch(e => toast(e.message, 'error'))
  }, [search, catFilter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)
  useEffect(() => { api.equipCategories().then(setCats).catch(() => {}) }, [])

  function openNew() { setForm(EMPTY); setModal('new') }
  function exportCsv() { downloadCSV(`equipment-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, CSV_COLUMNS)) }
  function openEdit() {
    if (!selected) return
    setForm({
      name: selected.name || '', category: selected.category || '',
      brand: selected.brand || '', model_name: selected.model_name || '',
      serial_number: selected.serial_number || '', purchase_date: selected.purchase_date || '',
      purchase_price: selected.purchase_price || '', condition: selected.condition || 'Excellent',
      insured: Boolean(selected.insured), insurance_value: selected.insurance_value || '',
      notes: selected.notes || '',
    })
    setModal('edit')
  }

  async function save() {
    if (!form.name.trim()) { toast('Name is required', 'error'); return }
    setSaving(true)
    try {
      const data = { ...form, purchase_price: Number(form.purchase_price) || 0, insurance_value: Number(form.insurance_value) || 0 }
      if (modal === 'edit') { await api.updateEquipment(selected.id, data); toast('Equipment updated') }
      else { await api.createEquipment(data); toast('Equipment added') }
      setModal(null); setSelected(null); load()
      api.equipCategories().then(setCats).catch(() => {})
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function del() {
    if (!selected || !confirm(`Delete "${selected.name}"?`)) return
    try { await api.deleteEquipment(selected.id); toast('Equipment deleted'); setSelected(null); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const totalValue = rows.reduce((s, r) => s + Number(r.purchase_price || 0), 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Equipment</h1>
        <div className="search-bar">
          <input className="search-input" placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All categories</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>⬇️ Export</button>
          <button className="btn btn-primary" onClick={openNew}>＋ Add Equipment</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div className="empty"><span className="icon">📷</span>No equipment found</div>
          ) : (
            <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Category</th><th>Brand / Model</th><th>Serial</th><th>Condition</th><th>Insured</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={selected?.id === r.id ? 'selected' : ''} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === r.id ? null : r)}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.category || '—'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{[r.brand, r.model_name].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.serial_number || '—'}</td>
                    <td><span className={`badge ${r.condition === 'Excellent' || r.condition === 'Good' ? 'badge-green' : r.condition === 'Fair' ? 'badge-amber' : 'badge-red'}`}>{r.condition}</span></td>
                    <td style={{ textAlign: 'center' }}>{r.insured ? '✅' : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>£{Number(r.purchase_price || 0).toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--muted)', fontSize: 12 }}>Total value:</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>£{totalValue.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={openEdit} disabled={!selected}>✏️ Edit</button>
          <button className="btn btn-danger btn-sm" onClick={del} disabled={!selected}>🗑 Delete</button>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>{rows.length} item(s)</span>
        </div>
      </div>

      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Equipment' : 'Add Equipment'} onClose={() => setModal(null)} size="lg"
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>}>
          <div className="field">
            <label>Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Category</label>
              <input className="input" list="ecats" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Camera, Lens" />
              <datalist id="ecats">{cats.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="field">
              <label>Brand</label>
              <input className="input" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Model</label>
              <input className="input" value={form.model_name} onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))} />
            </div>
            <div className="field">
              <label>Serial Number</label>
              <input className="input" value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
            </div>
          </div>
          <div className="grid-3">
            <div className="field">
              <label>Purchase Date</label>
              <input className="input" type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Purchase Price (£)</label>
              <input className="input" type="number" step="0.01" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} />
            </div>
            <div className="field">
              <label>Condition</label>
              <select className="input" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.insured} onChange={e => setForm(f => ({ ...f, insured: e.target.checked }))} />
              Insured
            </label>
            {form.insured && (
              <div className="field" style={{ flex: 1 }}>
                <label>Insurance Value (£)</label>
                <input className="input" type="number" step="0.01" value={form.insurance_value} onChange={e => setForm(f => ({ ...f, insurance_value: e.target.value }))} />
              </div>
            )}
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
