import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Clients from './pages/Clients'
import Bookings from './pages/Bookings'
import Invoices from './pages/Invoices'
import Expenses from './pages/Expenses'
import Equipment from './pages/Equipment'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Users from './pages/Users'
import ActivityLog from './pages/ActivityLog'

function RequireAuth({ children }) {
  const token = localStorage.getItem('wm_token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <RequireAuth><Layout /></RequireAuth>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="tasks"      element={<Tasks />} />
          <Route path="clients"    element={<Clients />} />
          <Route path="bookings"   element={<Bookings />} />
          <Route path="invoices"   element={<Invoices />} />
          <Route path="expenses"   element={<Expenses />} />
          <Route path="equipment"  element={<Equipment />} />
          <Route path="reports"    element={<Reports />} />
          <Route path="settings"   element={<Settings />} />
          <Route path="users"      element={<Users />} />
          <Route path="activity"   element={<ActivityLog />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
