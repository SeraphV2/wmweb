from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import Database
from deps import get_db, get_current_user, require_admin
from auth import hash_password

router = APIRouter()

ROLES = ["admin", "staff", "viewer"]


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str = ''
    role: str = 'staff'


class UserUpdate(BaseModel):
    username: str
    password: str = ''
    full_name: str = ''
    role: str = 'staff'
    active: bool = True


class ThemeBody(BaseModel):
    theme: str


@router.get("/")
def list_users(
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return db.get_users()


@router.get("/assignable")
def assignable_users(
    _user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    return [
        {'id': u['id'], 'name': u['full_name'] or u['username']}
        for u in db.get_users() if u['active']
    ]


@router.patch("/me/theme")
def update_my_theme(
    body: ThemeBody,
    current: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    if body.theme not in ("light", "dark"):
        raise HTTPException(400, "Theme must be 'light' or 'dark'")
    user = db.get_user_by_username(current['username'])
    if not user:
        raise HTTPException(404, "User not found")
    db.update_user_theme(user['id'], body.theme)
    return {"ok": True}


@router.post("/")
def create_user(
    body: UserCreate,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    if body.role not in ROLES:
        raise HTTPException(400, f"Role must be one of {ROLES}")
    if db.get_user_by_username(body.username):
        raise HTTPException(400, "Username already taken")
    uid = db.create_user({
        'username': body.username,
        'password_hash': hash_password(body.password),
        'full_name': body.full_name,
        'role': body.role,
    })
    db.log_activity(_admin['username'], 'created', 'user', uid, body.username)
    return {"id": uid}


@router.put("/{uid}")
def update_user(
    uid: int,
    body: UserUpdate,
    current: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    if body.role not in ROLES:
        raise HTTPException(400, f"Role must be one of {ROLES}")
    data = {
        'username': body.username,
        'full_name': body.full_name,
        'role': body.role,
        'active': body.active,
        'password_hash': hash_password(body.password) if body.password else '',
    }
    db.update_user(uid, data)
    db.log_activity(current['username'], 'updated', 'user', uid, body.username)
    return {"ok": True}


@router.delete("/{uid}")
def delete_user(
    uid: int,
    current: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    users = db.get_users()
    admins = [u for u in users if u['role'] == 'admin' and u['active']]
    target = next((u for u in users if u['id'] == uid), None)
    if not target:
        raise HTTPException(404, "User not found")
    if target['role'] == 'admin' and len(admins) <= 1:
        raise HTTPException(400, "Cannot delete the only admin account")
    db.delete_user(uid)
    db.log_activity(current['username'], 'deleted', 'user', uid, target['username'])
    return {"ok": True}
