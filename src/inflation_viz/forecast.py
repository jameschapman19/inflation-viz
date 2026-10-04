"""Validate and allowlist public forecast results at the visualization boundary."""

from __future__ import annotations

import math
from datetime import date
from typing import Any

TOTAL_UNIQUE_ID = "GB.CPI.FORECAST"


def _month(value: object) -> date:
    if not isinstance(value, str):
        raise ValueError("Forecast dates must be ISO month-start dates.")
    result = date.fromisoformat(value)
    if result.day != 1:
        raise ValueError("Forecast dates must start on the first day of the month.")
    return result


def _offset(value: date, months: int) -> date:
    year, month = divmod(value.year * 12 + value.month - 1 + months, 12)
    return date(year, month + 1, 1)


def _number(value: object, *, nullable: bool = False) -> float | None:
    if nullable and value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise ValueError("Forecast values must be finite numbers.")
    return float(value)


def _level(value: object) -> int:
    if type(value) is not int or not 0 < value < 100:
        raise ValueError("Forecast confidence levels must be integers between 1 and 99.")
    return value


def public_forecast(payload: dict[str, Any]) -> dict[str, Any]:
    """Accept v1/v2 inputs and emit only the v2 output contract.

    Explicit field selection applies at every nesting level. Older published
    payloads remain readable; additional private fields never reach web data.
    """
    if type(payload.get("schemaVersion")) is not int or payload["schemaVersion"] not in (1, 2):
        raise ValueError("Unsupported forecast schema version.")
    coverage = payload.get("coverage")
    if not isinstance(coverage, dict):
        raise ValueError("Forecast coverage is required.")
    included, missing = coverage.get("included"), coverage.get("missing")
    if not isinstance(included, list) or not isinstance(missing, list):
        raise ValueError("Forecast coverage must contain division lists.")
    if not all(isinstance(uid, str) for uid in included + missing):
        raise ValueError("Forecast division identifiers must be strings.")
    if set(included + missing) - {f"GB.CP{i:02d}" for i in range(1, 13)}:
        raise ValueError("Forecast coverage contains an unknown division.")
    if len(set(included + missing)) != len(included + missing):
        raise ValueError("Forecast coverage contains duplicate or overlapping divisions.")
    raw_points = payload.get("points")
    if not isinstance(raw_points, list):
        raise ValueError("Forecast points must be a list.")
    source_total = payload.get("totalUniqueId")
    if not isinstance(source_total, str) or source_total in included + missing:
        raise ValueError("Forecast total identifier is invalid.")
    points: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for raw in raw_points:
        if not isinstance(raw, dict):
            raise ValueError("Forecast points must be objects.")
        uid = raw.get("unique_id")
        if not isinstance(uid, str):
            raise ValueError("Forecast point identifiers must be strings.")
        if uid != source_total and uid not in included:
            raise ValueError("Forecast point is outside the included coverage.")
        uid = TOTAL_UNIQUE_ID if uid == source_total else uid
        ds = _month(raw.get("ds")).isoformat()
        if (uid, ds) in seen:
            raise ValueError("Forecast contains duplicate points.")
        seen.add((uid, ds))
        yhat = _number(raw.get("yhat"))
        assert yhat is not None
        lo, hi = _number(raw.get("lo"), nullable=True), _number(raw.get("hi"), nullable=True)
        if (lo is None) != (hi is None) or (lo is not None and hi is not None and lo > hi):
            raise ValueError("Forecast interval is incomplete or reversed.")
        bands: list[dict[str, Any]] | None = None
        if raw.get("bands") is not None:
            if uid != TOTAL_UNIQUE_ID or not isinstance(raw["bands"], list):
                raise ValueError("Forecast bands must belong to the total.")
            bands = []
            for band in raw["bands"]:
                if not isinstance(band, dict):
                    raise ValueError("Forecast bands must be objects.")
                band_lo, band_hi = _number(band.get("lo")), _number(band.get("hi"))
                assert band_lo is not None and band_hi is not None
                if band_lo > band_hi:
                    raise ValueError("Forecast band is reversed.")
                bands.append({"level": _level(band.get("level")), "lo": band_lo, "hi": band_hi})
            bands.sort(key=lambda b: b["level"])
            if len({b["level"] for b in bands}) != len(bands):
                raise ValueError("Forecast band levels must be unique.")
            for narrow, wide in zip(bands, bands[1:], strict=False):
                if wide["lo"] > narrow["lo"] or wide["hi"] < narrow["hi"]:
                    raise ValueError("Forecast bands must be nested by confidence level.")
        points.append(
            {"unique_id": uid, "ds": ds, "yhat": yhat, "lo": lo, "hi": hi, "bands": bands}
        )

    dates = sorted({p["ds"] for p in points})
    origin = _offset(_month(dates[0]), -1).isoformat() if dates else None
    horizon = len(dates)
    if payload["schemaVersion"] == 2 and (
        payload.get("forecastOrigin") != origin
        or type(payload.get("horizonMonths")) is not int
        or payload["horizonMonths"] != horizon
    ):
        raise ValueError("Forecast origin/horizon do not match the points.")
    if points:
        if not included:
            raise ValueError("Forecast points require included divisions.")
        expected = [_offset(_month(origin), i).isoformat() for i in range(1, horizon + 1)]
        if dates != expected or len(points) != (len(included) + 1) * horizon:
            raise ValueError("Every included division and total must cover the complete horizon.")
        values = {(p["unique_id"], p["ds"]): p["yhat"] for p in points}
        for ds in dates:
            if abs(sum(values[uid, ds] for uid in included) - values[TOTAL_UNIQUE_ID, ds]) > 1e-6:
                raise ValueError("Forecast total does not match the published divisions.")
        level: int | None = _level(payload.get("level"))
    else:
        if included:
            raise ValueError("Included coverage requires forecast points.")
        level = None
    for field in ("generatedAt", "dataVintage"):
        if payload.get(field) is not None and not isinstance(payload[field], str):
            raise ValueError(f"Forecast {field} must be a string or null.")
    return {
        "schemaVersion": 2,
        "generatedAt": payload.get("generatedAt"),
        "dataVintage": payload.get("dataVintage"),
        "forecastOrigin": origin,
        "horizonMonths": horizon,
        "level": level,
        "coverage": {"included": list(included), "missing": list(missing)},
        "totalUniqueId": TOTAL_UNIQUE_ID,
        "points": points,
    }
