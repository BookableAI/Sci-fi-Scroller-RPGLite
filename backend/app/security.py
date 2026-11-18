"""Anti-tamper checksum helpers for client save sync."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from typing import Any


def canonical_json(payload: dict[str, Any]) -> str:
    """Stable JSON serialization for checksum comparison."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def compute_checksum(payload: dict[str, Any], secret: str) -> str:
    """HMAC-SHA256 over canonical payload using server secret."""
    digest = hmac.new(
        key=secret.encode("utf-8"),
        msg=canonical_json(payload).encode("utf-8"),
        digestmod=hashlib.sha256,
    )
    return digest.hexdigest()


def verify_checksum(payload: dict[str, Any], checksum: str, secret: str) -> bool:
    if not secret:
        # Misconfigured deploy: reject rather than accept unsigned sync.
        return False
    expected = compute_checksum(payload, secret)
    return hmac.compare_digest(expected, checksum)


def issue_confirmation_token(user_id: str, secret: str) -> str:
    nonce = secrets.token_hex(16)
    issued_at = str(int(time.time()))
    material = f"{user_id}:{issued_at}:{nonce}".encode("utf-8")
    signature = hmac.new(
        key=(secret or "unconfigured").encode("utf-8"),
        msg=material,
        digestmod=hashlib.sha256,
    ).hexdigest()
    return f"{issued_at}.{nonce}.{signature}"
