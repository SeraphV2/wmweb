import os
import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError

SECRET = os.environ.get("JWT_SECRET", "waffle-dev-secret-change-in-production")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "waffle2024")
ALGORITHM = "HS256"
EXPIRE_HOURS = 48
MIN_PASSWORD_LENGTH = 8

# Break-glass recovery for an admin locked out of their own account. Unset by
# default, which leaves /api/auth/recover completely inert - set it on the
# service only for as long as it takes to reset the password, then remove it.
RECOVERY_SECRET = os.environ.get("RECOVERY_SECRET", "")
MIN_RECOVERY_SECRET_LENGTH = 16


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(username: str, role: str = "staff") -> str:
    exp = datetime.utcnow() + timedelta(hours=EXPIRE_HOURS)
    return jwt.encode({"sub": username, "role": role, "exp": exp}, SECRET, algorithm=ALGORITHM)


def verify_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            return None
        return {"username": username, "role": payload.get("role", "staff")}
    except JWTError:
        return None
