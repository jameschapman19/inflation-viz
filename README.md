# inflation-viz

An open, radically source-transparent view of UK inflation: CPI/CPIH broken
into its 12 COICOP components, with every number one click from its ONS
source. This is Phase 1 of Inflation Radar — the public, open layer. The
reconciled forecasting product lives in the private `inflation-forecast`
repository; this repo never contains forecasting code or weighting logic,
only historical data and its visualization.

## What's here

- `sources.yaml` — the source registry. Every fetcher reads from this file;
  no CDID or URL is hardcoded anywhere else.
- `src/inflation_viz/fetch.py` — pulls each series from the ONS timeseries
  API and writes an immutable, timestamped vintage snapshot (never
  overwrites in place) with provenance stored alongside the values.
- `src/inflation_viz/weights.py` — resolves and parses the current CPI/CPIH
  basket weights workbook.
- `src/inflation_viz/refresh.py` — the one script that fetches everything
  and rebuilds the site: `uv run python -m inflation_viz.refresh`.
- `src/inflation_viz/site/` — Plotly + Jinja2 static site: headline,
  contributors (stacked ppt-contribution area), basket explorer (treemap),
  and methodology/sources.
- `src/inflation_viz/colors.py` — the one shared division-color mapping
  every chart imports; validated for colorblind-safe adjacency with the
  data-viz skill's palette validator.

## Running it

```bash
uv sync
uv run python -m inflation_viz.refresh          # fetch + build -> public/
uv run python -m inflation_viz.site.build        # rebuild from data/latest only
```

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy --strict
uv run pytest
```

## A note on this dev environment

The sandbox this repository was first built in has `ons.gov.uk` and
`api.ons.gov.uk` blocked by its network egress policy, so the fetcher could
not be exercised against live data there. It's covered by fixture-based
tests instead (`tests/fixtures/`), and `data/` starts empty — the scheduled
CI workflow (`.github/workflows/refresh.yml`), running on a GitHub-hosted
runner with unrestricted internet, is what actually populates it. If you're
running this somewhere with normal internet access, `uv run python -m
inflation_viz.refresh` will populate `data/` and `public/` for real.

The basket-weights scraper (`weights.py`) resolves its download link and
sheet layout from a best-effort reading of ONS's publishing conventions,
documented at the top of that file — it hasn't been checked against the
live page from this sandbox either, and may need a small adjustment the
first time it's run for real.

## Design notes

- **Point-in-time by construction.** `data/vintages/<timestamp>/` is
  write-once; `data/latest/` is a pointer to the newest vintage. This gives
  `inflation-forecast`'s backtesting a real point-in-time store to build on
  without a schema rewrite.
- **Country-namespaced `unique_id`s** (`GB.CP04`, not `CP04`) so adding a
  second country (Eurostat HICP, same COICOP classification) is additive.
- **No hand-edited chart data.** Every chart is built from `data/latest` and
  `sources.yaml` at build time; nothing is typed into a template or a
  fixture that ships as site content.

## License

MIT for the code. Data is Crown copyright, contains public sector
information licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
See `methodology.html` (or `sources.yaml`) for the license and source of
every individual series.
