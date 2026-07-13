from fastapi import APIRouter, Depends
from database import Database
from deps import get_db, require_admin

router = APIRouter()


@router.get("/health")
def health(
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return {
        "counts": db.get_record_counts(),
        "top_active_users": db.get_top_active_users(limit=5),
    }
