"""Agriculture adapter for the shared public Radar forecast contract."""

from __future__ import annotations

from typing import Any

from radar_contracts.forecast import public_forecast as validate_forecast

CROPS = {"wheat", "maize", "rice"}


def public_forecast(payload: dict[str, Any]) -> dict[str, Any]:
    """Read legacy agriculture runs and emit the common v2 panel contract."""
    if payload.get("schema_version") == 1:
        payload = {
            "schemaVersion": 2,
            "runId": payload["run_id"],
            "generatedAt": payload["issued_at"],
            "dataVintage": payload["data_vintage"],
            "forecastOrigin": payload["data_cutoff"],
            "horizonMonths": payload["horizon"],
            "level": 80,
            "status": payload["status"],
            "evaluationBasis": payload["evaluation_basis"],
            "coverage": payload["coverage"],
            "totalUniqueId": None,
            "series": {
                uid: {
                    "unit": value["unit"],
                    "intervalStatus": value.get("interval_status", "experimental"),
                }
                for uid, value in payload["forecasts"].items()
            },
            "points": [
                {
                    "unique_id": uid,
                    "ds": point["date"],
                    "yhat": point["point"],
                    "lo": point["lo"],
                    "hi": point["hi"],
                    "bands": None,
                }
                for uid, value in payload["forecasts"].items()
                for point in value["points"]
            ],
        }
    result = validate_forecast(payload, allowed_ids=CROPS, positive=True)
    if not result.get("series") or any(
        metadata["unit"] != "USD / tonne" for metadata in result["series"].values()
    ):
        raise ValueError("Benchmark forecasts require USD / tonne series metadata.")
    if any(point["lo"] is None or point["hi"] is None for point in result["points"]):
        raise ValueError("Published benchmark forecasts require complete intervals.")
    return result
