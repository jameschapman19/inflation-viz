from inflation_viz.config import load_registry


def test_registry_has_twelve_divisions() -> None:
    registry = load_registry()
    assert len(registry.divisions) == 12
    coicop_codes = {s.coicop for s in registry.divisions.values()}
    assert coicop_codes == {f"{i:02d}" for i in range(1, 13)}


def test_registry_has_headline_series() -> None:
    registry = load_registry()
    assert "GB.CPI" in registry.headline
    assert "GB.CPIH" in registry.headline
    assert registry.headline["GB.CPI"].cdid == "D7G7"


def test_unique_ids_are_country_namespaced() -> None:
    registry = load_registry()
    for uid in registry.all_series:
        assert uid.startswith("GB."), f"{uid} is not namespaced by country"


def test_all_series_have_provenance_fields() -> None:
    registry = load_registry()
    for source in registry.all_series.values():
        assert source.source_url.startswith("https://www.ons.gov.uk/")
        assert source.license
        assert source.cadence == "monthly"


def test_divisions_sorted_is_coicop_order() -> None:
    registry = load_registry()
    ordered = [s.coicop or "" for s in registry.divisions_sorted()]
    assert ordered == sorted(ordered)


def test_registry_has_twelve_basket_weight_series() -> None:
    registry = load_registry()
    assert len(registry.weights) == 12
    coicop_codes = {s.coicop for s in registry.weights.values()}
    assert coicop_codes == {f"{i:02d}" for i in range(1, 13)}


def test_weights_sorted_is_coicop_order() -> None:
    registry = load_registry()
    ordered = [s.coicop or "" for s in registry.weights_sorted()]
    assert ordered == sorted(ordered)


def test_weight_series_are_distinct_from_contribution_series() -> None:
    """Weight CDIDs (e.g. CHZR) must not collide with the contribution
    series' unique_ids (GB.CP01) — they're deliberately namespaced GB.W01.
    """
    registry = load_registry()
    assert set(registry.weights).isdisjoint(registry.divisions)
    for uid in registry.weights:
        assert uid.startswith("GB.W")


def test_registry_has_group_level_subdivisions_for_every_division_except_education() -> None:
    """Coverage: every COICOP group ONS publishes a CPI rate+weight for,
    across all 12 divisions, plus a growing set of class-level (and
    5-digit subclass, where the class itself isn't separately published)
    breakdowns — see sources.yaml's `subdivisions:` header comment for
    what's been checked so far and why Education (10.x) and 04.2 are
    deliberately absent rather than guessed at any level.
    """
    registry = load_registry()
    coicop_codes = {s.coicop for s in registry.subdivisions.values()}
    assert coicop_codes == {s.coicop for s in registry.subdivision_weights.values()}
    assert len(coicop_codes) == 61
    # every division except Education (10) and (deliberately) housing's
    # CPIH-only 04.2 has at least one sub-division
    top_level_with_subdivisions = {c.split(".")[0] for c in coicop_codes if c}
    assert top_level_with_subdivisions == {
        "01",
        "02",
        "03",
        "04",
        "05",
        "06",
        "07",
        "08",
        "09",
        "11",
        "12",
    }
    assert "07.2.2" in coicop_codes  # the class-level entry nested under 07.2
    food_classes = {f"01.1.{i}" for i in range(1, 10)}
    assert food_classes <= coicop_codes  # Food's full class-level breakdown
    non_alcoholic_beverage_classes = {"01.2.1", "01.2.2"}
    assert non_alcoholic_beverage_classes <= coicop_codes
    alcohol_and_tobacco_classes = {"02.1.1", "02.1.2", "02.1.3", "02.2.0.1", "02.2.0.2"}
    assert alcohol_and_tobacco_classes <= coicop_codes


def test_subdivisions_sorted_is_coicop_order() -> None:
    registry = load_registry()
    ordered = [s.coicop or "" for s in registry.subdivisions_sorted()]
    assert ordered == sorted(ordered)


def test_subdivision_parent_coicop_matches_the_coicop_tree() -> None:
    registry = load_registry()
    for source in registry.subdivisions.values():
        assert source.parent_coicop is not None
        assert (source.coicop or "").startswith(source.parent_coicop)
    # 07.2.2 nests under the group 07.2, not directly under the division 07
    assert registry.subdivisions["GB.CP07.2.2"].parent_coicop == "07.2"
    assert registry.subdivisions["GB.CP07.1"].parent_coicop == "07"


def test_subdivision_series_are_distinct_from_division_and_weight_series() -> None:
    registry = load_registry()
    assert set(registry.subdivisions).isdisjoint(registry.divisions)
    assert set(registry.subdivision_weights).isdisjoint(registry.weights)
    for uid in registry.subdivision_weights:
        assert uid.startswith("GB.SW")


def test_external_placeholders_present() -> None:
    registry = load_registry()
    assert "ofgem_price_cap" in registry.external
    assert "fuel_prices" in registry.external


def test_series_api_urls_use_the_live_ons_endpoint_not_the_retired_v0_api() -> None:
    """ONS's old `api.ons.gov.uk` v0 timeseries API was fully retired in
    November 2024 with no direct replacement — a fetch against it 404s.
    The endpoint that's actually still live is the series' own
    www.ons.gov.uk page with `/data` appended (the JSON that powers the
    page's own chart). Guards against regressing to the dead host.
    """
    registry = load_registry()
    for source in registry.all_series.values():
        assert "api.ons.gov.uk" not in source.api_url
        assert source.api_url == f"{source.source_url}/data"
