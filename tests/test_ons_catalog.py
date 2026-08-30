from pathlib import Path

from inflation_viz.config import load_external
from inflation_viz.ons_catalog import (
    CatalogEntry,
    _normalize_name,
    _parent_coicop,
    _titleize,
    build_catalog,
    build_registry,
    parse_bulk_csv,
)

FIXTURE_CSV = Path(__file__).parent / "fixtures" / "ons_bulk_mm23_sample.csv"


def _fixture_catalog() -> dict[tuple[str, str], CatalogEntry]:
    csv_text = FIXTURE_CSV.read_text(encoding="utf-8")
    return build_catalog(parse_bulk_csv(csv_text))


def test_parse_bulk_csv_pairs_every_cdid_with_its_title() -> None:
    csv_text = FIXTURE_CSV.read_text(encoding="utf-8")
    titles_by_cdid = parse_bulk_csv(csv_text)
    assert titles_by_cdid["D7G7"] == "CPI ANNUAL RATE 00: ALL ITEMS 2015=100"
    assert titles_by_cdid["CHZR"] == "CPI WEIGHTS 01 : FOOD AND NON-ALCOHOLIC BEVERAGES"
    assert "ABMI" in titles_by_cdid  # present in the raw title map...


def test_build_catalog_ignores_non_cpi_and_non_rate_weight_titles() -> None:
    """A title with no COICOP-coded ANNUAL RATE/WEIGHTS/contribution
    pattern (an unrelated GDP series, or a CPI INDEX series — index level
    isn't a metric this app tracks) must never surface as a series —
    silently dropping the unmatched, not guessing at it, is the point.
    """
    catalog = _fixture_catalog()
    all_cdids = {
        cdid
        for entry in catalog.values()
        for cdid in (entry.rate_cdid, entry.weight_cdid, entry.contribution_cdid)
        if cdid is not None
    }
    assert "ABMI" not in all_cdids
    assert "FXIX" not in all_cdids


def test_build_catalog_resolves_headline_cpi_and_cpih() -> None:
    catalog = _fixture_catalog()
    assert catalog[("CPI", "00")].rate_cdid == "D7G7"
    assert catalog[("CPIH", "00")].rate_cdid == "L55O"


def test_build_catalog_resolves_division_weight_and_rate_and_class_depth() -> None:
    catalog = _fixture_catalog()
    assert catalog[("CPI", "01")].weight_cdid == "CHZR"
    assert catalog[("CPI", "01.1")].rate_cdid == "D7GK"
    assert catalog[("CPI", "01.1")].weight_cdid == "CJUX"
    assert catalog[("CPI", "01.1.1")].rate_cdid == "FX01"
    assert catalog[("CPI", "01.1.1")].weight_cdid == "FX02"


def test_build_catalog_resolves_ons_combined_series() -> None:
    """08.2-3 combines two groups directly under division 08; 05.3.1/2
    combines two classes within group 05.3 — different separators, same
    "trailing segment only" shape.
    """
    catalog = _fixture_catalog()
    assert catalog[("CPI", "08.2-3")].rate_cdid == "FX21"
    assert catalog[("CPI", "08.2-3")].weight_cdid == "FX22"
    assert catalog[("CPI", "05.3.1/2")].rate_cdid == "FX23"
    assert catalog[("CPI", "05.3.1/2")].weight_cdid == "FX24"


def test_build_catalog_resolves_contribution_titles_via_the_verified_name_table() -> None:
    """The contribution family ("CPI: Contribution to all items annual
    rate: Food & non-alcoholic beverages") carries no COICOP code at all,
    and — unlike the fixture's other title families — its category name
    genuinely doesn't match the rate/weight titles' own naming for the
    same division (04's rate/weight name says "Housing, water and fuels";
    its contribution name says "Housing & household services"). It's
    resolved via the verified `_CONTRIBUTION_NAMES_BY_CODE` table instead.
    """
    catalog = _fixture_catalog()
    assert catalog[("CPI", "01")].contribution_cdid == "WUMA"
    assert catalog[("CPI", "04")].contribution_cdid == "CD04"
    assert catalog[("CPI", "12")].contribution_cdid == "CD12"


def test_build_catalog_drops_an_unrecognized_contribution_name_rather_than_guessing() -> None:
    catalog = _fixture_catalog()
    all_contribution_cdids = {e.contribution_cdid for e in catalog.values() if e.contribution_cdid}
    assert "FXCU" not in all_contribution_cdids


def test_normalize_name_makes_ampersand_and_case_insensitive() -> None:
    assert _normalize_name("FOOD AND NON-ALCOHOLIC BEVERAGES") == _normalize_name(
        "Food & non-alcoholic beverages"
    )


def test_titleize_matches_the_projects_established_sentence_case() -> None:
    assert _titleize("FOOD AND NON-ALCOHOLIC BEVERAGES") == "Food and non-alcoholic beverages"
    assert (
        _titleize("MINERAL WATERS, SOFT DRINKS AND JUICES")
        == "Mineral waters, soft drinks and juices"
    )
    assert _titleize("OILS & FATS") == "Oils and fats"


def test_parent_coicop_drops_only_the_last_dot_segment() -> None:
    assert _parent_coicop("01") is None
    assert _parent_coicop("01.1") == "01"
    assert _parent_coicop("01.1.1") == "01.1"
    assert _parent_coicop("08.2-3") == "08"
    assert _parent_coicop("05.3.1/2") == "05.3"


def test_build_registry_classifies_by_coicop_depth() -> None:
    catalog = _fixture_catalog()
    registry = build_registry(catalog, external=load_external())

    assert "GB.CPI" in registry.headline
    assert "GB.CPIH" in registry.headline
    assert "GB.CP01" in registry.divisions
    assert "GB.W01" in registry.weights
    assert "GB.CP01.1" in registry.subdivisions
    assert "GB.SW01.1" in registry.subdivision_weights
    assert "GB.CP08.2-3" in registry.subdivisions

    food = registry.subdivisions["GB.CP01.1"]
    assert food.coicop == "01.1"
    assert food.parent_coicop == "01"
    assert food.division_name == "Food"

    # CPIH-only entries never leak into the CPI-only division tree
    assert not any(s.coicop == "00" for s in registry.divisions.values())
