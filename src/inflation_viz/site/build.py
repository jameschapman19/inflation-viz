"""Single entrypoint that rebuilds the whole static site from `data/latest`
and `sources.yaml`. No page's data is hand-edited — everything here is
either read from the fetched parquet or from the source registry.

Usage: `uv run python -m inflation_viz.site.build [--out public]`
"""

from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import plotly.io as pio
import polars as pl
from jinja2 import Environment, FileSystemLoader, select_autoescape

from inflation_viz.colors import division_color
from inflation_viz.config import SourceRegistry, load_registry
from inflation_viz.site.charts import basket_treemap, contributors_chart, headline_chart
from inflation_viz.storage import (
    DATA_DIR,
    list_vintages,
    read_latest_provenance,
    read_latest_series,
)

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
STATIC_DIR = Path(__file__).resolve().parent / "static"


@dataclass(frozen=True, slots=True)
class HeadlineStat:
    name: str
    value: float
    period: str
    source_url: str
    next_release: str | None


def _figure_to_html(fig: object, *, div_id: str) -> str:
    return pio.to_html(fig, include_plotlyjs="cdn", full_html=False, div_id=div_id)  # type: ignore[no-any-return]


def _headline_stats(
    series: pl.DataFrame, provenance: pl.DataFrame, registry: SourceRegistry
) -> list[HeadlineStat]:
    stats = []
    for uid, source in registry.headline.items():
        s = series.filter(pl.col("unique_id") == uid).sort("ds")
        if s.is_empty():
            continue
        latest = s.tail(1)
        prov_row = provenance.filter(pl.col("unique_id") == uid)
        next_release = None
        if not prov_row.is_empty() and prov_row["next_release_date"][0] is not None:
            next_release = str(prov_row["next_release_date"][0])
        stats.append(
            HeadlineStat(
                name=source.name,
                value=float(latest["y"][0]),
                period=str(latest["ds"][0]),
                source_url=source.source_url,
                next_release=next_release,
            )
        )
    return stats


def _latest_weights(series: pl.DataFrame, registry: SourceRegistry) -> pl.DataFrame:
    """Each division's most recent basket-weight observation, keyed by COICOP.

    Weight series live in the same fetched `series` frame as everything
    else (registry.weights, unique_ids GB.W01..GB.W12) — no separate
    scrape or file needed.
    """
    weight_ids = list(registry.weights.keys())
    uid_to_coicop = {uid: s.coicop for uid, s in registry.weights.items()}
    empty = pl.DataFrame(schema={"coicop": pl.Utf8, "weight_per_mille": pl.Float64})
    if not weight_ids:
        return empty

    weight_series = series.filter(pl.col("unique_id").is_in(weight_ids))
    if weight_series.is_empty():
        return empty

    return (
        weight_series.with_columns(pl.col("unique_id").replace(uid_to_coicop).alias("coicop"))
        .sort("ds")
        .group_by("coicop")
        .agg(pl.col("y").last().alias("weight_per_mille"))
    )


def build_site(
    *,
    data_dir: Path = DATA_DIR,
    out_dir: Path,
    registry: SourceRegistry | None = None,
) -> None:
    registry = registry or load_registry()
    series = read_latest_series(data_dir)
    provenance = read_latest_provenance(data_dir)
    weights = _latest_weights(series, registry)

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "static").mkdir(exist_ok=True)
    for asset in STATIC_DIR.iterdir():
        shutil.copy(asset, out_dir / "static" / asset.name)

    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR), autoescape=select_autoescape(["html"])
    )
    generated_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    common_ctx = {"asset_prefix": "", "generated_at": generated_at}

    vintages = list_vintages(data_dir)
    latest_vintage = vintages[-1] if vintages else "none — run the fetcher first"

    # --- headline ---
    headline_fig = headline_chart(series, registry)
    index_html = env.get_template("index.html").render(
        **common_ctx,
        active_page="index",
        headline_stats=_headline_stats(series, provenance, registry),
        headline_chart_html=_figure_to_html(headline_fig, div_id="headline-chart"),
    )
    (out_dir / "index.html").write_text(index_html, encoding="utf-8")

    # --- contributors ---
    contributors_fig = contributors_chart(series, registry)
    contributors_html = env.get_template("contributors.html").render(
        **common_ctx,
        active_page="contributors",
        contributors_chart_html=_figure_to_html(contributors_fig, div_id="contributors-chart"),
        divisions=[
            {
                "division_name": d.division_name,
                "cdid": d.cdid,
                "source_url": d.source_url,
                "color": division_color(d.unique_id, dark=True),
            }
            for d in registry.divisions_sorted()
        ],
    )
    (out_dir / "contributors.html").write_text(contributors_html, encoding="utf-8")

    # --- basket ---
    basket_fig = basket_treemap(weights, registry)
    weight_by_coicop = dict(
        zip(weights["coicop"].to_list(), weights["weight_per_mille"].to_list(), strict=True)
    )
    weight_source_by_coicop = {w.coicop: w for w in registry.weights_sorted()}
    basket_html = env.get_template("basket.html").render(
        **common_ctx,
        active_page="basket",
        basket_chart_html=_figure_to_html(basket_fig, div_id="basket-chart"),
        weight_rows=[
            {
                "division_name": d.division_name,
                "coicop": d.coicop,
                "weight_per_mille": weight_by_coicop.get(d.coicop, 0.0),
                "color": division_color(d.unique_id, dark=True),
                "cdid": weight_source_by_coicop[d.coicop].cdid,
                "source_url": weight_source_by_coicop[d.coicop].source_url,
            }
            for d in registry.divisions_sorted()
            if d.coicop in weight_source_by_coicop
        ],
    )
    (out_dir / "basket.html").write_text(basket_html, encoding="utf-8")

    # --- methodology ---
    methodology_html = env.get_template("methodology.html").render(
        **common_ctx,
        active_page="methodology",
        headline=list(registry.headline.values()),
        divisions=[
            {
                "division_name": d.division_name,
                "cdid": d.cdid,
                "source_url": d.source_url,
                "source_name": d.source_name,
                "license": d.license,
                "cadence": d.cadence,
                "color": division_color(d.unique_id, dark=True),
            }
            for d in registry.divisions_sorted()
        ],
        weights=[
            {
                "division_name": w.division_name,
                "cdid": w.cdid,
                "source_url": w.source_url,
                "source_name": w.source_name,
                "license": w.license,
                "cadence": w.cadence,
                "color": division_color(f"GB.CP{w.coicop}", dark=True),
            }
            for w in registry.weights_sorted()
        ],
        external=list(registry.external.values()),
        latest_vintage=latest_vintage,
    )
    (out_dir / "methodology.html").write_text(methodology_html, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("public"))
    args = parser.parse_args()
    build_site(out_dir=args.out)


if __name__ == "__main__":
    main()
