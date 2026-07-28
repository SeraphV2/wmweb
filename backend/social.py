"""Social media integration: OAuth connect + publish for Meta (Facebook &
Instagram) and LinkedIn.

Disabled per-platform unless the matching env vars are set - see enabled_*()
below. Mirrors the pattern used in wix.py.

NOT YET TESTED against real developer apps (no live credentials were
available while building this). Request/response shapes follow each
platform's documented REST API as of writing, but should be verified against
a real app before relying on it in production. To actually use this:

Meta (Facebook + Instagram), via https://developers.facebook.com:
  1. Create an app (type "Business").
  2. Add the "Facebook Login for Business" product.
  3. Request these permissions (Meta must approve most of these via App
     Review before they work for anyone other than the app's own admins/
     testers): pages_show_list, pages_read_engagement, pages_manage_posts,
     instagram_basic, instagram_content_publish.
  4. Add META_REDIRECT_URI (this backend's /api/social/callback/meta) as a
     valid OAuth redirect URI in the app's Facebook Login settings.
  5. Set env vars: META_APP_ID, META_APP_SECRET, META_REDIRECT_URI.
  6. The Instagram account must be a Business or Creator account linked to
     the Facebook Page you connect - personal IG accounts can't be posted
     to via this API.

LinkedIn, via https://www.linkedin.com/developers:
  1. Create an app, associate it with a LinkedIn Company Page you admin.
  2. Request the "Share on LinkedIn" product (w_member_social) and, for
     posting as the Company Page rather than your personal profile,
     "Community Management API" (w_organization_social) - the latter
     requires LinkedIn's approval.
  3. Add LINKEDIN_REDIRECT_URI (this backend's /api/social/callback/linkedin)
     under OAuth 2.0 settings.
  4. Set env vars: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET,
     LINKEDIN_REDIRECT_URI.

Also required for both: APP_PUBLIC_URL (this backend's own public base URL,
e.g. https://waffle-media-api.onrender.com) - Instagram's publish API fetches
the image by URL rather than accepting an upload, so uploaded post images
must be reachable from the public internet, not localhost. And FRONTEND_URL
(e.g. https://waffle-media.example.com) so the OAuth callback can bounce the
browser back to the app's Social Media page when done.
"""
import os
import secrets
import time
import requests

META_APP_ID = os.environ.get('META_APP_ID', '')
META_APP_SECRET = os.environ.get('META_APP_SECRET', '')
META_REDIRECT_URI = os.environ.get('META_REDIRECT_URI', '')
META_API_BASE = 'https://graph.facebook.com/v21.0'
META_OAUTH_BASE = 'https://www.facebook.com/v21.0/dialog/oauth'
META_SCOPES = 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish'

LINKEDIN_CLIENT_ID = os.environ.get('LINKEDIN_CLIENT_ID', '')
LINKEDIN_CLIENT_SECRET = os.environ.get('LINKEDIN_CLIENT_SECRET', '')
LINKEDIN_REDIRECT_URI = os.environ.get('LINKEDIN_REDIRECT_URI', '')
LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'
LINKEDIN_OAUTH_BASE = 'https://www.linkedin.com/oauth/v2'
LINKEDIN_SCOPES = 'openid profile w_member_social w_organization_social r_organization_admin'

APP_PUBLIC_URL = os.environ.get('APP_PUBLIC_URL', '').rstrip('/')
FRONTEND_URL = os.environ.get('FRONTEND_URL', '').rstrip('/')

# In-memory OAuth state store, valid for a single backend process/instance -
# fine for this app's scale (a handful of admins connecting accounts), but
# wouldn't survive a restart mid-flow or work behind multiple app instances.
_pending_states = {}
_STATE_TTL = 600


def new_state():
    state = secrets.token_urlsafe(24)
    _pending_states[state] = time.time()
    return state


def consume_state(state):
    ts = _pending_states.pop(state, None)
    if ts is None or time.time() - ts > _STATE_TTL:
        return False
    return True


def meta_enabled():
    return bool(META_APP_ID and META_APP_SECRET and META_REDIRECT_URI)


def linkedin_enabled():
    return bool(LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET and LINKEDIN_REDIRECT_URI)


def public_image_url(image_path):
    if not image_path or not APP_PUBLIC_URL:
        return None
    return f"{APP_PUBLIC_URL}/uploads/{image_path}"


# ── Meta (Facebook + Instagram) ──────────────────────────────────────────────

def meta_oauth_url(state):
    params = (
        f"client_id={META_APP_ID}&redirect_uri={META_REDIRECT_URI}"
        f"&state={state}&scope={META_SCOPES}&response_type=code"
    )
    return f"{META_OAUTH_BASE}?{params}"


