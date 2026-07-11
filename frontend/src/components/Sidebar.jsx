import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api'

const NAV = [
  { section: 'MAIN',    to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { section: null,      to: '/clients',   icon: '👥', label: 'Clients' },
  { section: null,      to: '/bookings',  icon: '📅', label: 'Bookings' },
  { section: 'FINANCE', to: '/invoices',  icon: '🧾', label: 'Invoices' },
  { section: null,      to: '/expenses',  icon: '💰', label: 'Expenses' },
  { section: 'MANAGE',  to: '/equipment', icon: '📷', label: 'Equipment' },
  { section: null,      to: '/reports',   icon: '📈', label: 'Reports' },
]

const ROLE_BADGE = {
  admin:  { label: 'Admin',  bg: '#fef3c7', color: '#92400e' },
  staff:  { label: 'Staff',  bg: '#dbeafe', color: '#1e40af' },
  viewer: { label: 'Viewer', bg: '#f3f4f6', color: '#6b7280' },
}

export default function Sidebar({ mobileOpen = false, onClose }) {
  const [company, setCompany] = useState('Waffle Media')
  const navigate = useNavigate()
  const role = api.getRole()
  const name = api.getName()

  useEffect(() => {
    api.getSettings().then(s => {
      if (s?.company_name) setCompany(s.company_name)
    }).catch(() => {})
  }, [])

  function logout() {
    localStorage.removeItem('wm_token')
    localStorage.removeItem('wm_role')
    localStorage.removeItem('wm_name')
    navigate('/login')
  }

  return (
    <aside className={`app-sidebar${mobileOpen ? ' open' : ''}`} style={{
      width: 235, background: 'rgba(255,255,255,.92)',
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      borderRight: '1px solid var(--border-soft)', boxShadow: '6px 0 30px rgba(28,20,16,.05)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '22px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, background: 'var(--input)', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
        }}>🎬</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', lineHeight: 1.2 }}>{company}</div>
          <div style={{ fontSize: 9, color: 'var(--muted)' }}>Business Suite</div>
        </div>
        <button onClick={onClose} className="close-btn sidebar-close-only" aria-label="Close menu">×</button>
      </div>

      <div style={{ height: 1, background: 'var(--input)', margin: '0 12px 6px' }} />

      {/* Logged-in user chip */}
      <div style={{ margin: '0 12px 8px', padding: '8px 12px', background: 'var(--input)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#000', flexShrink: 0 }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: ROLE_BADGE[role]?.bg || '#f3f4f6', color: ROLE_BADGE[role]?.color || '#6b7280', fontWeight: 600 }}>
              {ROLE_BADGE[role]?.label || role}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {NAV.map((item) => (
          <div key={item.to}>
            {item.section && (
              <div style={{ padding: '12px 22px 2px', fontSize: 9, fontWeight: 700, color: '#a09070', letterSpacing: '.04em' }}>
                {item.section}
              </div>
            )}
            <NavItem {...item} />
          </div>
        ))}

        {/* Admin-only section */}
        {role === 'admin' && (
          <>
            <div style={{ padding: '12px 22px 2px', fontSize: 9, fontWeight: 700, color: '#a09070', letterSpacing: '.04em' }}>
              ADMIN
            </div>
            <NavItem to="/users" icon="🔐" label="Users" />
          </>
        )}
      </nav>

      <div style={{ height: 1, background: 'var(--input)', margin: '0 12px 6px' }} />

      {(role === 'admin' || role === 'staff') && <NavItem to="/settings" icon="⚙️" label="Settings" />}

      <button onClick={logout} className="nav-item" style={{
        margin: '4px 12px 8px', padding: '8px 14px', borderRadius: 8,
        border: 'none', background: 'transparent', color: 'var(--muted)',
        fontSize: 12, textAlign: 'left', cursor: 'pointer',
      }}>
        🚪 Sign out
      </button>

      <div style={{ padding: '0 12px 12px', fontSize: 8, color: '#a09070' }}>
        v1.0 · Waffle Media Tool
      </div>
    </aside>
  )
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink to={to} className="nav-item" style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '1px 8px', padding: '10px 14px', borderRadius: 8,
      textDecoration: 'none', fontSize: 12, fontWeight: isActive ? 700 : 400,
      color: isActive ? 'var(--text)' : '#6b5840',
      background: isActive ? 'var(--nav-active)' : 'transparent',
      borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
    })}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </NavLink>
  )
}
