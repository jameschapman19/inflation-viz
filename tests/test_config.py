from inflation_viz.config import SourceRegistry, load_context, load_external


def test_registry_has_twelve_divisions(registry: SourceRegistry) -> None:
    assert len(registry.divisions) == 12
    coicop_codes = {s.coicop for s in registry.divisions.values()}
    assert coicop_codes == {f"{i:02d}" for i in range(1, 13)}


def test_registry_has_headline_series(registry: SourceRegistry) -> None:
    assert "GB.CPI" in registry.headline
    assert "GB.CPIH" in registry.headline
    assert registry.headline["GB.CPI"].cdid == "D7G7"


def test_unique_ids_are_country_namespaced(registry: SourceRegistry) -> None:
    for uid in registry.all_series:
        assert uid.startswith("GB."), f"{uid} is not namespaced by country"


def test_all_series_have_provenance_fields(registry: SourceRegistry) -> None:
    for source in registry.all_series.values():
        assert source.source_url.startswith("https://www.ons.gov.uk/")
        assert source.license
        assert source.cadence == "monthly"


def test_divisions_sorted_is_coicop_order(registry: SourceRegistry) -> None:
    ordered = [s.coicop or "" for s in registry.divisions_sorted()]
    assert ordered == sorted(ordered)


def test_registry_has_twelve_basket_weight_series(registry: SourceRegistry) -> None:
    assert len(registry.weights) == 12
    coicop_codes = {s.coicop for s in registry.weights.values()}
    assert coicop_codes == {f"{i:02d}" for i in range(1, 13)}


def test_weights_sorted_is_coicop_order(registry: SourceRegistry) -> None:
    ordered = [s.coicop or "" for s in registry.weights_sorted()]
    assert ordered == sorted(ordered)


def test_weight_series_are_distinct_from_contribution_series(registry: SourceRegistry) -> None:
    """Weight CDIDs (e.g. CHZR) must not collide with the contribution
    series' unique_ids (GB.CP01) — they're deliberately namespaced GB.W01.
    """
    assert set(registry.weights).isdisjoint(registry.divisions)
    for uid in registry.weights:
        assert uid.startswith("GB.W")


def test_registry_discovers_sub_divisions_at_every_coicop_depth(registry: SourceRegistry) -> None:
    """No fixed count to assert — in production, coverage is whatever ONS
    currently publishes. This checks classification reaches every depth
    and handles ONS's combined/collapsed codes, per the fixture's tree
    (01 -> 01.1 -> 01.1.1, plus the combined groups 08.2-3 and 05.3.1/2).
    """
    coicop_codes = {s.coicop for s in registry.subdivisions.values()}
    assert coicop_codes == {s.coicop for s in registry.subdivision_weights.values()}
    assert {"01.1", "01.1.1", "08.2-3", "05.3.1/2"} <= coicop_codes


def test_subdivisions_sorted_is_coicop_order(registry: SourceRegistry) -> None:
    ordered = [s.coicop or "" for s in registry.subdivisions_sorted()]
    assert ordered == sorted(ordered)


def test_subdivision_parent_coicop_matches_the_coicop_tree(registry: SourceRegistry) -> None:
    for source in registry.subdivisions.values():
        assert source.parent_coicop is not None
        assert (source.coicop or "").startswith(source.parent_coicop)
    # 01.1.1 nests under the group 01.1, not directly under the division 01
    assert registry.subdivisions["GB.CP01.1.1"].parent_coicop == "01.1"
    assert registry.subdivisions["GB.CP01.1"].parent_coicop == "01"
    # ONS's own combined/collapsed series nest under their real parent
    # depth regardless of what separator it uses within its own trailing
    # segment ("-" for a group combined under a division, "/" for classes
    # combined under a group).
    assert registry.subdivisions["GB.CP08.2-3"].parent_coicop == "08"
    assert registry.subdivisions["GB.CP05.3.1/2"].parent_coicop == "05.3"


def test_subdivision_series_are_distinct_from_division_and_weight_series(
    registry: SourceRegistry,
) -> None:
    assert set(registry.subdivisions).isdisjoint(registry.divisions)
    assert set(registry.subdivision_weights).isdisjoint(registry.weights)
    for uid in registry.subdivision_weights:
        assert uid.startswith("GB.SW")


def test_external_placeholders_present() -> None:
    external = load_external()
    assert "ofgem_price_cap" in external
    assert "fuel_prices" in external


def test_context_series_present_and_wired_like_any_other_ons_series() -> None:
    context = load_context()
    assert "GB.WAGE.REAL" in context
    wage = context["GB.WAGE.REAL"]
    assert wage.cdid == "A2FA"
    assert wage.dataset == "lms"
    assert wage.source_url == (
        "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/"
        "earningsandworkinghours/timeseries/a2fa/lms"
    )
    assert wage.api_url == f"{wage.source_url}/data"


def test_registry_includes_context_series_in_all_series(registry: SourceRegistry) -> None:
    assert "GB.WAGE.REAL" in registry.context
    assert "GB.WAGE.REAL" in registry.all_series


def test_series_api_urls_use_the_live_ons_endpoint_not_the_retired_v0_api(
    registry: SourceRegistry,
) -> None:
    """ONS's old `api.ons.gov.uk` v0 timeseries API was fully retired in
    November 2024 with no direct replacement — a fetch against it 404s.
    The endpoint that's actually still live is the series' own
    www.ons.gov.uk page with `/data` appended (the JSON that powers the
    page's own chart). Guards against regressing to the dead host.
    """
    for source in registry.all_series.values():
        assert "api.ons.gov.uk" not in source.api_url
        assert source.api_url == f"{source.source_url}/data"
