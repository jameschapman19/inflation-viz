"""Registry types + the one thing still read from a local file: `external`,
the handful of non-ONS-timeseries reference sources (Ofgem, DESNZ fuel
prices) that have no CDID-based API to discover. Every ONS series —
headline, divisions, and the full COICOP sub-division tree — is discovered
live at refresh time by `ons_catalog.py`; nothing about *those* is read
from here. See `sources.yaml`'s header comment.
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


def load_external(path: Path = SOURCES_PATH) -> dict[str, ReferenceTableSource]:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return {
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


def load_context(path: Path = SOURCES_PATH) -> dict[str, SeriesSource]:
    """The handful of non-CPI ONS series added for context (e.g. real wage
    growth) — see `sources.yaml`'s `context:` header comment for why these
    are hand-typed rather than discovered like the COICOP tree.
    """
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    result: dict[str, SeriesSource] = {}
    for entry in raw.get("context", {}).values():
        cdid = entry["cdid"]
        dataset = entry["dataset"]
        source_url = (
            f"https://www.ons.gov.uk/{entry['theme_path']}/timeseries/{cdid.lower()}/{dataset}"
        )
        unique_id = entry["unique_id"]
        result[unique_id] = SeriesSource(
            unique_id=unique_id,
            name=entry["name"],
            cdid=cdid,
            dataset=dataset,
            source_name=entry["source_name"],
            source_url=source_url,
            api_url=f"{source_url}/data",
            license=entry["license"],
            cadence=entry["cadence"],
            unit=entry["unit"],
        )
    return result


class SourceRegistry:
    """A fully-assembled set of series — some live-discovered from ONS
    (headline/divisions/weights/subdivisions/subdivision_weights, built by
    `ons_catalog.discover_registry()`), some read from `sources.yaml`
    (`external`). Construction is intentionally dumb: this class just holds
    whatever dicts it's given.
    """

    def __init__(
        self,
        *,
        headline: dict[str, SeriesSource],
        divisions: dict[str, SeriesSource],
        weights: dict[str, SeriesSource],
        subdivisions: dict[str, SeriesSource],
        subdivision_weights: dict[str, SeriesSource],
        external: dict[str, ReferenceTableSource],
        context: dict[str, SeriesSource] | None = None,
    ) -> None:
        self.headline = headline
        self.divisions = divisions
        self.weights = weights
        self.subdivisions = subdivisions
        self.subdivision_weights = subdivision_weights
        self.external = external
        self.context = context if context is not None else {}

    @property
    def all_series(self) -> dict[str, SeriesSource]:
        """Every fetchable series, keyed by unique_id."""
        return {
            **self.headline,
            **self.divisions,
            **self.weights,
            **self.subdivisions,
            **self.subdivision_weights,
            **self.context,
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
