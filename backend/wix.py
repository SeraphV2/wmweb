"""Wix integration: outbound Contacts sync + inbound Invoices sync.

Outbound (sync_contact): pushes clients created/edited in this app to Wix
Contacts. Disabled unless WIX_API_KEY and WIX_SITE_ID are set - in that case
every function here is a silent no-op, so the app behaves exactly as before
for anyone who hasn't configured Wix.

NOT YET TESTED against a real Wix site (no live API key was available while
building this) - the request/response shapes follow Wix's documented REST
API, but should be verified against a real account before relying on it.
Check server logs after the first sync attempt; field names or the revision
handling on update may need small adjustments. The address block is the
least certain part - name/email/phone/subdivision/postalCode/country match
Wix's documented Contacts schema, but the exact streetAddress shape was
confirmed from Wix's eCommerce/Locations APIs (which share the same address
object convention), not the Contacts API specifically.

Inbound (parse_inbound_invoice): invoices are now created in Wix (not this
app) and pushed here by Velo event handlers running on the Wix site itself
(see wix-velo/events.js) whenever an invoice is created/sent/paid/overdue.
Wix Invoices has no public REST API, so this is the only way to observe
invoice changes - the Velo code POSTs the raw event object to this app's
/api/wix/invoice endpoint, gated by WIX_BRIDGE_SECRET.
"""
import os
import requests

WIX_API_KEY = os.environ.get('WIX_API_KEY', '')
WIX_SITE_ID = os.environ.get('WIX_SITE_ID', '')
WIX_API_BASE = 'https://www.wixapis.com'

# Shared secret Wix's events.js sends with every inbound invoice webhook call.
WIX_BRIDGE_SECRET = os.environ.get('WIX_BRIDGE_SECRET', '')


def enabled():
    return bool(WIX_API_KEY and WIX_SITE_ID)


def _headers():
    return {
        'Authorization': WIX_API_KEY,
        'wix-site-id': WIX_SITE_ID,
        'Content-Type': 'application/json',
    }


def _contact_info(client):
    info = {}
    first, last = client.get('first_name', ''), client.get('last_name', '')
    if first or last:
        info['name'] = {k: v for k, v in {'first': first, 'last': last}.items() if v}
    if client.get('email'):
        info['emails'] = {'items': [{'email': client['email'], 'tag': 'MAIN'}]}
    if client.get('phone'):
        info['phones'] = {'items': [{'phone': client['phone'], 'tag': 'MAIN'}]}

    addr = {}
    if client.get('address'):
        addr['streetAddress'] = {'name': client['address']}
    if client.get('city'):
        addr['city'] = client['city']
    if client.get('state'):
        addr['subdivision'] = client['state']
    if client.get('zip'):
        addr['postalCode'] = client['zip']
    if client.get('country'):
        addr['country'] = client['country']
    if addr:
        info['addresses'] = {'items': [{'address': addr, 'tag': 'HOME'}]}

    return info


def sync_contact(client: dict):
    """Push a client (dict with name/email/phone) to Wix as a Contact.
    Creates if new, updates if a contact with that email already exists.
    Always swallows errors - this must never break client creation in
    the app itself, Wix being down or misconfigured is not our problem.
    """
    if not enabled():
        return
    info = _contact_info(client)
    if not info:
        return
    try:
        res = requests.post(
            f'{WIX_API_BASE}/contacts/v4/contacts',
            json={'info': info}, headers=_headers(), timeout=10,
        )
        if res.status_code == 200:
            return
        # Email already belongs to another contact - update that one instead.
        if client.get('email'):
            _upsert_existing(client['email'], info)
    except Exception as e:
        print(f'[wix] contact sync failed: {e}')


def _upsert_existing(email, info):
    try:
        res = requests.post(
            f'{WIX_API_BASE}/contacts/v4/contacts/query',
            json={'query': {'filter': {'info.emails.items.email': email}}},
            headers=_headers(), timeout=10,
        )
        if res.status_code != 200:
            return
        contacts = res.json().get('contacts', [])
        if not contacts:
            return
        contact = contacts[0]
        requests.patch(
            f"{WIX_API_BASE}/contacts/v4/contacts/{contact['id']}",
            json={'contact': {'info': info}, 'revision': contact.get('revision')},
            headers=_headers(), timeout=10,
        )
    except Exception as e:
        print(f'[wix] contact update failed: {e}')


# ── Inbound invoices (from the Velo events bridge - see wix-velo/events.js) ─
# Wix Invoices has no public REST API, so instead of polling, the Wix site
# itself pushes invoice events to us via Velo backend event handlers. The
# shapes below follow Wix's documented Invoice event object exactly (see
# https://dev.wix.com/docs/velo/apis/wix-billing-backend/events/on-invoice-created)
# - NOT tested against a real Wix site, since no live invoice events were
# available while building this. Check server logs (`[wix] ...`) if an
# inbound sync doesn't behave as expected.

_STATUS_MAP = {
    'Draft': 'Draft', 'Sent': 'Sent', 'Paid': 'Paid',
    'Overdue': 'Overdue', 'Void': 'Cancelled', 'Cancelled': 'Cancelled',
}


def verify_inbound_secret(secret):
    """Fail closed: with no WIX_BRIDGE_SECRET configured, nothing is accepted."""
    if not WIX_BRIDGE_SECRET:
        return False
    return secret == WIX_BRIDGE_SECRET


def _inbound_customer(customer: dict):
    addr = customer.get('address') or {}
    return {
        'contact_id': customer.get('contactId') or '',
        'email': customer.get('email') or '',
        'first_name': customer.get('firstName') or '',
        'last_name': customer.get('lastName') or '',
        'phone': customer.get('phone') or '',
        'address': addr.get('addressLine') or '',
        'city': addr.get('city') or '',
        'state': addr.get('subdivision') or '',
        'zip': addr.get('postalCode') or '',
        'country': addr.get('country') or '',
    }


def parse_inbound_invoice(event: dict):
    """Map a raw Wix Invoice event object to this app's invoice/items shape.
    Returns (invoice_data, items, customer) - does not touch the database.
    """
    customer = _inbound_customer(event.get('customer') or {})
    totals = event.get('totals') or {}
    dates = event.get('dates') or {}
    discount = event.get('discount') or {}
    taxes = event.get('taxes') or []
    tax_rate = float(taxes[0]['rate']) if taxes else 0

    invoice_data = {
        'wix_invoice_id': (event.get('id') or {}).get('id') or '',
        'invoice_number': event.get('number') or event.get('title') or '',
        'issue_date': (dates.get('issueDate') or '')[:10] or None,
        'due_date': (dates.get('dueDate') or '')[:10] or None,
        'status': _STATUS_MAP.get(event.get('status'), 'Draft'),
        'subtotal': float(totals.get('subtotal') or 0),
        'tax_rate': tax_rate,
        'tax_amount': float(totals.get('taxedAmount') or 0),
        'discount': float(discount.get('value') or 0) if discount.get('type') == 'Fixed' else 0,
        'total': float(totals.get('total') or 0),
        'notes': (event.get('metadata') or {}).get('notes') or '',
    }
    items = [{
        'description': it.get('description') or it.get('name') or '',
        'quantity': float(it.get('quantity') or 1),
        'rate': float(it.get('price') or 0),
        'amount': float(it.get('quantity') or 1) * float(it.get('price') or 0),
    } for it in (event.get('lineItems') or [])]

    return invoice_data, items, customer
