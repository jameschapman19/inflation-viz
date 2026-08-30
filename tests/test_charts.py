from pathlib import Path

from inflation_viz.config import SourceRegistry
from inflation_viz.site.charts import basket_treemap, contributors_chart, headline_chart
from inflation_viz.storage import read_latest_provenance, read_latest_series


def test_headline_chart_has_one_trace_per_headline_series(
    synthetic_data_dir: Path, registry: SourceRegistry
) -> None:
    series = read_latest_series(synthetic_data_dir)
    fig = headline_chart(series, registry)
    assert len(fig.data) == len(registry.headline)


def test_contributors_chart_has_one_trace_per_division_plus_headline(
    synthetic_data_dir: Path, registry: SourceRegistry
) -> None:
    series = read_latest_series(synthetic_data_dir)
    fig = contributors_chart(series, registry)
    assert len(fig.data) == len(registry.divisions) + 1  # +1 for the headline overlay


def test_basket_treemap_has_twelve_segments(
    synthetic_data_dir: Path, registry: SourceRegistry
) -> None:
    import polars as pl

    weights = pl.read_parquet(synthetic_data_dir / "latest" / "weights.parquet")
    fig = basket_treemap(weights, registry)
    assert len(fig.data[0].labels) == 12


def test_provenance_is_readable_alongside_series(synthetic_data_dir: Path) -> None:
    provenance = read_latest_provenance(synthetic_data_dir)
    assert "release_date" in provenance.columns
    assert "source_url" in provenance.columns
