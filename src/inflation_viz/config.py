"""Loads sources.yaml — the single source registry every fetcher and the
methodology page reads from. Nothing about which series to pull, or how to
attribute it, is hardcoded outside this file's callers.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCES_PATH = REPO_ROOT / "sources.yaml"


@dataclass(frozen=True, slots=True)
class SeriesSource:
    """A single ONS (or other) timeseries and its provenance."""

    unique_id: str
    name: str
    cdid: str
    dataset: str
    source_name: str
    source_url: str
    api_url: str
    license: str
    cadence: str
    unit: str
    division_name: str | None = None
    coicop: str | None = None
    parent_coicop: str | None = None


@dataclass(frozen=True, slots=True)
class ReferenceTableSource:
    """A downloadable reference table (no CDID timeseries API)."""

    key: str
    name: str
    source_name: str
    source_url: str
    license: str
    cadence: str
    notes: str


def _build_series_source(unique_id: str, entry: dict[str, Any]) -> SeriesSource:
    return SeriesSource(
        unique_id=unique_id,
        name=entry.get("name") or entry["division_name"],
        cdid=entry["cdid"],
        dataset=entry["dataset"],
        source_name=entry["source_name"],
        source_url=entry["source_url"],
        api_url=entry["api_url"],
        license=entry["license"],
        cadence=entry["cadence"],
        unit=entry["unit"],
        division_name=entry.get("division_name"),
        coicop=entry.get("coicop"),
        parent_coicop=entry.get("parent_coicop"),
    )


class SourceRegistry:
    """Typed view over sources.yaml."""

    def __init__(self, raw: dict[str, Any]) -> None:
        self._raw = raw
        self.headline: dict[str, SeriesSource] = {
            uid: _build_series_source(uid, entry) for uid, entry in raw.get("headline", {}).items()
        }
        self.divisions: dict[str, SeriesSource] = {
            uid: _build_series_source(uid, entry) for uid, entry in raw.get("divisions", {}).items()
        }
        self.weights: dict[str, SeriesSource] = {
            uid: _build_series_source(uid, entry) for uid, entry in raw.get("weights", {}).items()
        }
        self.subdivisions: dict[str, SeriesSource] = {
            uid: _build_series_source(uid, entry)
            for uid, entry in raw.get("subdivisions", {}).items()
        }
        self.subdivision_weights: dict[str, SeriesSource] = {
            uid: _build_series_source(uid, entry)
            for uid, entry in raw.get("subdivision_weights", {}).items()
        }
        self.external: dict[str, ReferenceTableSource] = {
            key: ReferenceTableSource(
                key=key,
                name=entry["name"],
                source_name=entry["source_name"],
                source_url=entry["source_url"],
                license=entry["license"],
                cadence=entry["cadence"],
                notes=entry.get("notes", ""),
            )
            for key, entry in raw.get("external", {}).items()
        }

    @property
    def all_series(self) -> dict[str, SeriesSource]:
        """Every fetchable series, keyed by unique_id."""
        return {
            **self.headline,
            **self.divisions,
            **self.weights,
            **self.subdivisions,
            **self.subdivision_weights,
        }

    def divisions_sorted(self) -> list[SeriesSource]:
        """Divisions ordered by COICOP code (01..12) — the fixed stacking/legend order."""
        return sorted(self.divisions.values(), key=lambda s: s.coicop or "")

    def weights_sorted(self) -> list[SeriesSource]:
        """Weight series ordered by COICOP code (01..12)."""
        return sorted(self.weights.values(), key=lambda s: s.coicop or "")

    def subdivisions_sorted(self) -> list[SeriesSource]:
        """Sub-division rate series ordered by COICOP code."""
        return sorted(self.subdivisions.values(), key=lambda s: s.coicop or "")

    def subdivision_weights_sorted(self) -> list[SeriesSource]:
        """Sub-division weight series ordered by COICOP code."""
        return sorted(self.subdivision_weights.values(), key=lambda s: s.coicop or "")


def load_registry(path: Path = SOURCES_PATH) -> SourceRegistry:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return SourceRegistry(raw)
