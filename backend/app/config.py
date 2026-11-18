"""Remote balance configuration and environment settings."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_balance() -> dict[str, Any]:
    """Load shared BalanceConfig.json when present; otherwise embed defaults."""
    candidates = [
        Path(__file__).resolve().parents[1] / "shared" / "BalanceConfig.json",
        Path(__file__).resolve().parents[2] / "shared" / "BalanceConfig.json",
        Path(__file__).resolve().parents[3] / "shared" / "BalanceConfig.json",
    ]
    for path in candidates:
        if path.is_file():
            with path.open(encoding="utf-8") as handle:
                return json.load(handle)

    return {
        "version": 1,
        "cacheDropProbabilities": {},
        "combat": {
            "supplyCacheDropChance": 0.4,
            "baseSalvageCredits": 12,
            "enemyHpBase": 80,
            "enemyHpPerTier": 28,
        },
        "monetization": {
            "interstitialEveryNLevels": 5,
            "overclockDurationSeconds": 1200,
            "overclockSpeedMultiplier": 2,
        },
    }


class Settings(BaseSettings):
    """Runtime secrets — set via Render env; never commit real values."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_secret_key: str = ""
    revenuecat_webhook_secret: str = ""
    sync_hmac_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings(
        api_secret_key=os.environ.get("API_SECRET_KEY", ""),
        revenuecat_webhook_secret=os.environ.get("REVENUECAT_WEBHOOK_SECRET", ""),
        sync_hmac_secret=os.environ.get(
            "SYNC_HMAC_SECRET",
            os.environ.get("API_SECRET_KEY", ""),
        ),
    )


@lru_cache
def get_balance_config() -> dict[str, Any]:
    return _default_balance()
