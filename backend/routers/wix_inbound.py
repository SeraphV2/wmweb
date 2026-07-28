from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Dict
from database import Database
from deps import get_db
import wix

router = APIRouter()


class WixInvoiceWebhook(BaseModel):
    secret: str = ''
    invoice: Dict[str, Any] = {}


@router.post("/invoice")
def receive_invoice(body: WixInvoiceWebhook, db: Database = Depends(get_db)):
    """Called by the Velo bridge (wix-velo/events.js) whenever an invoice is
    created/sent/paid/overdue on the Wix site. Not user-authenticated - this
    is a server-to-server call from Wix, gated by a shared secret instead.
    """
    if not wix.verify_inbound_secret(body.secret):
        raise HTTPException(401, "Invalid or missing secret")
    if not body.invoice:
        raise HTTPException(400, "Missing invoice data")

    invoice_data, items, customer = wix.parse_inbound_invoice(body.invoice)
    if not invoice_data['wix_invoice_id']:
        raise HTTPException(400, "Invoice event is missing an id")

    cid = db.find_client_by_wix_contact(customer['contact_id'])
    if not cid:
        cid = db.find_client_by_email(customer['email'])
        if cid and customer['contact_id']:
            db.set_client_wix_contact_id(cid, customer['contact_id'])
    if not cid:
        cid = db.add_client({
            'first_name': customer['first_name'] or customer['email'] or 'Wix Customer',
            'last_name': customer['last_name'],
            'email': customer['email'],
            'phone': customer['phone'],
            'address': customer['address'],
            'city': customer['city'],
            'state': customer['state'],
            'zip': customer['zip'],
            'country': customer['country'],
            'wix_contact_id': customer['contact_id'],
        })

    invoice_data['client_id'] = cid
    existing_id = db.get_invoice_by_wix_id(invoice_data['wix_invoice_id'])
    if existing_id:
        db.update_invoice(existing_id, invoice_data, items)
        db.log_activity('wix-sync', 'updated', 'invoice', existing_id,
                         f"{invoice_data['invoice_number']} updated from Wix ({invoice_data['status']})")
        return {"ok": True, "id": existing_id, "action": "updated"}
    else:
        number = invoice_data['invoice_number'] or f"WIX-{invoice_data['wix_invoice_id'][:8]}"
        if db.invoice_number_taken(number):
            number = f"{number}-{invoice_data['wix_invoice_id'][:8]}"
        invoice_data['invoice_number'] = number
        new_id = db.add_invoice(invoice_data, items)
        db.log_activity('wix-sync', 'created', 'invoice', new_id,
                         f"{invoice_data['invoice_number']} imported from Wix")
        return {"ok": True, "id": new_id, "action": "created"}
