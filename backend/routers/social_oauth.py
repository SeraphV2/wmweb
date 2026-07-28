"""OAuth callback endpoints hit by a direct browser redirect from Meta /
LinkedIn after the user approves the connection - so, unlike the rest of
routers/social.py, these can't carry this app's own Authorization header and
are mounted without the auth_dep in main.py. CSRF protection comes from the
one-time `state` value minted by /api/social/connect/{platform} instead.
"""
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from database import Database
import social

router = APIRouter()


def _redirect(path):
    base = social.FRONTEND_URL or ''
    return RedirectResponse(f"{base}{path}")


@router.get("/callback/meta")
def meta_callback(request: Request):
    code = request.query_params.get('code')
    state = request.query_params.get('state')
    error = request.query_params.get('error_description') or request.query_params.get('error')

    if error:
        return _redirect(f"/social?error={error}")
    if not code or not state or not social.consume_state(state):
        return _redirect("/social?error=Invalid or expired connection attempt")

    db = Database()
    try:
        user_token, _ = social.meta_exchange_code(code)
        pages = social.meta_list_pages(user_token)
        if not pages:
            return _redirect("/social?error=No Facebook Pages found for that account")

        connected = []
        for page in pages:
            db.upsert_social_account('facebook', page['name'], page['id'], page['access_token'], None, 'oauth')
            connected.append('facebook')
            ig = page.get('instagram_business_account')
            if ig:
                db.upsert_social_account('instagram', ig.get('username', page['name']), ig['id'], page['access_token'], None, 'oauth')
                connected.append('instagram')
        return _redirect(f"/social?connected={','.join(connected)}")
    except Exception as e:
        return _redirect(f"/social?error={e}")
    finally:
        db.close()


@router.get("/callback/linkedin")
def linkedin_callback(request: Request):
    code = request.query_params.get('code')
    state = request.query_params.get('state')
    error = request.query_params.get('error_description') or request.query_params.get('error')

    if error:
        return _redirect(f"/social?error={error}")
    if not code or not state or not social.consume_state(state):
        return _redirect("/social?error=Invalid or expired connection attempt")

    db = Database()
    try:
        token, expires_in = social.linkedin_exchange_code(code)
        urn, name = social.linkedin_get_profile(token)
        db.upsert_social_account('linkedin', name, urn, token, social.token_expiry(expires_in), 'oauth')
        return _redirect("/social?connected=linkedin")
    except Exception as e:
        return _redirect(f"/social?error={e}")
    finally:
        db.close()
