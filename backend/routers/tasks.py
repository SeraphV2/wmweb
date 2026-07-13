from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import Database
from deps import get_db, get_current_user

router = APIRouter()

STATUSES = ['Not Started', 'Working On It', 'Stuck', 'Done']
PRIORITIES = ['Low', 'Medium', 'High', 'Critical']


class TaskBody(BaseModel):
    title: str
    group_name: str = 'General'
    status: str = 'Not Started'
    priority: str = 'Medium'
    assignee: str = ''
    due_date: Optional[str] = None
    notes: str = ''


class StatusBody(BaseModel):
    status: str


class PriorityBody(BaseModel):
    priority: str


class ReorderItem(BaseModel):
    id: int
    group_name: str
    position: int


class ReorderBody(BaseModel):
    items: List[ReorderItem]


@router.get("/")
def list_tasks(search: str = '', db: Database = Depends(get_db)):
    return db.get_tasks(search=search)


@router.get("/groups")
def groups(db: Database = Depends(get_db)):
    return db.get_task_groups()


@router.post("/")
def create_task(body: TaskBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    tid = db.add_task(body.model_dump())
    db.log_activity(current['username'], 'created', 'task', tid, body.title)
    return {"id": tid}


@router.put("/{tid}")
def update_task(tid: int, body: TaskBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    db.update_task(tid, body.model_dump())
    db.log_activity(current['username'], 'updated', 'task', tid, body.title)
    return {"ok": True}


@router.patch("/reorder")
def reorder(body: ReorderBody, db: Database = Depends(get_db)):
    db.reorder_tasks([i.model_dump() for i in body.items])
    return {"ok": True}


@router.patch("/{tid}/status")
def update_status(tid: int, body: StatusBody, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    if body.status not in STATUSES:
        raise HTTPException(400, f"Status must be one of {STATUSES}")
    db.update_task_status(tid, body.status)
    task = db.get_task(tid)
    label = f"{task['title']} moved to {body.status}" if task else f'#{tid} moved to {body.status}'
    db.log_activity(current['username'], 'updated', 'task', tid, label)
    return {"ok": True}


@router.patch("/{tid}/priority")
def update_priority(tid: int, body: PriorityBody, db: Database = Depends(get_db)):
    if body.priority not in PRIORITIES:
        raise HTTPException(400, f"Priority must be one of {PRIORITIES}")
    db.update_task_priority(tid, body.priority)
    return {"ok": True}


@router.delete("/{tid}")
def delete_task(tid: int, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    existing = db.get_task(tid)
    db.delete_task(tid)
    db.log_activity(current['username'], 'deleted', 'task', tid, existing['title'] if existing else f'#{tid}')
    return {"ok": True}
