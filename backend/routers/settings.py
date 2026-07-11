from fastapi import APIRouter, Depends
from database import Database
from deps import get_db

router = APIRouter()


@router.get("/")
def get_settings(db: Database = Depends(get_db)):
    return db.get_all_settings()


@router.put("/")
def update_settings(data: dict, db: Database = Depends(get_db)):
    db.update_settings(data)
    return {"ok": True}
