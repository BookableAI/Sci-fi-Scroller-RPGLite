"""Remote telemetry / balance configuration endpoint."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.config import get_balance_config

router = APIRouter(prefix="/api/v1/telemetry", tags=["telemetry"])


@router.get("/config")
def get_telemetry_config() -> dict[str, Any]:
    """Return remote Supply Cache drop probabilities and combat balance JSON."""
    balance = get_balance_config()
    return {
        "ok": True,
        "config": balance,
    }
