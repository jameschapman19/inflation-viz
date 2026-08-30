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
