from fastapi import APIRouter, Depends
from database import Database
from deps import get_db, require_admin

router = APIRouter()


@router.get("/")
def list_activity(
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return db.get_activity_log(limit=100)
