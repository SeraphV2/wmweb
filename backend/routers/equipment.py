from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import Database
from deps import get_db, get_current_user

router = APIRouter()


class EquipmentBody(BaseModel):
    name: str
    category: str = ''
    brand: str = ''
    model_name: str = ''
    serial_number: str = ''
    purchase_date: Optional[str] = None
    purchase_price: float = 0
    condition: str = 'Excellent'
    insured: bool = False
    insurance_value: float = 0
    financed: bool = False
    finance_amount: float = 0
    notes: str = ''


class PaymentBody(BaseModel):
    amount: float
    date: Optional[str] = None
    method: str = ''
    reference: str = ''
    notes: str = ''


@router.get("/")
def list_equipment(search: str = '', category: str = '', db: Database = Depends(get_db)):
    return db.get_equipment(search=search, category=category)


@router.get("/categories")
def categories(db: Database = Depends(get_db)):
    return db.get_equipment_categories()


@router.get("/brands")
def brands(db: Database = Depends(get_db)):
    return db.get_equipment_brands()


@router.get("/models")
def models(db: Database = Depends(get_db)):
    return db.get_equipment_models()


@router.get("/{eid}")
def get_equipment_item(eid: int, db: Database = Depends(get_db)):
    item = db.get_equipment_item(eid)
    if not item:
        raise HTTPException(404, "Equipment not found")
    item['payments'] = db.get_equipment_payments(eid)
    item['paid_total'] = db.get_equipment_payments_total(eid)
    return item


@router.post("/")
def create_equipment(body: EquipmentBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    eid = db.add_equipment(body.model_dump())
    db.log_activity(current['username'], 'created', 'equipment', eid, body.name)
    return {"id": eid}


@router.put("/{eid}")
def update_equipment(eid: int, body: EquipmentBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    db.update_equipment(eid, body.model_dump())
    db.log_activity(current['username'], 'updated', 'equipment', eid, body.name)
    return {"ok": True}


@router.delete("/{eid}")
def delete_equipment(eid: int, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    db.delete_equipment(eid)
    db.log_activity(current['username'], 'deleted', 'equipment', eid, f'#{eid}')
    return {"ok": True}


@router.post("/{eid}/payments")
def add_payment(eid: int, body: PaymentBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    data = body.model_dump()
    data['equipment_id'] = eid
    pid = db.add_equipment_payment(data)
    item = db.get_equipment_item(eid)
    label = f"Payment recorded on {item['name']}" if item else f'Payment recorded on #{eid}'
    db.log_activity(current['username'], 'updated', 'equipment', eid, label)
    return {"id": pid}