def meta_exchange_code(code):
    """Exchange an OAuth code for a short-lived user token, then upgrade it
    to a long-lived (~60 day) token."""
    res = requests.get(f"{META_API_BASE}/oauth/access_token", params={
        'client_id': META_APP_ID,
        'client_secret': META_APP_SECRET,
        'redirect_uri': META_REDIRECT_URI,
        'code': code,
    }, timeout=15)
    res.raise_for_status()
    short_token = res.json()['access_token']

    res = requests.get(f"{META_API_BASE}/oauth/access_token", params={
        'grant_type': 'fb_exchange_token',
        'client_id': META_APP_ID,
        'client_secret': META_APP_SECRET,
        'fb_exchange_token': short_token,
    }, timeout=15)
    res.raise_for_status()
    data = res.json()
    return data['access_token'], data.get('expires_in')


def meta_list_pages(user_token):
    """Returns Pages the user manages, each with its own (long-lived) page
    access token and, if linked, the connected Instagram Business account."""
    res = requests.get(f"{META_API_BASE}/me/accounts", params={
        'access_token': user_token,
        'fields': 'id,name,access_token,instagram_business_account{id,username}',
    }, timeout=15)
    res.raise_for_status()
    return res.json().get('data', [])


def publish_facebook(page_id, page_token, message, image_url=None):
    if image_url:
        res = requests.post(f"{META_API_BASE}/{page_id}/photos", data={
            'url': image_url, 'caption': message, 'access_token': page_token,
        }, timeout=30)
    else:
        res = requests.post(f"{META_API_BASE}/{page_id}/feed", data={
            'message': message, 'access_token': page_token,
        }, timeout=30)
    res.raise_for_status()
    data = res.json()
    return data.get('post_id') or data.get('id')


def publish_instagram(ig_user_id, page_token, caption, image_url):
    if not image_url:
        raise ValueError('Instagram posts require an image')
    res = requests.post(f"{META_API_BASE}/{ig_user_id}/media", data={
        'image_url': image_url, 'caption': caption, 'access_token': page_token,
    }, timeout=30)
    res.raise_for_status()
    creation_id = res.json()['id']

    res = requests.post(f"{META_API_BASE}/{ig_user_id}/media_publish", data={
        'creation_id': creation_id, 'access_token': page_token,
    }, timeout=30)
    res.raise_for_status()
    return res.json()['id']


# ── LinkedIn ─────────────────────────────────────────────────────────────────

def linkedin_oauth_url(state):
    params = (
        f"response_type=code&client_id={LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={LINKEDIN_REDIRECT_URI}&state={state}&scope={LINKEDIN_SCOPES}"
    )
    return f"{LINKEDIN_OAUTH_BASE}/authorization?{params}"


def linkedin_exchange_code(code):
    res = requests.post(f"{LINKEDIN_OAUTH_BASE}/accessToken", data={
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': LINKEDIN_REDIRECT_URI,
        'client_id': LINKEDIN_CLIENT_ID,
        'client_secret': LINKEDIN_CLIENT_SECRET,
    }, headers={'Content-Type': 'application/x-www-form-urlencoded'}, timeout=15)
    res.raise_for_status()
    data = res.json()
    return data['access_token'], data.get('expires_in')


def linkedin_get_profile(token):
    """Returns (person_urn, display_name) for the connected LinkedIn member."""
    res = requests.get(f"{LINKEDIN_API_BASE}/userinfo",
                        headers={'Authorization': f'Bearer {token}'}, timeout=15)
    res.raise_for_status()
    data = res.json()
    return f"urn:li:person:{data['sub']}", data.get('name', '')


def publish_linkedin(author_urn, token, text, image_url=None):
    """Posts as author_urn (a person or organization URN) via the UGC Posts
    API. Image posts use LinkedIn's simplified 'article'-style share since
    downloading+re-uploading the binary via the Assets API needs an extra
    round trip this app doesn't do yet - images render as a link preview
    card rather than a native photo. Text-only posts render natively."""
    share_content = {
        'shareCommentary': {'text': text},
        'shareMediaCategory': 'ARTICLE' if image_url else 'NONE',
    }
    if image_url:
        share_content['media'] = [{
            'status': 'READY',
            'originalUrl': image_url,
        }]
    body = {
        'author': author_urn,
        'lifecycleState': 'PUBLISHED',
        'specificContent': {'com.linkedin.ugc.ShareContent': share_content},
        'visibility': {'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'},
    }
    res = requests.post(f"{LINKEDIN_API_BASE}/ugcPosts", json=body, headers={
        'Authorization': f'Bearer {token}',
        'X-Restli-Protocol-Version': '2.0.0',
    }, timeout=30)
    res.raise_for_status()
    return res.headers.get('x-restli-id') or res.json().get('id', '')


def token_expiry(expires_in):
    if not expires_in:
        return None
    import datetime as dt
    return (dt.datetime.utcnow() + dt.timedelta(seconds=int(expires_in))).strftime('%Y-%m-%d %H:%M:%S')
