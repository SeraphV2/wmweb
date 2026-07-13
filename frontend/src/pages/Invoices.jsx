import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { toCSV, downloadCSV } from '../lib/csv'
import { INVOICE_COLUMNS as CSV_COLUMNS } from '../lib/csvColumns'

const STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']
const BADGE = { Paid: 'badge-green', Draft: 'badge-gray', Sent: 'badge-blue', Overdue: 'badge-red', Cancelled: 'badge-gray' }

const EMPTY_ITEM = { description: '', quantity: 1, rate: '', amount: 0 }
const EMPTY_FORM = {
  invoice_number: '', project_id: '', client_id: '', issue_date: '', due_date: '',
  status: 'Draft', tax_rate: '0', discount: '0', notes: '', items: [{ ...EMPTY_ITEM }],
}

export default function Invoices() {
  const [rows, setRows] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null) // null | 'new' | 'edit' | 'view' | 'payment'
  const [form, setForm] = useState(EMPTY_FORM)
  const [payForm, setPayForm] = useState({ amount: '', date: '', method: '', reference: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.getInvoices(search, statusFilter).then(setRows).catch(e => toast(e.message, 'error'))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)
  useEffect(() => {
    api.getClients().then(setClients).catch(() => {})
    api.getProjects().then(setProjects).catch(() => {})
  }, [])

  function calcTotals(items, taxRate, discount) {
    const sub = items.reduce((s, i) => s + Number(i.amount || 0), 0)
    const tax = sub * (Number(taxRate) || 0) / 100
    return { subtotal: sub, tax_amount: tax, total: sub + tax - (Number(discount) || 0) }
  }

  function updateItem(idx, key, val) {
    setForm(f => {
      const items = f.items.map((it, i) => {
        if (i !== idx) return it
        const updated = { ...it, [key]: val }
        if (key === 'quantity' || key === 'rate') {
          updated.amount = (Number(updated.quantity) || 0) * (Number(updated.rate) || 0)
        }
        return updated
      })
      return { ...f, items }
    })
  }

  function addItem() { setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] })) }
  function removeItem(idx) { setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) })) }

  function openNew() {
    const today = new Date().toISOString().slice(0, 10)
    setForm({ ...EMPTY_FORM, issue_date: today })
    setModal('new')
    api.nextInvoiceNum().then(r => setForm(f => ({ ...f, invoice_number: r.number }))).catch(() => {})
  }
  function exportCsv() { downloadCSV(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, CSV_COLUMNS)) }

  function openEdit() {
    if (!selected) return
    api.getInvoice(selected.id).then(inv => {
      setForm({
        invoice_number: inv.invoice_number || '', project_id: inv.project_id || '',
        client_id: inv.client_id || '', issue_date: inv.issue_date || '',
        due_date: inv.due_date || '', status: inv.status || 'Draft',
        tax_rate: inv.tax_rate || '0', discount: inv.discount || '0',
        notes: inv.notes || '', items: inv.items?.length ? inv.items : [{ ...EMPTY_ITEM }],
      })
      setModal('edit')
    }).catch(e => toast(e.message, 'error'))
  }

  function openPayment() {
    if (!selected) return
    setPayForm({ amount: '', date: new Date().toISOString().slice(0, 10), method: '', reference: '', notes: '' })
    setModal('payment')
  }

  async function save() {
    if (!form.client_id) { toast('Client is required', 'error'); return }
    setSaving(true)
    try {
      const tots = calcTotals(form.items, form.tax_rate, form.discount)
      const data = { ...form, ...tots, project_id: form.project_id ? Number(form.project_id) : null, client_id: Number(form.client_id), tax_rate: Number(form.tax_rate) || 0, discount: Number(form.discount) || 0 }
      if (modal === 'edit') { await api.updateInvoice(selected.id, data); toast('Invoice updated') }
      else { await api.createInvoice(data); toast('Invoice created') }
      setModal(null); setSelected(null); load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function savePayment() {
    if (!payForm.amount) { toast('Amount is required', 'error'); return }
    setSaving(true)
    try {
      await api.addPayment(selected.id, { invoice_id: selected.id, amount: Number(payForm.amount), ...payForm })
      toast('Payment recorded')
      setModal(null); load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function del() {
    if (!selected || !confirm(`Delete invoice ${selected.invoice_number}?`)) return
    try { await api.deleteInvoice(selected.id); toast('Invoice deleted'); setSelected(null); load() }
    catch (e) { toast(e.message, 'error') }
  }

  async function changeStatus(status) {
    if (!selected) return
    try { await api.updateInvoiceStatus(selected.id, status); toast(`Marked as ${status}`); load(); setSelected(null) }
    catch (e) { toast(e.message, 'error') }
  }

  const tots = calcTotals(form.items, form.tax_rate, form.discount)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Invoices</h1>
        <div className="search-bar">
          <input className="search-input" placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>⬇️ Export</button>
          <button className="btn btn-primary" onClick={openNew}>＋ New Invoice</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div className="empty"><span className="icon">🧾</span>No invoices found</div>
          ) : (
            <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Invoice #</th><th>Client</th><th>Project</th><th>Issue Date</th><th>Due Date</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={selected?.id === r.id ? 'selected' : ''} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === r.id ? null : r)}>
                    <td style={{ fontWeight: 600 }}>{r.invoice_number}</td>
                    <td>{r.client_name || '—'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.project_title || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.issue_date || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.due_date || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>£{Number(r.total || 0).toFixed(2)}</td>
                    <td><span className={`badge ${BADGE[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={openEdit} disabled={!selected}>✏️ Edit</button>
          <button className="btn btn-ghost btn-sm" onClick={openPayment} disabled={!selected}>💵 Record Payment</button>
          {selected && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => changeStatus('Sent')} disabled={!selected}>📤 Mark Sent</button>
              <button className="btn btn-ghost btn-sm" onClick={() => changeStatus('Paid')} disabled={!selected}>✅ Mark Paid</button>
            </>
          )}
          <button className="btn btn-danger btn-sm" onClick={del} disabled={!selected}>🗑 Delete</button>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>{rows.length} invoice(s)</span>
        </div>
      </div>

      {/* New/Edit modal */}
      {(modal === 'new' || modal === 'edit') && (
        <Modal title={modal === 'edit' ? 'Edit Invoice' : 'New Invoice'} onClose={() => setModal(null)} size="lg"
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Invoice'}</button>
          </>}>
          <div className="grid-2">
            <div className="field">
              <label>Invoice #</label>
              <input className="input" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
            </div>
            <div className="field">
              <label>Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Client *</label>
              <select className="input" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Project</label>
              <select className="input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                <option value="">— None —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Issue Date</label>
              <input className="input" type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Due Date</label>
              <input className="input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, display: 'block', marginBottom: 8 }}>Line Items</label>
            <div className="tbl-wrap">
            <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--input)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', width: '45%' }}>Description</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', width: '15%' }}>Qty</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', width: '20%' }}>Rate</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', width: '15%' }}>Amount</th>
                  <th style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px' }}><input className="input" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} /></td>
                    <td style={{ padding: '4px' }}><input className="input" type="number" style={{ textAlign: 'right' }} value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} /></td>
                    <td style={{ padding: '4px' }}><input className="input" type="number" step="0.01" style={{ textAlign: 'right' }} value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} /></td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>£{Number(item.amount || 0).toFixed(2)}</td>
                    <td style={{ padding: '4px' }}><button className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }} onClick={() => removeItem(i)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addItem}>＋ Add Line</button>
          </div>

          {/* Totals */}
          <div className="grid-2">
            <div className="field">
              <label>Tax Rate (%)</label>
              <input className="input" type="number" step="0.01" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
            </div>
            <div className="field">
              <label>Discount (£)</label>
              <input className="input" type="number" step="0.01" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
            </div>
          </div>
          <div style={{ background: 'var(--input)', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>£{tots.subtotal.toFixed(2)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax ({form.tax_rate}%)</span><span>£{tots.tax_amount.toFixed(2)}</span></div>
            {Number(form.discount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>-£{Number(form.discount).toFixed(2)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}><span>Total</span><span>£{tots.total.toFixed(2)}</span></div>
          </div>

          <div className="field">
            <label>Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </Modal>
      )}

      {/* Payment modal */}
      {modal === 'payment' && (
        <Modal title="Record Payment" onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={savePayment} disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
          </>}>
          <div className="grid-2">
            <div className="field">
              <label>Amount (£) *</label>
              <input className="input" type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="field">
              <label>Date</label>
              <input className="input" type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Method</label>
            <input className="input" value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} placeholder="e.g. Bank transfer, Cash" />
          </div>
          <div className="field">
            <label>Reference</label>
            <input className="input" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea className="input" rows={2} value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  )
}
