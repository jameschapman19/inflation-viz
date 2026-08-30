from pathlib import Path

from inflation_viz.config import SourceRegistry
from inflation_viz.site.build import build_site


def test_build_produces_all_four_pages(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "public"
    build_site(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    for page in ["index.html", "contributors.html", "basket.html", "methodology.html"]:
        assert (out_dir / page).exists(), f"{page} was not built"


def test_static_assets_are_copied(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "public"
    build_site(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)
    assert (out_dir / "static" / "site.css").exists()


def test_every_division_source_url_appears_on_methodology_page(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "public"
    build_site(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    methodology_html = (out_dir / "methodology.html").read_text()
    for source in registry.all_series.values():
        assert source.source_url in methodology_html, (
            f"{source.unique_id}'s source URL is missing from the methodology page — "
            "every number must be one click from its source"
        )
        assert source.cdid in methodology_html
        assert source.license in methodology_html


def test_every_division_source_url_appears_on_contributors_page(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "public"
    build_site(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    contributors_html = (out_dir / "contributors.html").read_text()
    for source in registry.divisions.values():
        assert source.source_url in contributors_html


def test_every_headline_source_url_appears_on_index_page(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    out_dir = tmp_path / "public"
    build_site(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    index_html = (out_dir / "index.html").read_text()
    for source in registry.headline.values():
        assert source.source_url in index_html


def test_division_colors_are_consistent_across_pages(
    synthetic_data_dir: Path, registry: SourceRegistry, tmp_path: Path
) -> None:
    """Definition of done: division color mapping is a single shared config,
    not repeated per chart — so the same division must render the same
    swatch color on every page that shows one.
    """
    from inflation_viz.colors import division_color

    out_dir = tmp_path / "public"
    build_site(data_dir=synthetic_data_dir, out_dir=out_dir, registry=registry)

    contributors_html = (out_dir / "contributors.html").read_text()
    methodology_html = (out_dir / "methodology.html").read_text()
    basket_html = (out_dir / "basket.html").read_text()

    for uid in registry.divisions:
        color = division_color(uid, dark=True)
        assert color in contributors_html
        assert color in methodology_html
        assert color in basket_html
