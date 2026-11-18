"""Client save sync with checksum anti-tamper."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.config import get_settings
from app.security import issue_confirmation_token, verify_checksum

router = APIRouter(prefix="/api/v1/user", tags=["user"])


class UserSyncRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    save_state: dict[str, Any]
    checksum: str = Field(min_length=32, max_length=128)


class UserSyncResponse(BaseModel):
    ok: bool
    confirmation_token: str
    user_id: str


@router.post("/sync", response_model=UserSyncResponse)
def sync_user_save(body: UserSyncRequest) -> UserSyncResponse:
    """
    Accept client save state, validate checksum hash to prevent value manipulation,
    and return a confirmation token.
    """
    settings = get_settings()
    secret = settings.sync_hmac_secret or settings.api_secret_key

    if not verify_checksum(body.save_state, body.checksum, secret):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checksum mismatch — save rejected",
        )

    token = issue_confirmation_token(body.user_id, secret)
    return UserSyncResponse(ok=True, confirmation_token=token, user_id=body.user_id)
