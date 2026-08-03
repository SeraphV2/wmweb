from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import Database
from deps import get_db, get_current_user, require_admin
from auth import hash_password, verify_password, MIN_PASSWORD_LENGTH
import totp as totp_lib

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


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class TotpCode(BaseModel):
    code: str


class TotpDisable(BaseModel):
    password: str


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


@router.patch("/me/password")
def change_my_password(
    body: PasswordChange,
    current: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    user = db.get_user_by_username(current['username'])
    if not user:
        raise HTTPException(404, "User not found")
    if not verify_password(body.current_password, user['password_hash']):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new_password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(400, f"New password must be at least {MIN_PASSWORD_LENGTH} characters")
    db.update_user_password(user['id'], hash_password(body.new_password))
    db.log_activity(current['username'], 'changed password for', 'user', user['id'], current['username'])
    return {"ok": True}


def _me(db, current):
    user = db.get_user_by_username(current['username'])
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.get("/me/totp")
def totp_status(current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return {"enabled": bool(_me(db, current).get('totp_enabled'))}


@router.post("/me/totp/setup")
def totp_setup(current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    """Mint a secret and hand back the QR to scan. Stored but left disabled -
    it only counts once /enable confirms the user can produce a code from it,
    so a half-finished setup can never lock anyone out."""
    user = _me(db, current)
    secret = totp_lib.new_secret()
    db.set_user_totp(user['id'], secret, enabled=False)
    uri = totp_lib.provisioning_uri(secret, user['username'])
    return {"secret": secret, "uri": uri, "qr_svg": totp_lib.qr_svg(uri)}


@router.post("/me/totp/enable")
def totp_enable(body: TotpCode, current: dict = Depends(get_current_user),
                db: Database = Depends(get_db)):
    user = _me(db, current)
    if not user.get('totp_secret'):
        raise HTTPException(400, "Start setup first")
    step = totp_lib.verify(user['totp_secret'], body.code, user.get('totp_last_step') or 0)
    if step is None:
        raise HTTPException(400, "That code isn't right - check your authenticator app and try again")
    db.set_user_totp(user['id'], user['totp_secret'], enabled=True)
    db.set_user_totp_step(user['id'], step)
    db.log_activity(current['username'], 'enabled 2FA for', 'user', user['id'], current['username'])
    return {"ok": True}


@router.post("/me/totp/disable")
def totp_disable(body: TotpDisable, current: dict = Depends(get_current_user),
                 db: Database = Depends(get_db)):
    user = _me(db, current)
    # Password required: otherwise a borrowed logged-in session could strip the
    # only recovery factor off the account.
    if not verify_password(body.password, user['password_hash']):
        raise HTTPException(400, "Password is incorrect")
    db.clear_user_totp(user['id'])
    db.log_activity(current['username'], 'disabled 2FA for', 'user', user['id'], current['username'])
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
