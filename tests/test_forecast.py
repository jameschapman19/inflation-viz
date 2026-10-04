import copy
from typing import Any

import pytest

from inflation_viz.forecast import public_forecast


@pytest.fixture
def payload() -> dict[str, Any]:
    return {
        "schemaVersion": 2,
        "generatedAt": "2024-04-02T12:00:00+00:00",
        "dataVintage": "2024-04-02T090000Z",
        "forecastOrigin": "2024-03-01",
        "horizonMonths": 1,
        "level": 80,
        "coverage": {"included": ["GB.CP01"], "missing": []},
        "totalUniqueId": "GB.CPI.FORECAST",
        "points": [
            {"unique_id": uid, "ds": "2024-04-01", "yhat": 0.3, "lo": 0.2, "hi": 0.4, "bands": None}
            for uid in ("GB.CP01", "GB.CPI.FORECAST")
        ],
    }


def test_allowlist_strips_private_fields_at_every_level(payload: dict[str, Any]) -> None:
    original = copy.deepcopy(payload)
    payload["model"] = "private model"
    payload["reconciliation"] = "private method"
    payload["evaluation"] = {"secret": "selection scores"}
    payload["coverage"]["selection"] = {"GB.CP01": "private model"}
    payload["points"][0]["featureWeights"] = [0.5, 0.5]
    assert public_forecast(payload) == original


@pytest.mark.parametrize("value", [float("nan"), float("inf"), None, True])
def test_invalid_point_cannot_reach_frontend(payload: dict[str, Any], value: object) -> None:
    payload["points"][0]["yhat"] = value
    with pytest.raises(ValueError, match="finite"):
        public_forecast(payload)


def test_incoherent_total_cannot_reach_frontend(payload: dict[str, Any]) -> None:
    payload["points"][1]["yhat"] = 0.5
    with pytest.raises(ValueError, match="total"):
        public_forecast(payload)


def test_missing_division_month_cannot_reach_frontend(payload: dict[str, Any]) -> None:
    payload["points"].pop(0)
    with pytest.raises(ValueError, match="complete horizon"):
        public_forecast(payload)


def test_band_fields_are_allowlisted(payload: dict[str, Any]) -> None:
    payload["points"][1]["bands"] = [{"level": 80, "lo": 0.2, "hi": 0.4, "method": "private"}]
    assert public_forecast(payload)["points"][1]["bands"] == [{"level": 80, "lo": 0.2, "hi": 0.4}]


def test_stale_origin_is_rejected(payload: dict[str, Any]) -> None:
    payload["forecastOrigin"] = "2024-01-01"
    with pytest.raises(ValueError, match="origin/horizon"):
        public_forecast(payload)
