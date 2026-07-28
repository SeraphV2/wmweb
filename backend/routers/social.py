import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from database import Database
from deps import get_db, get_current_user
import social

router = APIRouter()

# NOTE: on Render's default (ephemeral) filesystem, anything written here is
# wiped on every redeploy/restart - fine for images that only need to be
# reachable long enough for Meta/LinkedIn to fetch them once at publish time,
# but don't rely on old post images staying viewable. Add a persistent disk
# (or move to S3/Cloudinary/etc) if that matters later.
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}


@router.get("/accounts")
def list_accounts(db: Database = Depends(get_db)):
    return db.get_social_accounts()


@router.get("/connect/{platform}")
def connect(platform: str, current: dict = Depends(get_current_user)):
    state = social.new_state()
    if platform == 'meta':
        if not social.meta_enabled():
            raise HTTPException(400, "Meta app credentials aren't configured yet (META_APP_ID / META_APP_SECRET / META_REDIRECT_URI)")
        return {"url": social.meta_oauth_url(state)}
    if platform == 'linkedin':
        if not social.linkedin_enabled():
            raise HTTPException(400, "LinkedIn app credentials aren't configured yet (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / LINKEDIN_REDIRECT_URI)")
        return {"url": social.linkedin_oauth_url(state)}
    raise HTTPException(404, "Unknown platform")


@router.delete("/accounts/{aid}")
def disconnect(aid: int, current: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    db.delete_social_account(aid)
    db.log_activity(current['username'], 'deleted', 'social_account', aid, f'#{aid}')
    return {"ok": True}


@router.get("/posts")
def list_posts(db: Database = Depends(get_db)):
    return db.get_social_posts()


@router.post("/posts")
def create_post(
    content: str = Form(''),
    platforms: str = Form(...),  # comma-separated: facebook,instagram,linkedin
    image: UploadFile = File(None),
    current: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    target_platforms = [p.strip() for p in platforms.split(',') if p.strip()]
    if not target_platforms:
        raise HTTPException(400, "Select at least one platform")
    if not content.strip() and not image:
        raise HTTPException(400, "Post needs text or an image")

    image_path = None
    if image is not None:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(400, "Image must be JPEG, PNG, or WebP")
        ext = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}[image.content_type]
        image_path = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(UPLOAD_DIR, image_path), 'wb') as f:
            f.write(image.file.read())

    post_id = db.add_social_post(content, image_path, current['username'])
    image_url = social.public_image_url(image_path)

    results = []
    for platform in target_platforms:
        account = db.get_social_account_by_platform(
            'facebook' if platform == 'facebook' else 'instagram' if platform == 'instagram' else 'linkedin'
        )
        status, remote_id, error = 'failed', None, None
        try:
            if not account:
                raise RuntimeError(f"{platform.title()} isn't connected - go to Settings and connect it first")
            if platform == 'facebook':
                remote_id = social.publish_facebook(account['external_id'], account['access_token'], content, image_url)
            elif platform == 'instagram':
                if not image_url:
                    raise RuntimeError("Instagram posts require an image")
                remote_id = social.publish_instagram(account['external_id'], account['access_token'], content, image_url)
            elif platform == 'linkedin':
                remote_id = social.publish_linkedin(account['external_id'], account['access_token'], content, image_url)
            else:
                raise RuntimeError(f"Unknown platform: {platform}")
            status = 'posted'
        except Exception as e:
            error = str(e)

        tid = db.add_social_post_target(post_id, platform, status, remote_id, error)
        results.append({"id": tid, "platform": platform, "status": status, "error": error})

    db.log_activity(current['username'], 'created', 'social_post', post_id, (content[:60] or 'Social post'))
    return {"id": post_id, "targets": results}
