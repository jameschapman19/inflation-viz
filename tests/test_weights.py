from pathlib import Path

import requests
import responses

from inflation_viz.config import ReferenceTableSource
from inflation_viz.weights import (
    parse_weights_workbook,
    resolve_weights_download_url,
)

FIXTURES = Path(__file__).parent / "fixtures"


def sample_reference_table() -> ReferenceTableSource:
    return ReferenceTableSource(
        key="basket_weights",
        name="CPI and CPIH basket weights",
        source_name="Office for National Statistics",
        source_url="https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/consumerpriceinflation",
        license="Open Government Licence v3.0",
        cadence="annual",
        notes="",
    )


@responses.activate
def test_resolve_weights_download_url_finds_link() -> None:
    source = sample_reference_table()
    html = (FIXTURES / "ons_weights_page.html").read_text()
    responses.add(responses.GET, source.source_url, body=html, status=200)

    with requests.Session() as session:
        url = resolve_weights_download_url(source, session)

    assert url.endswith("weights2026.xlsx")
    assert url.startswith("https://www.ons.gov.uk")


def test_parse_weights_workbook_returns_twelve_divisions() -> None:
    content = (FIXTURES / "ons_weights_workbook.xlsx").read_bytes()
    weights = parse_weights_workbook(content)

    assert len(weights) == 12
    coicop_codes = {w.coicop for w in weights}
    assert coicop_codes == {f"{i:02d}" for i in range(1, 13)}
    transport = next(w for w in weights if w.coicop == "07")
    assert transport.weight_per_mille == 138.2
