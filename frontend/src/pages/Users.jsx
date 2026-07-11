import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'

const ROLES = ['admin', 'staff', 'viewer']
const ROLE_INFO = {
  admin:  { label: 'Admin',  desc: 'Full access + user management', badge: 'badge-amber' },
  staff:  { label: 'Staff',  desc: 'Create & edit all data',        badge: 'badge-blue' },
  viewer: { label: 'Viewer', desc: 'Read-only access',              badge: 'badge-gray' },
}

const EMPTY_FORM = { username: '', password: '', full_name: '', role: 'staff', active: true }

export default function Users() {
  const role = api.getRole()
  if (role !== 'admin') return <Navigate to="/dashboard" replace />

  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  function load() {
    api.getUsers().then(setRows).catch(e => toast(e.message, 'error'))
  }
  useEffect(load, [])

  function openNew() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setModal('form')
  }

  function openEdit(user) {
    setForm({
      username: user.username,
      password: '',
      full_name: user.full_name || '',
      role: user.role,
      active: Boolean(user.active),
    })
    setEditId(user.id)
    setModal('form')
  }

  async function save() {
    if (!form.username.trim()) { toast('Username is required', 'error'); return }
    if (!editId && !form.password) { toast('Password is required for new users', 'error'); return }
    setSaving(true)
    try {
      if (editId) {
        await api.updateUser(editId, form)
        toast('User updated')
      } else {
        await api.createUser(form)
        toast('User created')
      }
      setModal(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function del(user) {
    if (!confirm(`Delete user "${user.username}"?`)) return
    try {
      await api.deleteUser(user.id)
      toast('User deleted')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  function F(key, type = 'text') {
    return (
      <input className="input" type={type} value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Users</h1>
        <button className="btn btn-primary" onClick={openNew}>＋ Add User</button>
      </div>

      <div className="page-body">
        {/* Role legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {ROLES.map(r => (
            <div key={r} className="card" style={{ padding: '10px 16px', flex: 1, minWidth: 160 }}>
              <span className={`badge ${ROLE_INFO[r].badge}`}>{ROLE_INFO[r].label}</span>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{ROLE_INFO[r].desc}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div className="empty"><span className="icon">🔐</span>No users found</div>
          ) : (
            <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 700, color: '#000', flexShrink: 0,
                        }}>
                          {(u.full_name || u.username).charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{u.full_name || '—'}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{u.username}</td>
                    <td>
                      <span className={`badge ${ROLE_INFO[u.role]?.badge || 'badge-gray'}`}>
                        {ROLE_INFO[u.role]?.label || u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{u.created_at?.slice(0, 10) || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => del(u)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {modal === 'form' && (
        <Modal
          title={editId ? 'Edit User' : 'Add User'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create User'}
            </button>
          </>}
        >
          <div className="grid-2">
            <div className="field"><label>Full Name</label>{F('full_name')}</div>
            <div className="field"><label>Username *</label>{F('username')}</div>
          </div>

          <div className="field">
            <label>{editId ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
            {F('password', 'password')}
          </div>

          <div className="field">
            <label>Role</label>
            <select className="input" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_INFO[r].label} — {ROLE_INFO[r].desc}</option>
              ))}
            </select>
          </div>

          {editId && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Account active
            </label>
          )}
        </Modal>
      )}
    </div>
  )
}
