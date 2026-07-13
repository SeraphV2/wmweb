import ssl as _ssl
import os
import json
from decimal import Decimal
import pymysql
import pymysql.cursors

SETTINGS_DEFAULTS = {
    'company_name':    'Waffle Media',
    'owner_name':      '',
    'email':           '',
    'phone':           '',
    'address':         '',
    'city':            '',
    'state':           '',
    'zip':             '',
    'website':         '',
    'tax_rate':        '0',
    'invoice_prefix':  'INV',
    'payment_terms':   '30',
    'thank_you_note':  'Thank you for your business!',
    'currency_symbol': '£',
}


def _get_config():
    if os.environ.get('DB_HOST'):
        return {
            'host': os.environ['DB_HOST'],
            'port': int(os.environ.get('DB_PORT', 3306)),
            'user': os.environ['DB_USER'],
            'password': os.environ['DB_PASSWORD'],
            'database': os.environ.get('DB_NAME', 'defaultdb'),
        }
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db_config.json')
    with open(config_path) as f:
        return json.load(f)


class Database:
    _tables_ready = False

    def __init__(self):
        self._mysql = None
        self._mc = None
        self._connect()

    def _connect(self):
        cfg = _get_config()
        ssl_ctx = _ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = _ssl.CERT_NONE
        self._mysql = pymysql.connect(
            host=cfg['host'],
            port=int(cfg['port']),
            user=cfg['user'],
            password=cfg['password'],
            database=cfg['database'],
            ssl=ssl_ctx,
            autocommit=True,
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=15,
        )
        self._mc = self._mysql.cursor()
        if not Database._tables_ready:
            self._create_tables()
            Database._tables_ready = True

    def _ex(self, sql, params=None):
        try:
            self._mc.execute(sql, params or ())
        except Exception:
            self._mysql.ping(reconnect=True)
            self._mc = self._mysql.cursor()
            self._mc.execute(sql, params or ())

    def _normalise(self, value):
        import datetime as dt
        if isinstance(value, dt.timedelta):
            total = int(value.total_seconds())
            h, rem = divmod(abs(total), 3600)
            return f"{h:02d}:{rem // 60:02d}"
        if isinstance(value, (dt.date, dt.datetime)):
            return value.strftime('%Y-%m-%d')
        if isinstance(value, Decimal):
            return float(value)
        return value

    def _row(self):
        row = self._mc.fetchone()
        if row is None:
            return None
        return {k: self._normalise(v) for k, v in row.items()}

    def _rows(self):
        return [{k: self._normalise(v) for k, v in row.items()}
                for row in self._mc.fetchall()]

    def _create_tables(self):
        stmts = [
            """CREATE TABLE IF NOT EXISTS settings (
                `key` VARCHAR(100) PRIMARY KEY,
                value TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS users (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                username      VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name     VARCHAR(255) DEFAULT '',
                role          VARCHAR(50)  DEFAULT 'staff',
                active        TINYINT(1)   DEFAULT 1,
                theme         VARCHAR(20)  DEFAULT 'light',
                last_login    TIMESTAMP NULL DEFAULT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS clients (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                name       VARCHAR(255) NOT NULL,
                email      VARCHAR(255),
                phone      VARCHAR(50),
                address    VARCHAR(255),
                city       VARCHAR(100),
                state      VARCHAR(100),
                zip        VARCHAR(20),
                notes      TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS projects (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                client_id  INT,
                title      VARCHAR(255) NOT NULL,
                type       VARCHAR(100) DEFAULT 'Photography',
                status     VARCHAR(50)  DEFAULT 'Inquiry',
                `date`     DATE,
                start_time TIME,
                end_time   TIME,
                location   VARCHAR(255),
                package    VARCHAR(255),
                rate       DECIMAL(10,2) DEFAULT 0,
                deposit    DECIMAL(10,2) DEFAULT 0,
                notes      TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS invoices (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                invoice_number VARCHAR(50) UNIQUE,
                project_id     INT,
                client_id      INT,
                issue_date     DATE,
                due_date       DATE,
                status         VARCHAR(50)   DEFAULT 'Draft',
                subtotal       DECIMAL(10,2) DEFAULT 0,
                tax_rate       DECIMAL(5,2)  DEFAULT 0,
                tax_amount     DECIMAL(10,2) DEFAULT 0,
                discount       DECIMAL(10,2) DEFAULT 0,
                total          DECIMAL(10,2) DEFAULT 0,
                notes          TEXT,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS invoice_items (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id  INT,
                description TEXT,
                quantity    DECIMAL(10,2) DEFAULT 1,
                rate        DECIMAL(10,2) DEFAULT 0,
                amount      DECIMAL(10,2) DEFAULT 0
            )""",
            """CREATE TABLE IF NOT EXISTS expenses (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                project_id     INT,
                category       VARCHAR(100),
                description    TEXT,
                amount         DECIMAL(10,2) DEFAULT 0,
                `date`         DATE,
                payment_method VARCHAR(100),
                notes          TEXT,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS payments (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT,
                amount     DECIMAL(10,2) DEFAULT 0,
                `date`     DATE,
                method     VARCHAR(100),
                reference  VARCHAR(255),
                notes      TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS equipment (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                name            VARCHAR(255) NOT NULL,
                category        VARCHAR(100),
                brand           VARCHAR(100),
                model_name      VARCHAR(100),
                serial_number   VARCHAR(100),
                purchase_date   DATE,
                purchase_price  DECIMAL(10,2) DEFAULT 0,
                `condition`     VARCHAR(50)   DEFAULT 'Excellent',
                insured         TINYINT(1)    DEFAULT 0,
                insurance_value DECIMAL(10,2) DEFAULT 0,
                notes           TEXT,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS tasks (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                title       VARCHAR(255) NOT NULL,
                group_name  VARCHAR(100) DEFAULT 'General',
                status      VARCHAR(50)  DEFAULT 'Not Started',
                priority    VARCHAR(50)  DEFAULT 'Medium',
                assignee    VARCHAR(100) DEFAULT '',
                due_date    DATE,
                notes       TEXT,
                position    INT DEFAULT 0,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS activity_log (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                username    VARCHAR(100) NOT NULL,
                action      VARCHAR(20)  NOT NULL,
                entity_type VARCHAR(50)  NOT NULL,
                entity_id   INT,
                label       VARCHAR(255),
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
        ]
        for stmt in stmts:
            self._ex(stmt)
        for stmt in [
            "ALTER TABLE tasks ADD COLUMN position INT DEFAULT 0",
            "ALTER TABLE users ADD COLUMN theme VARCHAR(20) DEFAULT 'light'",
            "ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL",
        ]:
            try:
                self._mc.execute(stmt)
            except Exception:
                pass
        for k, v in SETTINGS_DEFAULTS.items():
            self._ex(
                "INSERT IGNORE INTO settings (`key`, value) VALUES (%s, %s)", (k, v))

    # ── Settings ──────────────────────────────────────────────────────────────

    def get_setting(self, key, default=''):
        self._ex("SELECT value FROM settings WHERE `key`=%s", (key,))
        row = self._row()
        return row['value'] if row else default

    def set_setting(self, key, value):
        self._ex(
            "INSERT INTO settings (`key`, value) VALUES (%s, %s) "
            "ON DUPLICATE KEY UPDATE value=%s", (key, value, value))

    def get_all_settings(self):
        self._ex("SELECT `key`, value FROM settings")
        return {r['key']: r['value'] for r in self._rows()}

    def update_settings(self, data: dict):
        for k, v in data.items():
            self.set_setting(k, v)

    # ── Users ─────────────────────────────────────────────────────────────────

    def get_users(self):
        self._ex(
            "SELECT id, username, full_name, role, active, theme, last_login, created_at "
            "FROM users ORDER BY created_at")
        return self._rows()

    def get_user_by_username(self, username):
        self._ex("SELECT * FROM users WHERE username=%s AND active=1", (username,))
        return self._row()

    def get_user_by_id(self, uid):
        self._ex("SELECT * FROM users WHERE id=%s", (uid,))
        return self._row()

    def update_user_theme(self, uid, theme):
        self._ex("UPDATE users SET theme=%s WHERE id=%s", (theme, uid))

    def record_login(self, uid):
        self._ex("UPDATE users SET last_login=NOW() WHERE id=%s", (uid,))

    def count_users(self):
        self._ex("SELECT COUNT(*) AS c FROM users")
        return self._row()['c']

    def create_user(self, data):
        self._ex(
            "INSERT INTO users (username, password_hash, full_name, role) VALUES (%s, %s, %s, %s)",
            (data['username'], data['password_hash'],
             data.get('full_name', ''), data.get('role', 'staff')))
        return self._mc.lastrowid

    def update_user(self, uid, data):
        if data.get('password_hash'):
            self._ex(
                "UPDATE users SET username=%s, password_hash=%s, full_name=%s, role=%s, active=%s "
                "WHERE id=%s",
                (data['username'], data['password_hash'], data.get('full_name', ''),
                 data['role'], 1 if data.get('active', True) else 0, uid))
        else:
            self._ex(
                "UPDATE users SET username=%s, full_name=%s, role=%s, active=%s WHERE id=%s",
                (data['username'], data.get('full_name', ''),
                 data['role'], 1 if data.get('active', True) else 0, uid))

    def delete_user(self, uid):
        self._ex("DELETE FROM users WHERE id=%s", (uid,))

    # ── Clients ───────────────────────────────────────────────────────────────

    def get_clients(self, search=''):
        if search:
            self._ex(
                "SELECT * FROM clients "
                "WHERE name LIKE %s OR email LIKE %s OR phone LIKE %s ORDER BY name",
                (f'%{search}%',) * 3)
        else:
            self._ex("SELECT * FROM clients ORDER BY name")
        return self._rows()

    def get_client(self, cid):
        self._ex("SELECT * FROM clients WHERE id=%s", (cid,))
        return self._row()

    def add_client(self, data):
        self._ex(
            "INSERT INTO clients (name,email,phone,address,city,state,zip,notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            (data['name'], data.get('email',''), data.get('phone',''),
             data.get('address',''), data.get('city',''), data.get('state',''),
             data.get('zip',''), data.get('notes','')))
        return self._mc.lastrowid

    def update_client(self, cid, data):
        self._ex(
            "UPDATE clients SET name=%s,email=%s,phone=%s,address=%s,"
            "city=%s,state=%s,zip=%s,notes=%s WHERE id=%s",
            (data['name'], data.get('email',''), data.get('phone',''),
             data.get('address',''), data.get('city',''), data.get('state',''),
             data.get('zip',''), data.get('notes',''), cid))

    def delete_client(self, cid):
        self._ex("DELETE FROM clients WHERE id=%s", (cid,))

    def count_client_projects(self, cid):
        self._ex("SELECT COUNT(*) AS c FROM projects WHERE client_id=%s", (cid,))
        return self._row()['c']

    # ── Projects ──────────────────────────────────────────────────────────────

    def get_projects(self, search='', status=''):
        q = ("SELECT p.*, c.name AS client_name FROM projects p "
             "LEFT JOIN clients c ON p.client_id=c.id WHERE 1=1")
        params = []
        if search:
            q += " AND (p.title LIKE %s OR c.name LIKE %s OR p.location LIKE %s)"
            params.extend([f'%{search}%'] * 3)
        if status:
            q += " AND p.status=%s"
            params.append(status)
        q += " ORDER BY p.date DESC, p.id DESC"
        self._ex(q, params)
        return self._rows()

    def get_project(self, pid):
        self._ex(
            "SELECT p.*, c.name AS client_name FROM projects p "
            "LEFT JOIN clients c ON p.client_id=c.id WHERE p.id=%s", (pid,))
        return self._row()

    def add_project(self, data):
        self._ex(
            "INSERT INTO projects (client_id,title,type,status,`date`,start_time,end_time,"
            "location,package,rate,deposit,notes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (data.get('client_id') or None, data['title'], data.get('type','Photography'),
             data.get('status','Inquiry'), data.get('date') or None,
             data.get('start_time') or None, data.get('end_time') or None,
             data.get('location',''), data.get('package',''),
             data.get('rate',0), data.get('deposit',0), data.get('notes','')))
        return self._mc.lastrowid

    def update_project(self, pid, data):
        self._ex(
            "UPDATE projects SET client_id=%s,title=%s,type=%s,status=%s,`date`=%s,"
            "start_time=%s,end_time=%s,location=%s,package=%s,rate=%s,deposit=%s,notes=%s "
            "WHERE id=%s",
            (data.get('client_id') or None, data['title'], data.get('type','Photography'),
             data.get('status','Inquiry'), data.get('date') or None,
             data.get('start_time') or None, data.get('end_time') or None,
             data.get('location',''), data.get('package',''),
             data.get('rate',0), data.get('deposit',0), data.get('notes',''), pid))

    def delete_project(self, pid):
        self._ex("DELETE FROM projects WHERE id=%s", (pid,))

    def get_upcoming_projects(self, days=30):
        self._ex(
            "SELECT p.*, c.name AS client_name FROM projects p "
            "LEFT JOIN clients c ON p.client_id=c.id "
            "WHERE p.date >= CURDATE() "
            "AND p.date <= DATE_ADD(CURDATE(), INTERVAL %s DAY) "
            "AND p.status NOT IN ('Cancelled','Completed') ORDER BY p.date ASC", (days,))
        return self._rows()

    def count_active_projects_by_year(self, year):
        self._ex(
            "SELECT COUNT(*) AS c FROM projects "
            "WHERE YEAR(`date`)=%s AND status!='Cancelled'", (year,))
        return self._row()['c']

    # ── Invoices ──────────────────────────────────────────────────────────────

    def next_invoice_number(self):
        prefix = self.get_setting('invoice_prefix', 'INV')
        self._ex("SELECT COUNT(*) AS cnt FROM invoices")
        cnt = self._row()['cnt']
        return f"{prefix}-{str(cnt + 1).zfill(4)}"

    def get_invoices(self, search='', status=''):
        q = ("SELECT i.*, c.name AS client_name, p.title AS project_title "
             "FROM invoices i LEFT JOIN clients c ON i.client_id=c.id "
             "LEFT JOIN projects p ON i.project_id=p.id WHERE 1=1")
        params = []
        if search:
            q += " AND (i.invoice_number LIKE %s OR c.name LIKE %s)"
            params.extend([f'%{search}%'] * 2)
        if status:
            q += " AND i.status=%s"
            params.append(status)
        q += " ORDER BY i.created_at DESC"
        self._ex(q, params)
        return self._rows()

    def get_invoice(self, iid):
        self._ex("""
            SELECT i.*, c.name AS client_name, c.email AS client_email,
                c.phone AS client_phone, c.address AS client_address,
                c.city AS client_city, c.state AS client_state, c.zip AS client_zip,
                p.title AS project_title, p.date AS project_date
            FROM invoices i
            LEFT JOIN clients c ON i.client_id=c.id
            LEFT JOIN projects p ON i.project_id=p.id
            WHERE i.id=%s""", (iid,))
        return self._row()

    def get_invoice_items(self, iid):
        self._ex("SELECT * FROM invoice_items WHERE invoice_id=%s", (iid,))
        return self._rows()

    def add_invoice(self, data, items):
        self._ex(
            "INSERT INTO invoices (invoice_number,project_id,client_id,issue_date,due_date,"
            "status,subtotal,tax_rate,tax_amount,discount,total,notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (data['invoice_number'], data.get('project_id') or None, data['client_id'],
             data.get('issue_date') or None, data.get('due_date') or None,
             data.get('status','Draft'), data.get('subtotal',0), data.get('tax_rate',0),
             data.get('tax_amount',0), data.get('discount',0), data.get('total',0),
             data.get('notes','')))
        iid = self._mc.lastrowid
        for item in items:
            self._ex(
                "INSERT INTO invoice_items (invoice_id,description,quantity,rate,amount) "
                "VALUES (%s,%s,%s,%s,%s)",
                (iid, item['description'], item.get('quantity',1),
                 item.get('rate',0), item.get('amount',0)))
        return iid

    def update_invoice(self, iid, data, items):
        self._ex(
            "UPDATE invoices SET project_id=%s,client_id=%s,issue_date=%s,due_date=%s,"
            "status=%s,subtotal=%s,tax_rate=%s,tax_amount=%s,discount=%s,total=%s,notes=%s "
            "WHERE id=%s",
            (data.get('project_id') or None, data['client_id'],
             data.get('issue_date') or None, data.get('due_date') or None,
             data.get('status','Draft'), data.get('subtotal',0), data.get('tax_rate',0),
             data.get('tax_amount',0), data.get('discount',0), data.get('total',0),
             data.get('notes',''), iid))
        self._ex("DELETE FROM invoice_items WHERE invoice_id=%s", (iid,))
        for item in items:
            self._ex(
                "INSERT INTO invoice_items (invoice_id,description,quantity,rate,amount) "
                "VALUES (%s,%s,%s,%s,%s)",
                (iid, item['description'], item.get('quantity',1),
                 item.get('rate',0), item.get('amount',0)))

    def update_invoice_status(self, iid, status):
        self._ex("UPDATE invoices SET status=%s WHERE id=%s", (status, iid))

    def delete_invoice(self, iid):
        self._ex("DELETE FROM invoice_items WHERE invoice_id=%s", (iid,))
        self._ex("DELETE FROM invoices WHERE id=%s", (iid,))

    def get_recent_invoices(self, limit=10):
        self._ex(
            "SELECT i.*, c.name AS client_name FROM invoices i "
            "LEFT JOIN clients c ON i.client_id=c.id "
            "ORDER BY i.created_at DESC LIMIT %s", (limit,))
        return self._rows()

    # ── Payments ──────────────────────────────────────────────────────────────

    def get_payments(self, iid):
        self._ex("SELECT * FROM payments WHERE invoice_id=%s ORDER BY `date` DESC", (iid,))
        return self._rows()

    def add_payment(self, data):
        self._ex(
            "INSERT INTO payments (invoice_id,amount,`date`,method,reference,notes) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (data['invoice_id'], data['amount'], data.get('date') or None,
             data.get('method',''), data.get('reference',''), data.get('notes','')))
        return self._mc.lastrowid

    def get_payments_total(self, iid):
        self._ex(
            "SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE invoice_id=%s", (iid,))
        return self._row()['t']

    # ── Expenses ──────────────────────────────────────────────────────────────

    def get_expenses(self, search='', category=''):
        q = ("SELECT e.*, p.title AS project_title FROM expenses e "
             "LEFT JOIN projects p ON e.project_id=p.id WHERE 1=1")
        params = []
        if search:
            q += " AND (e.description LIKE %s OR e.category LIKE %s)"
            params.extend([f'%{search}%'] * 2)
        if category:
            q += " AND e.category=%s"
            params.append(category)
        q += " ORDER BY e.date DESC"
        self._ex(q, params)
        return self._rows()

    def add_expense(self, data):
        self._ex(
            "INSERT INTO expenses (project_id,category,description,amount,`date`,payment_method,notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (data.get('project_id') or None, data.get('category',''),
             data.get('description',''), data.get('amount',0),
             data.get('date') or None, data.get('payment_method',''), data.get('notes','')))
        return self._mc.lastrowid

    def update_expense(self, eid, data):
        self._ex(
            "UPDATE expenses SET project_id=%s,category=%s,description=%s,"
            "amount=%s,`date`=%s,payment_method=%s,notes=%s WHERE id=%s",
            (data.get('project_id') or None, data.get('category',''),
             data.get('description',''), data.get('amount',0),
             data.get('date') or None, data.get('payment_method',''),
             data.get('notes',''), eid))

    def delete_expense(self, eid):
        self._ex("DELETE FROM expenses WHERE id=%s", (eid,))

    def get_expense_categories(self):
        self._ex(
            "SELECT DISTINCT category FROM expenses "
            "WHERE category IS NOT NULL ORDER BY category")
        return [row['category'] for row in self._rows()]

    # ── Equipment ─────────────────────────────────────────────────────────────

    def get_equipment(self, search='', category=''):
        q = "SELECT * FROM equipment WHERE 1=1"
        params = []
        if search:
            q += (" AND (name LIKE %s OR brand LIKE %s "
                  "OR model_name LIKE %s OR serial_number LIKE %s)")
            params.extend([f'%{search}%'] * 4)
        if category:
            q += " AND category=%s"
            params.append(category)
        q += " ORDER BY category, name"
        self._ex(q, params)
        return self._rows()

    def add_equipment(self, data):
        self._ex(
            "INSERT INTO equipment (name,category,brand,model_name,serial_number,"
            "purchase_date,purchase_price,`condition`,insured,insurance_value,notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (data['name'], data.get('category',''), data.get('brand',''),
             data.get('model_name',''), data.get('serial_number',''),
             data.get('purchase_date') or None, data.get('purchase_price',0),
             data.get('condition','Excellent'), 1 if data.get('insured') else 0,
             data.get('insurance_value',0), data.get('notes','')))
        return self._mc.lastrowid

    def update_equipment(self, eid, data):
        self._ex(
            "UPDATE equipment SET name=%s,category=%s,brand=%s,model_name=%s,"
            "serial_number=%s,purchase_date=%s,purchase_price=%s,`condition`=%s,"
            "insured=%s,insurance_value=%s,notes=%s WHERE id=%s",
            (data['name'], data.get('category',''), data.get('brand',''),
             data.get('model_name',''), data.get('serial_number',''),
             data.get('purchase_date') or None, data.get('purchase_price',0),
             data.get('condition','Excellent'), 1 if data.get('insured') else 0,
             data.get('insurance_value',0), data.get('notes',''), eid))

    def delete_equipment(self, eid):
        self._ex("DELETE FROM equipment WHERE id=%s", (eid,))

    def get_equipment_categories(self):
        self._ex(
            "SELECT DISTINCT category FROM equipment "
            "WHERE category IS NOT NULL ORDER BY category")
        return [row['category'] for row in self._rows()]

    # ── Tasks ─────────────────────────────────────────────────────────────────

    def get_tasks(self, search=''):
        q = "SELECT * FROM tasks WHERE 1=1"
        params = []
        if search:
            q += " AND (title LIKE %s OR assignee LIKE %s OR group_name LIKE %s)"
            params.extend([f'%{search}%'] * 3)
        q += " ORDER BY group_name, position, id"
        self._ex(q, params)
        return self._rows()

    def get_task(self, tid):
        self._ex("SELECT * FROM tasks WHERE id=%s", (tid,))
        return self._row()

    def get_task_groups(self):
        self._ex(
            "SELECT DISTINCT group_name FROM tasks "
            "WHERE group_name IS NOT NULL ORDER BY group_name")
        return [row['group_name'] for row in self._rows()]

    def add_task(self, data):
        self._ex(
            "INSERT INTO tasks (title,group_name,status,priority,assignee,due_date,notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (data['title'], data.get('group_name', 'General') or 'General',
             data.get('status', 'Not Started'), data.get('priority', 'Medium'),
             data.get('assignee', ''), data.get('due_date') or None, data.get('notes', '')))
        return self._mc.lastrowid

    def update_task(self, tid, data):
        self._ex(
            "UPDATE tasks SET title=%s,group_name=%s,status=%s,priority=%s,"
            "assignee=%s,due_date=%s,notes=%s WHERE id=%s",
            (data['title'], data.get('group_name', 'General') or 'General',
             data.get('status', 'Not Started'), data.get('priority', 'Medium'),
             data.get('assignee', ''), data.get('due_date') or None,
             data.get('notes', ''), tid))

    def update_task_status(self, tid, status):
        self._ex("UPDATE tasks SET status=%s WHERE id=%s", (status, tid))

    def update_task_priority(self, tid, priority):
        self._ex("UPDATE tasks SET priority=%s WHERE id=%s", (priority, tid))

    def reorder_tasks(self, items):
        for it in items:
            self._ex(
                "UPDATE tasks SET group_name=%s, position=%s WHERE id=%s",
                (it['group_name'], it['position'], it['id']))

    def get_task_status_counts(self):
        self._ex("SELECT status, COUNT(*) AS c FROM tasks GROUP BY status")
        return {r['status']: r['c'] for r in self._rows()}

    def get_tasks_due_soon(self, days=7, limit=8):
        self._ex(
            "SELECT * FROM tasks WHERE due_date IS NOT NULL AND status!='Done' "
            "AND due_date <= DATE_ADD(CURDATE(), INTERVAL %s DAY) "
            "ORDER BY due_date ASC LIMIT %s", (days, limit))
        return self._rows()

    def delete_task(self, tid):
        self._ex("DELETE FROM tasks WHERE id=%s", (tid,))

    # ── Reports & Dashboard ───────────────────────────────────────────────────

    def get_dashboard_stats(self):
        s = {}
        self._ex(
            "SELECT COALESCE(SUM(total),0) AS v FROM invoices "
            "WHERE status='Paid' AND MONTH(issue_date)=MONTH(CURDATE()) "
            "AND YEAR(issue_date)=YEAR(CURDATE())")
        s['month_revenue'] = self._row()['v']

        self._ex(
            "SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS v "
            "FROM invoices WHERE status IN ('Sent','Overdue')")
        r = self._row()
        s['outstanding_count'] = r['c']
        s['outstanding_total'] = r['v']

        self._ex(
            "SELECT COALESCE(SUM(amount),0) AS v FROM expenses "
            "WHERE MONTH(`date`)=MONTH(CURDATE()) AND YEAR(`date`)=YEAR(CURDATE())")
        s['month_expenses'] = self._row()['v']

        self._ex("SELECT COUNT(*) AS c FROM clients")
        s['total_clients'] = self._row()['c']

        self._ex(
            "SELECT COUNT(*) AS c FROM projects "
            "WHERE YEAR(`date`)=YEAR(CURDATE()) AND status!='Cancelled'")
        s['year_projects'] = self._row()['c']

        self._ex(
            "SELECT COUNT(*) AS c FROM projects "
            "WHERE `date` >= CURDATE() "
            "AND `date` <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) "
            "AND status NOT IN ('Cancelled','Completed')")
        s['upcoming_7days'] = self._row()['c']

        self._ex(
            "SELECT COALESCE(SUM(total),0) AS v FROM invoices "
            "WHERE status='Paid' AND YEAR(issue_date)=YEAR(CURDATE())")
        s['year_revenue'] = self._row()['v']
        return s

    def get_monthly_revenue(self, year):
        self._ex(
            "SELECT DATE_FORMAT(issue_date,'%%m') AS month, SUM(total) AS revenue "
            "FROM invoices WHERE YEAR(issue_date)=%s AND status='Paid' GROUP BY month",
            (year,))
        return self._rows()

    def get_monthly_expenses(self, year):
        self._ex(
            "SELECT DATE_FORMAT(`date`,'%%m') AS month, SUM(amount) AS total "
            "FROM expenses WHERE YEAR(`date`)=%s GROUP BY month", (year,))
        return self._rows()

    def get_expense_by_category(self, year=None):
        q = "SELECT category, SUM(amount) AS total FROM expenses"
        params = []
        if year:
            q += " WHERE YEAR(`date`)=%s"
            params.append(year)
        q += " GROUP BY category ORDER BY total DESC"
        self._ex(q, params)
        return self._rows()

    # ── Activity log ──────────────────────────────────────────────────────────

    def log_activity(self, username, action, entity_type, entity_id, label):
        self._ex(
            "INSERT INTO activity_log (username, action, entity_type, entity_id, label) "
            "VALUES (%s,%s,%s,%s,%s)",
            (username, action, entity_type, entity_id, label))

    def get_activity_log(self, limit=100):
        self._ex(
            "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT %s", (limit,))
        return self._rows()

    def close(self):
        if self._mysql:
            try:
                self._mysql.close()
            except Exception:
                pass
