import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles

from auth import create_token, ADMIN_PASSWORD, hash_password, verify_password
from deps import get_db, get_current_user
from database import Database

from routers import clients, projects, invoices, expenses, equipment, dashboard, reports, settings, tasks, activity, admin
from routers import users as users_router
from routers import wix_inbound
from routers import social, social_oauth


@asynccontextmanager
async def lifespan(app):
    db = Database()
    try:
        if db.count_users() == 0:
            db.create_user({
                'username': 'admin',
                'password_hash': hash_password(ADMIN_PASSWORD),
                'full_name': 'Administrator',
                'role': 'admin',
            })
    finally:
        db.close()
    yield


app = FastAPI(title="Waffle Media API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

auth_dep = [Depends(get_current_user)]


@app.post("/api/auth/token")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Database = Depends(get_db)):
    user = db.get_user_by_username(form.username)
    if not user or not verify_password(form.password, user['password_hash']):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    db.record_login(user['id'])
    return {
        "access_token": create_token(user['username'], user['role']),
        "token_type": "bearer",
        "role": user['role'],
        "full_name": user['full_name'] or user['username'],
        "theme": user.get('theme') or 'light',
    }


@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return user


app.include_router(dashboard.router,      prefix="/api/dashboard",  dependencies=auth_dep)
app.include_router(clients.router,        prefix="/api/clients",    dependencies=auth_dep)
app.include_router(projects.router,       prefix="/api/projects",   dependencies=auth_dep)
app.include_router(invoices.router,       prefix="/api/invoices",   dependencies=auth_dep)
app.include_router(expenses.router,       prefix="/api/expenses",   dependencies=auth_dep)
app.include_router(equipment.router,      prefix="/api/equipment",  dependencies=auth_dep)
app.include_router(tasks.router,          prefix="/api/tasks",      dependencies=auth_dep)
app.include_router(reports.router,        prefix="/api/reports",    dependencies=auth_dep)
app.include_router(settings.router,       prefix="/api/settings",   dependencies=auth_dep)
app.include_router(users_router.router,   prefix="/api/users",      dependencies=auth_dep)
app.include_router(activity.router,       prefix="/api/activity",   dependencies=auth_dep)
app.include_router(admin.router,          prefix="/api/admin",      dependencies=auth_dep)
app.include_router(social.router,         prefix="/api/social",     dependencies=auth_dep)

# No auth_dep - this is called server-to-server by Wix (Velo), not by a
# logged-in user. Protected by a shared secret checked inside the handler.
app.include_router(wix_inbound.router,    prefix="/api/wix")

# No auth_dep - these are hit by a direct browser redirect from Meta/LinkedIn
# after OAuth consent, so no Authorization header is present. Protected by
# the one-time `state` value instead (see routers/social_oauth.py).
app.include_router(social_oauth.router,   prefix="/api/social")


@app.get("/api/health")
def health():
    return {"status": "ok"}
