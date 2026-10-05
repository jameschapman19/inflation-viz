"""Domain rules for the shared public Radar forecast contract."""

from __future__ import annotations

from typing import Any

from radar_contracts.forecast import public_forecast as validate_forecast

TOTAL_UNIQUE_ID = "GB.CPI.FORECAST"


def public_forecast(payload: dict[str, Any]) -> dict[str, Any]:
    return validate_forecast(
        payload,
        allowed_ids={f"GB.CP{i:02d}" for i in range(1, 13)},
        total_unique_id=TOTAL_UNIQUE_ID,
    )
