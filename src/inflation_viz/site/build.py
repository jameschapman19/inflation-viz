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


def build_site(
    *,
    data_dir: Path = DATA_DIR,
    out_dir: Path,
    registry: SourceRegistry | None = None,
) -> None:
    registry = registry or load_registry()
    series = read_latest_series(data_dir)
    provenance = read_latest_provenance(data_dir)

    weights_path = data_dir / "latest" / "weights.parquet"
    empty_weights_schema = {
        "coicop": pl.Utf8,
        "division_name": pl.Utf8,
        "weight_per_mille": pl.Float64,
    }
    weights = (
        pl.read_parquet(weights_path)
        if weights_path.exists()
        else pl.DataFrame(schema=empty_weights_schema)
    )

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
        headline_stats=_headline_stats(series, provenance, registry),
        headline_chart_html=_figure_to_html(headline_fig, div_id="headline-chart"),
    )
    (out_dir / "index.html").write_text(index_html, encoding="utf-8")

    # --- contributors ---
    contributors_fig = contributors_chart(series, registry)
    contributors_html = env.get_template("contributors.html").render(
        **common_ctx,
        contributors_chart_html=_figure_to_html(contributors_fig, div_id="contributors-chart"),
        divisions=[
            {
                "division_name": d.division_name,
                "cdid": d.cdid,
                "source_url": d.source_url,
                "color": division_color(d.unique_id),
            }
            for d in registry.divisions_sorted()
        ],
    )
    (out_dir / "contributors.html").write_text(contributors_html, encoding="utf-8")

    # --- basket ---
    basket_fig = basket_treemap(weights, registry)
    weights_source = registry.reference_tables.get("basket_weights")
    weight_by_coicop = dict(
        zip(weights["coicop"].to_list(), weights["weight_per_mille"].to_list(), strict=True)
    )
    basket_html = env.get_template("basket.html").render(
        **common_ctx,
        basket_chart_html=_figure_to_html(basket_fig, div_id="basket-chart"),
        weight_rows=[
            {
                "division_name": d.division_name,
                "coicop": d.coicop,
                "weight_per_mille": weight_by_coicop.get(d.coicop, 0.0),
                "color": division_color(d.unique_id),
            }
            for d in registry.divisions_sorted()
        ],
        weights_source_url=weights_source.source_url if weights_source else "",
        weights_source_name=weights_source.source_name if weights_source else "",
    )
    (out_dir / "basket.html").write_text(basket_html, encoding="utf-8")

    # --- methodology ---
    methodology_html = env.get_template("methodology.html").render(
        **common_ctx,
        headline=list(registry.headline.values()),
        divisions=[
            {
                "division_name": d.division_name,
                "cdid": d.cdid,
                "source_url": d.source_url,
                "source_name": d.source_name,
                "license": d.license,
                "cadence": d.cadence,
                "color": division_color(d.unique_id),
            }
            for d in registry.divisions_sorted()
        ],
        reference_tables=list(registry.reference_tables.values()),
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
