from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import Database
from deps import get_db

router = APIRouter()


class ClientBody(BaseModel):
    name: str
    email: str = ''
    phone: str = ''
    address: str = ''
    city: str = ''
    state: str = ''
    zip: str = ''
    notes: str = ''


@router.get("/")
def list_clients(search: str = '', db: Database = Depends(get_db)):
    rows = db.get_clients(search=search)
    for r in rows:
        r['project_count'] = db.count_client_projects(r['id'])
    return rows


@router.get("/{cid}")
def get_client(cid: int, db: Database = Depends(get_db)):
    c = db.get_client(cid)
    if not c:
        raise HTTPException(404, "Client not found")
    c['project_count'] = db.count_client_projects(cid)
    return c


@router.post("/")
def create_client(body: ClientBody, db: Database = Depends(get_db)):
    cid = db.add_client(body.model_dump())
    return {"id": cid}


@router.put("/{cid}")
def update_client(cid: int, body: ClientBody, db: Database = Depends(get_db)):
    db.update_client(cid, body.model_dump())
    return {"ok": True}


@router.delete("/{cid}")
def delete_client(cid: int, db: Database = Depends(get_db)):
    db.delete_client(cid)
    return {"ok": True}
