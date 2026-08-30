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


def test_basket_weights_reference_table_present() -> None:
    registry = load_registry()
    assert "basket_weights" in registry.reference_tables


def test_external_placeholders_present() -> None:
    registry = load_registry()
    assert "ofgem_price_cap" in registry.external
    assert "fuel_prices" in registry.external
