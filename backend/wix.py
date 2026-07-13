"""Best-effort sync of clients to Wix Contacts.

Disabled unless WIX_API_KEY and WIX_SITE_ID are set - in that case every
function here is a silent no-op, so the app behaves exactly as before for
anyone who hasn't configured Wix.

NOT YET TESTED against a real Wix site (no live API key was available while
building this) - the request/response shapes follow Wix's documented REST
API, but should be verified against a real account before relying on it.
Check server logs after the first sync attempt; field names or the revision
handling on update may need small adjustments.
"""
import os
import requests

WIX_API_KEY = os.environ.get('WIX_API_KEY', '')
WIX_SITE_ID = os.environ.get('WIX_SITE_ID', '')
WIX_API_BASE = 'https://www.wixapis.com'


def enabled():
    return bool(WIX_API_KEY and WIX_SITE_ID)


def _headers():
    return {
        'Authorization': WIX_API_KEY,
        'wix-site-id': WIX_SITE_ID,
        'Content-Type': 'application/json',
    }


def _contact_info(client):
    name = (client.get('name') or '').strip()
    first, _, last = name.partition(' ')
    info = {}
    if first or last:
        info['name'] = {k: v for k, v in {'first': first, 'last': last}.items() if v}
    if client.get('email'):
        info['emails'] = {'items': [{'email': client['email'], 'tag': 'MAIN'}]}
    if client.get('phone'):
        info['phones'] = {'items': [{'phone': client['phone'], 'tag': 'MAIN'}]}
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
