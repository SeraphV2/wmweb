from datetime import datetime
from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
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


@router.get("/export-sql")
def export_sql(
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    dump = db.export_sql_dump()
    filename = f"waffle-media-backup-{datetime.utcnow().strftime('%Y%m%d')}.sql"
    return PlainTextResponse(
        dump,
        media_type="application/sql",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
