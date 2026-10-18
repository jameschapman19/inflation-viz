import copy
import json
from pathlib import Path
from typing import Any

import pytest

from agriculture_viz.forecast import public_forecast


@pytest.fixture
def payload() -> dict[str, Any]:
    root = Path(__file__).resolve().parents[1]
    return public_forecast(json.loads((root / "data/forecast/latest.json").read_text()))


def test_legacy_run_uses_same_contract_as_inflation() -> None:
    root = Path(__file__).resolve().parents[1]
    legacy = next(
        value
        for path in sorted((root / "data/forecast").glob("*.json"))
        if path.name != "latest.json"
        and (value := json.loads(path.read_text())).get("schema_version") == 1
    )
    payload = public_forecast(legacy)
    assert payload["schemaVersion"] == 2
    assert payload["totalUniqueId"] is None
    assert len(payload["points"]) == 3 * payload["horizonMonths"]
    assert payload["series"]["wheat"]["unit"] == "USD / tonne"


def test_nested_private_fields_never_reach_frontend(payload: dict[str, Any]) -> None:
    original = copy.deepcopy(payload)
    payload["selection"] = {"private": "method"}
    payload["coverage"]["weights"] = [1.0]
    payload["series"]["wheat"]["model"] = "private model"
    payload["points"][0]["coefficients"] = [1.0]
    assert public_forecast(payload) == original


@pytest.mark.parametrize("problem", ["negative", "missing", "duplicate", "origin", "aggregate"])
def test_invalid_forecast_is_rejected(payload: dict[str, Any], problem: str) -> None:
    if problem == "negative":
        payload["points"][0]["yhat"] = -1.0
    elif problem == "missing":
        payload["points"].pop(0)
    elif problem == "duplicate":
        payload["points"].append(copy.deepcopy(payload["points"][0]))
    elif problem == "origin":
        payload["forecastOrigin"] = "2000-01-01"
    else:
        payload["totalUniqueId"] = "TOTAL"
    with pytest.raises(ValueError):
        public_forecast(payload)
