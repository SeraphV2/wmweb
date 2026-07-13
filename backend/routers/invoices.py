from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import Database
from deps import get_db, get_current_user

router = APIRouter()


class InvoiceItem(BaseModel):
    description: str = ''
    quantity: float = 1
    rate: float = 0
    amount: float = 0


class InvoiceBody(BaseModel):
    invoice_number: str = ''
    project_id: Optional[int] = None
    client_id: int
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    status: str = 'Draft'
    subtotal: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    discount: float = 0
    total: float = 0
    notes: str = ''
    items: List[InvoiceItem] = []


class StatusBody(BaseModel):
    status: str


class PaymentBody(BaseModel):
    invoice_id: int
    amount: float
    date: Optional[str] = None
    method: str = ''
    reference: str = ''
    notes: str = ''


@router.get("/next-number")
def next_number(db: Database = Depends(get_db)):
    return {"number": db.next_invoice_number()}


@router.get("/")
def list_invoices(search: str = '', status: str = '', db: Database = Depends(get_db)):
    return db.get_invoices(search=search, status=status)


@router.get("/{iid}")
def get_invoice(iid: int, db: Database = Depends(get_db)):
    inv = db.get_invoice(iid)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    inv['items'] = db.get_invoice_items(iid)
    inv['payments'] = db.get_payments(iid)
    inv['paid_total'] = db.get_payments_total(iid)
    return inv


@router.post("/")
def create_invoice(body: InvoiceBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    data = body.model_dump()
    items = data.pop('items')
    if not data['invoice_number']:
        data['invoice_number'] = db.next_invoice_number()
    iid = db.add_invoice(data, items)
    db.log_activity(current['username'], 'created', 'invoice', iid, data['invoice_number'])
    return {"id": iid}


@router.put("/{iid}")
def update_invoice(iid: int, body: InvoiceBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    data = body.model_dump()
    items = data.pop('items')
    db.update_invoice(iid, data, items)
    db.log_activity(current['username'], 'updated', 'invoice', iid, data.get('invoice_number') or f'#{iid}')
    return {"ok": True}


@router.patch("/{iid}/status")
def update_status(iid: int, body: StatusBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    db.update_invoice_status(iid, body.status)
    inv = db.get_invoice(iid)
    label = f"{inv['invoice_number']} marked {body.status}" if inv else f'#{iid} marked {body.status}'
    db.log_activity(current['username'], 'updated', 'invoice', iid, label)
    return {"ok": True}


@router.delete("/{iid}")
def delete_invoice(iid: int, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    existing = db.get_invoice(iid)
    db.delete_invoice(iid)
    db.log_activity(current['username'], 'deleted', 'invoice', iid, existing['invoice_number'] if existing else f'#{iid}')
    return {"ok": True}


@router.post("/{iid}/payments")
def add_payment(iid: int, body: PaymentBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    pid = db.add_payment(body.model_dump())
    paid = db.get_payments_total(iid)
    inv = db.get_invoice(iid)
    if inv and paid >= inv['total']:
        db.update_invoice_status(iid, 'Paid')
    label = f"Payment recorded on {inv['invoice_number']}" if inv else f'Payment recorded on #{iid}'
    db.log_activity(current['username'], 'updated', 'invoice', iid, label)
    return {"id": pid}
