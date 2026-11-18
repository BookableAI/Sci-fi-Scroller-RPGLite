"""
Sector Sentinel — FastAPI control plane.

Endpoints:
  GET  /api/v1/telemetry/config
  POST /api/v1/webhooks/revenuecat
  POST /api/v1/user/sync
"""

from __future__ import annotations

from fastapi import FastAPI

from app.routers import telemetry, user, webhooks

app = FastAPI(
    title="Sector Sentinel API",
    version="0.1.0",
    description="Remote balance, RevenueCat webhooks, and anti-tamper save sync.",
)

app.include_router(telemetry.router)
app.include_router(webhooks.router)
app.include_router(user.router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
