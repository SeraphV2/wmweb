from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import Database
from deps import get_db, get_current_user

router = APIRouter()


class ExpenseBody(BaseModel):
    project_id: Optional[int] = None
    category: str = ''
    description: str = ''
    amount: float = 0
    date: Optional[str] = None
    payment_method: str = ''
    notes: str = ''


@router.get("/")
def list_expenses(search: str = '', category: str = '', db: Database = Depends(get_db)):
    return db.get_expenses(search=search, category=category)


@router.get("/categories")
def categories(db: Database = Depends(get_db)):
    return db.get_expense_categories()


@router.post("/")
def create_expense(body: ExpenseBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    eid = db.add_expense(body.model_dump())
    db.log_activity(current['username'], 'created', 'expense', eid, body.description or body.category or 'Expense')
    return {"id": eid}


@router.put("/{eid}")
def update_expense(eid: int, body: ExpenseBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    db.update_expense(eid, body.model_dump())
    db.log_activity(current['username'], 'updated', 'expense', eid, body.description or body.category or 'Expense')
    return {"ok": True}


@router.delete("/{eid}")
def delete_expense(eid: int, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    db.delete_expense(eid)
    db.log_activity(current['username'], 'deleted', 'expense', eid, f'#{eid}')
    return {"ok": True}
