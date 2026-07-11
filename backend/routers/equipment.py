from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import Database
from deps import get_db

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
    notes: str = ''


@router.get("/")
def list_equipment(search: str = '', category: str = '', db: Database = Depends(get_db)):
    return db.get_equipment(search=search, category=category)


@router.get("/categories")
def categories(db: Database = Depends(get_db)):
    return db.get_equipment_categories()


@router.post("/")
def create_equipment(body: EquipmentBody, db: Database = Depends(get_db)):
    eid = db.add_equipment(body.model_dump())
    return {"id": eid}


@router.put("/{eid}")
def update_equipment(eid: int, body: EquipmentBody, db: Database = Depends(get_db)):
    db.update_equipment(eid, body.model_dump())
    return {"ok": True}


@router.delete("/{eid}")
def delete_equipment(eid: int, db: Database = Depends(get_db)):
    db.delete_equipment(eid)
    return {"ok": True}
