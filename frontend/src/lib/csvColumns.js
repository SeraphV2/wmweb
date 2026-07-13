export const CLIENT_COLUMNS = [
  { label: 'First Name', value: 'first_name' },
  { label: 'Last Name', value: 'last_name' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'Address', value: 'address' },
  { label: 'City', value: 'city' },
  { label: 'State', value: 'state' },
  { label: 'ZIP', value: 'zip' },
  { label: 'Country', value: 'country' },
  { label: 'Projects', value: 'project_count' },
  { label: 'Notes', value: 'notes' },
]

export const BOOKING_COLUMNS = [
  { label: 'Title', value: 'title' },
  { label: 'Client', value: 'client_name' },
  { label: 'Type', value: 'type' },
  { label: 'Status', value: 'status' },
  { label: 'Date', value: 'date' },
  { label: 'Start Time', value: 'start_time' },
  { label: 'End Time', value: 'end_time' },
  { label: 'Location', value: 'location' },
  { label: 'Package', value: 'package' },
  { label: 'Rate', value: 'rate' },
  { label: 'Deposit', value: 'deposit' },
  { label: 'Notes', value: 'notes' },
]

export const INVOICE_COLUMNS = [
  { label: 'Invoice #', value: 'invoice_number' },
  { label: 'Client', value: 'client_name' },
  { label: 'Project', value: 'project_title' },
  { label: 'Issue Date', value: 'issue_date' },
  { label: 'Due Date', value: 'due_date' },
  { label: 'Status', value: 'status' },
  { label: 'Subtotal', value: 'subtotal' },
  { label: 'Tax', value: 'tax_amount' },
  { label: 'Discount', value: 'discount' },
  { label: 'Total', value: 'total' },
]

export const EXPENSE_COLUMNS = [
  { label: 'Date', value: 'date' },
  { label: 'Category', value: 'category' },
  { label: 'Description', value: 'description' },
  { label: 'Project', value: 'project_title' },
  { label: 'Method', value: 'payment_method' },
  { label: 'Amount', value: 'amount' },
]

export const EQUIPMENT_COLUMNS = [
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

export const TASK_COLUMNS = [
  { label: 'Title', value: 'title' },
  { label: 'Status', value: 'status' },
  { label: 'Priority', value: 'priority' },
  { label: 'Assignee', value: 'assignee' },
  { label: 'Due Date', value: 'due_date' },
  { label: 'Notes', value: 'notes' },
]
