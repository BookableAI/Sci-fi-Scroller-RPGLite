"""RevenueCat server-to-server webhook handler."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.config import get_settings

logger = logging.getLogger("sector_sentinel.webhooks")

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


class RevenueCatEvent(BaseModel):
    type: str | None = None
    app_user_id: str | None = None
    product_id: str | None = None
    entitlement_ids: list[str] = Field(default_factory=list)


class RevenueCatWebhookBody(BaseModel):
    api_version: str | None = None
    event: RevenueCatEvent | dict[str, Any] | None = None


@router.post("/revenuecat")
async def revenuecat_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """
    Validate RevenueCat purchase events.

    Configure Authorization bearer = REVENUECAT_WEBHOOK_SECRET on Render.
    """
    settings = get_settings()
    secret = settings.revenuecat_webhook_secret

    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="REVENUECAT_WEBHOOK_SECRET is not configured",
        )

    expected = f"Bearer {secret}"
    if authorization != expected:
        # Also accept raw secret for dashboards that send the token alone.
        if authorization != secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook authorization",
            )

    raw: dict[str, Any] = await request.json()
    body = RevenueCatWebhookBody.model_validate(raw)
    event = body.event
    event_type = None
    app_user_id = None
    product_id = None

    if isinstance(event, RevenueCatEvent):
        event_type = event.type
        app_user_id = event.app_user_id
        product_id = event.product_id
    elif isinstance(event, dict):
        event_type = event.get("type")
        app_user_id = event.get("app_user_id")
        product_id = event.get("product_id")

    logger.info(
        "revenuecat_event type=%s user=%s product=%s",
        event_type,
        app_user_id,
        product_id,
    )

    return {
        "ok": True,
        "received": True,
        "event_type": event_type,
        "app_user_id": app_user_id,
        "product_id": product_id,
    }
