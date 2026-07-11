from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import Database
from deps import get_db

router = APIRouter()


class ProjectBody(BaseModel):
    client_id: Optional[int] = None
    title: str
    type: str = 'Photography'
    status: str = 'Inquiry'
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: str = ''
    package: str = ''
    rate: float = 0
    deposit: float = 0
    notes: str = ''


@router.get("/")
def list_projects(search: str = '', status: str = '', db: Database = Depends(get_db)):
    return db.get_projects(search=search, status=status)


@router.get("/{pid}")
def get_project(pid: int, db: Database = Depends(get_db)):
    p = db.get_project(pid)
    if not p:
        raise HTTPException(404, "Project not found")
    return p


@router.post("/")
def create_project(body: ProjectBody, db: Database = Depends(get_db)):
    pid = db.add_project(body.model_dump())
    return {"id": pid}


@router.put("/{pid}")
def update_project(pid: int, body: ProjectBody, db: Database = Depends(get_db)):
    db.update_project(pid, body.model_dump())
    return {"ok": True}


@router.delete("/{pid}")
def delete_project(pid: int, db: Database = Depends(get_db)):
    db.delete_project(pid)
    return {"ok": True}
