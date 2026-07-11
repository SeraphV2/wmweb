const BASE = import.meta.env.VITE_API_URL || ''

function token() {
  return localStorage.getItem('wm_token')
}

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const t = token()
  if (t) headers['Authorization'] = `Bearer ${t}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('wm_token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }

  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : null
}

export const api = {
  // Auth
  login: async (username, password) => {
    const form = new URLSearchParams({ username, password, grant_type: 'password' })
    const res = await fetch(`${BASE}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!res.ok) { const e = await res.json(); throw e }
    const data = await res.json()
    localStorage.setItem('wm_token', data.access_token)
    localStorage.setItem('wm_role', data.role || 'staff')
    localStorage.setItem('wm_name', data.full_name || username)
    return data
  },

  getRole: () => localStorage.getItem('wm_role') || 'staff',
  getName: () => localStorage.getItem('wm_name') || 'User',

  // Users (admin only)
  getUsers:    () => req('GET', '/api/users/'),
  createUser:  (data) => req('POST', '/api/users/', data),
  updateUser:  (id, data) => req('PUT', `/api/users/${id}`, data),
  deleteUser:  (id) => req('DELETE', `/api/users/${id}`),
  assignableUsers: () => req('GET', '/api/users/assignable'),

  // Dashboard
  dashStats:      () => req('GET', '/api/dashboard/stats'),
  dashUpcoming:   () => req('GET', '/api/dashboard/upcoming'),
  dashRecent:     () => req('GET', '/api/dashboard/recent-invoices'),
  dashTaskCounts: () => req('GET', '/api/dashboard/task-status-counts'),
  dashTasksDue:   () => req('GET', '/api/dashboard/tasks-due-soon'),

  // Clients
  getClients:     (search = '') => req('GET', `/api/clients/?search=${encodeURIComponent(search)}`),
  getClient:      (id) => req('GET', `/api/clients/${id}`),
  createClient:   (data) => req('POST', '/api/clients/', data),
  updateClient:   (id, data) => req('PUT', `/api/clients/${id}`, data),
  deleteClient:   (id) => req('DELETE', `/api/clients/${id}`),

  // Projects
  getProjects:    (search = '', status = '') =>
    req('GET', `/api/projects/?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`),
  getProject:     (id) => req('GET', `/api/projects/${id}`),
  createProject:  (data) => req('POST', '/api/projects/', data),
  updateProject:  (id, data) => req('PUT', `/api/projects/${id}`, data),
  deleteProject:  (id) => req('DELETE', `/api/projects/${id}`),

  // Invoices
  nextInvoiceNum: () => req('GET', '/api/invoices/next-number'),
  getInvoices:    (search = '', status = '') =>
    req('GET', `/api/invoices/?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`),
  getInvoice:     (id) => req('GET', `/api/invoices/${id}`),
  createInvoice:  (data) => req('POST', '/api/invoices/', data),
  updateInvoice:  (id, data) => req('PUT', `/api/invoices/${id}`, data),
  updateInvoiceStatus: (id, status) => req('PATCH', `/api/invoices/${id}/status`, { status }),
  deleteInvoice:  (id) => req('DELETE', `/api/invoices/${id}`),
  addPayment:     (id, data) => req('POST', `/api/invoices/${id}/payments`, data),

  // Expenses
  getExpenses:    (search = '', category = '') =>
    req('GET', `/api/expenses/?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`),
  expenseCategories: () => req('GET', '/api/expenses/categories'),
  createExpense:  (data) => req('POST', '/api/expenses/', data),
  updateExpense:  (id, data) => req('PUT', `/api/expenses/${id}`, data),
  deleteExpense:  (id) => req('DELETE', `/api/expenses/${id}`),

  // Equipment
  getEquipment:   (search = '', category = '') =>
    req('GET', `/api/equipment/?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`),
  equipCategories: () => req('GET', '/api/equipment/categories'),
  createEquipment: (data) => req('POST', '/api/equipment/', data),
  updateEquipment: (id, data) => req('PUT', `/api/equipment/${id}`, data),
  deleteEquipment: (id) => req('DELETE', `/api/equipment/${id}`),

  // Tasks
  getTasks:       (search = '') => req('GET', `/api/tasks/?search=${encodeURIComponent(search)}`),
  taskGroups:     () => req('GET', '/api/tasks/groups'),
  createTask:     (data) => req('POST', '/api/tasks/', data),
  updateTask:     (id, data) => req('PUT', `/api/tasks/${id}`, data),
  updateTaskStatus:   (id, status) => req('PATCH', `/api/tasks/${id}/status`, { status }),
  updateTaskPriority: (id, priority) => req('PATCH', `/api/tasks/${id}/priority`, { priority }),
  reorderTasks:   (items) => req('PATCH', '/api/tasks/reorder', { items }),
  deleteTask:     (id) => req('DELETE', `/api/tasks/${id}`),

  // Reports
  reportSummary:      (year) => req('GET', `/api/reports/summary?year=${year}`),
  monthlyRevenue:     (year) => req('GET', `/api/reports/monthly-revenue?year=${year}`),
  monthlyExpenses:    (year) => req('GET', `/api/reports/monthly-expenses?year=${year}`),
  expenseByCategory:  (year) => req('GET', `/api/reports/expense-by-category?year=${year}`),

  // Settings
  getSettings:    () => req('GET', '/api/settings/'),
  updateSettings: (data) => req('PUT', '/api/settings/', data),
}
