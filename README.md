# inflation-viz

An open, radically source-transparent view of UK inflation: CPI/CPIH broken
into its 12 COICOP components, with every number one click from its ONS
source. This is Phase 1 of Inflation Radar — the public, open layer. The
reconciled forecasting product lives in the private `inflation-forecast`
repository; this repo never contains forecasting code or weighting logic,
only published observations, forecast outputs, and their visualization.

Forecast outputs are currently visible alongside published data. Forecasting
code, model choices, features, calibration, and backtest reports stay in the
private repository. `src/inflation_viz/forecast.py` validates the public JSON
contract and discards fields outside it before producing frontend data.

Energy and road-fuel observations are also published under
`data/drivers/vintages/<retrieval timestamp>/`. Each snapshot contains
`observations.parquet` and a schema-versioned `manifest.json`. The archive
includes ONS gas/electricity/motor-fuel price indices and basket weights,
DESNZ weekly petrol/diesel pump prices, and Ofgem average Direct Debit unit
rates and standing charges for Great Britain.

Rows retain their observation/effective date, effective end date where
applicable, value, unit, source, reuse terms, publication timestamp where
the source supplies one, and retrieval timestamp. Publication dates are
not reconstructed from a presumed release schedule. For revision-safe
historical use, **both the containing snapshot and its retrieval time must
precede the decision time**; an old publication date alone does not make a
newly retrieved revision historically available.

The daily refresh collects these observations after the main site export;
a Tuesday 10:00 UTC collector follows the weekly fuel-price release.
Individual source failures are logged in the new snapshot's manifest;
failed sources are omitted rather than copied forward as fresh data. If all
driver sources fail, the main CPI refresh still completes. Run this collector
independently with `uv run python -m inflation_viz.drivers`.

Two halves, split at a JSON boundary:

- **Python data pipeline** (`src/inflation_viz/`) — fetches every series
  from ONS, stores it as an immutable, provenance-tracked flat-file vintage,
  and exports it to JSON.
- **Next.js frontend** (`web/`) — a statically-generated site (headline,
  contributors, basket explorer, methodology) that reads that JSON at build
  time. Deployed on Vercel, redeployed automatically whenever the data
  pipeline commits fresh data to `main`.

## What's here

- `sources.yaml` — the registry for external references and selected non-CPI
  context series. CPI CDIDs are discovered live from ONS's bulk dataset titles.
  Headline rates, the 12 COICOP
  division contribution series, and the 12 division basket-weight series are
  all plain ONS CDIDs fetched the same way — no scraping.
- `src/inflation_viz/fetch.py` — pulls each series from ONS's timeseries
  JSON and writes an immutable, timestamped vintage snapshot (never
  overwrites in place) with provenance stored alongside the values. Handles
  monthly, quarterly, and annual series alike (the basket weights are
  annual — ONS republishes the same figure every month in the "months"
  array is empty for them; the real observations live under "years").
- `src/inflation_viz/export.py` — converts `data/latest` + `sources.yaml`
  into the JSON the Next.js app reads (`web/src/data/`). This is the one
  boundary between the pipeline and the frontend.
- `data/forecast/` — published forecast runs and the latest output. Schema v2
  exposes issue time, data vintage, observation cutoff, horizon, confidence
  levels, division coverage, and forecast points. The site consumes results
  through this contract; legacy v1 inputs are normalized when exporting.
- `src/inflation_viz/refresh.py` — the one script that fetches everything
  and exports it: `uv run python -m inflation_viz.refresh`.
- `src/inflation_viz/colors.py` / `web/src/lib/colors.ts` — the shared
  division-color mapping every chart uses, validated for colorblind-safe
  adjacency with the data-viz skill's palette validator. Kept in sync by
  hand across the Python/TypeScript boundary (same pattern
  `inflation-forecast` uses for its own cross-repo duplication).

## Running it

```bash
uv sync
uv run python -m inflation_viz.refresh   # fetch ONS data -> data/, export -> web/src/data/
```

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy --strict && uv run pytest
```

```bash
cd web
npm install
npm run dev     # http://localhost:3000, reads web/src/data/*.json
npm run build   # what CI and Vercel run
npm run lint
```

## A note on this dev environment

The sandbox this repository was first built in has `ons.gov.uk` blocked by
its network egress policy, so the fetcher couldn't be exercised against
live data there. It's covered by fixture-based tests instead
(`tests/fixtures/`) — the scheduled CI workflow
(`.github/workflows/refresh.yml`), running on a GitHub-hosted runner with
unrestricted internet, is what actually populates `data/` and
`web/src/data/`.

## Design notes

- **Point-in-time by construction.** `data/vintages/<timestamp>/` is
  write-once; `data/latest/` is a pointer to the newest vintage. This gives
  `inflation-forecast`'s backtesting a real point-in-time store to build on
  without a schema rewrite.
- **Country-namespaced `unique_id`s** (`GB.CP04`, not `CP04`) so adding a
  second country (Eurostat HICP, same COICOP classification) is additive.
- **No hand-edited chart data.** Every chart reads from `web/src/data/*.json`
  at build time, which is generated from `data/latest` and `sources.yaml`;
  nothing is typed into a component or a fixture that ships as site content.

## License

MIT for the code. Data is Crown copyright, contains public sector
information licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
See the methodology page (or `sources.yaml`) for the license and source of
every individual series.

## Shared Radar foundations

The sister projects share pinned `radar-contracts` releases and brand assets; both private forecast projects use the same Nixtla `radar-forecast` package. Domain adapters preserve their own targets, transforms and hierarchy rules. See the [shared architecture](https://github.com/jameschapman19/agriculture-viz/blob/main/docs/SHARED_ARCHITECTURE.md) and [satellite extension roadmap](https://github.com/jameschapman19/agriculture-viz/blob/main/docs/SATELLITE_ROADMAP.md).
