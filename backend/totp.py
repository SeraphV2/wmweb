"""TOTP enrollment and verification, used both as a second factor for
password reset from the login screen and (via Settings) for enrollment.

The reset endpoint this backs is unauthenticated by necessity - the whole
point is that the user can't log in - so the two protections that actually
matter live here rather than in the route:

  * replay: a 6-digit code stays valid for its whole 30s step (plus the drift
    window), which is long enough to reuse. Every accepted code records its
    time step, and anything at or below the last accepted step is rejected.
  * brute force: 6 digits is a million combinations, but with the drift window
    a single guess covers 3 steps, and an unthrottled attacker gets unlimited
    tries. Attempts are capped per username and per client address.

The attempt counters are per-process and in memory, matching the approach in
social.py. That's adequate here (one Render instance, a handful of users) but
would need Redis or a table if this ever runs more than one worker.
"""
import io
import time

import pyotp
import qrcode
import qrcode.image.svg

ISSUER = 'Waffle Media'
CODE_STEP = 30
# Accept the neighbouring step in each direction, so a phone clock that has
# drifted by up to 30s still works. Widening this multiplies the number of
# codes a single guess covers, so it should stay at 1.
VALID_WINDOW = 1

MAX_ATTEMPTS = 5
ATTEMPT_WINDOW = 900  # 15 minutes

_attempts = {}


def _prune(now):
    for key, hits in list(_attempts.items()):
        alive = [t for t in hits if now - t < ATTEMPT_WINDOW]
        if alive:
            _attempts[key] = alive
        else:
            del _attempts[key]


def throttled(*keys):
    """True if any of the supplied keys (username, client address) has spent
    its attempts. Call before verifying, and record_attempt() after a failure."""
    now = time.time()
    _prune(now)
    return any(len(_attempts.get(k, [])) >= MAX_ATTEMPTS for k in keys if k)


def record_attempt(*keys):
    now = time.time()
    for k in keys:
        if k:
            _attempts.setdefault(k, []).append(now)


def clear_attempts(*keys):
    for k in keys:
        _attempts.pop(k, None)


def new_secret():
    return pyotp.random_base32()


def provisioning_uri(secret, username):
    return pyotp.totp.TOTP(secret).provisioning_uri(name=username, issuer_name=ISSUER)


def qr_svg(uri):
    """QR as an inline SVG string. SVG avoids the Pillow dependency a PNG
    would pull in, and keeps the payload renderable straight into the page."""
    img = qrcode.make(uri, image_factory=qrcode.image.svg.SvgPathImage)
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode()


def current_step():
    return int(time.time()) // CODE_STEP


def verify(secret, code, last_step=0):
    """Verify a code and return the time step it belongs to, or None.

    Rejects any step at or below last_step, which is what stops the same code
    being replayed while it is still inside its validity window.
    """
    if not secret or not code:
        return None
    code = code.strip().replace(' ', '')
    if not code.isdigit() or len(code) != 6:
        return None
    totp = pyotp.TOTP(secret)
    now = int(time.time())
    for offset in range(-VALID_WINDOW, VALID_WINDOW + 1):
        at = now + (offset * CODE_STEP)
        step = at // CODE_STEP
        if step <= last_step:
            continue
        if totp.verify(code, for_time=at):
            return step
    return None
