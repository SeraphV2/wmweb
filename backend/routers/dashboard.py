from fastapi import APIRouter, Depends
from database import Database
from deps import get_db

router = APIRouter()


@router.get("/stats")
def stats(db: Database = Depends(get_db)):
    return db.get_dashboard_stats()


@router.get("/upcoming")
def upcoming(db: Database = Depends(get_db)):
    return db.get_upcoming_projects(days=30)


@router.get("/recent-invoices")
def recent_invoices(db: Database = Depends(get_db)):
    return db.get_recent_invoices(limit=5)
