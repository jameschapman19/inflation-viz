# Agriculture Radar

An implemented first release of the [build brief](docs/BRIEF.md): a country map of wheat, maize, and rice production, yields, changes from the preceding five-year mean, country histories, monthly traded benchmark prices, source drawers, downloads, and methodology. Experimental six-month price outputs come from the separate `agriculture-forecast` project.

The data is real: FAOSTAT QCL production through 2024 and World Bank monthly prices through September 2026 in the initial snapshot. No hand-entered measurements or demo fixtures ship as observations.

Production: [agriculture-radar-omega.vercel.app](https://agriculture-radar-omega.vercel.app), hosted on the same Vercel team as Inflation Radar.

## Structure

- `sources.yaml`: provider, commodity, metric, unit, and flag registry.
- `src/agriculture_viz/pipeline.py`: provider downloads, normalization, immutable vintages, crosswalks, and reproducible exports.
- `data/raw/`: retained provider files and SHA-256 release records; ignored by git. Back up this directory separately for long-term raw-file retention.
- `data/vintages/<timestamp>/`: immutable normalized Parquet, release metadata, and simplified geography, tracked in source.
- `data/latest.json`: selected vintage pointer.
- `data/forecast/`: public-safe forecast outputs only.
- `web/`: Next.js frontend; browser reads generated `public/data/` files.
- `.github/workflows/ci.yml`: Python lint, formatting, strict typing, tests, and web lint/build.
- `.github/workflows/refresh.yml`: daily 08:00 UTC and manual provider-data refresh with audited raw-file artifacts.

## Run

```sh
uv sync
uv run python -m agriculture_viz.pipeline
cd web
npm ci
npm run dev
```

To use retained provider files without accessing the network:

```sh
uv run python -m agriculture_viz.pipeline --cached
```

To reproduce the browser export from a particular immutable vintage:

```sh
uv run python -m agriculture_viz.pipeline --export-vintage <vintage-name>
```

The latter does not change `data/latest.json`; it changes the selected frontend export. For development environments with read-only home directories, use `UV_CACHE_DIR=/tmp/agriculture-uv-cache` and `npm_config_cache=/tmp/agriculture-npm-cache` per command.

## Check and build

```sh
uv run pytest
uv run ruff check src tests
uv run ruff format --check src tests
uv run mypy --strict
cd web
npm run lint
npm run check
cd ..
node scripts/build.mjs
```

The build uses native Next.js output in `web/.next/`, matching `inflation-viz`. Vercel serves the generated routes and public data files. Browser checks during implementation covered all three crop selectors, China/provider value agreement, missing UK maize observations, year/layer selection, source dialog Escape behavior, CSV contents, the forecast toggle, methodology, and a 390px viewport.

## Deploy on Vercel

Agriculture Radar follows the sister project's deployment design: public `agriculture-viz`, private `agriculture-forecast`, and Vercel's native GitHub integration for the visualization's `main` branch. See [deployment comparison and setup status](docs/DEPLOYMENT.md).

The Vercel project is `agriculture-radar` in `jameschapman19s-projects`, the same team as Inflation Radar. It is connected to the public GitHub repository: pushes to `main` release production, and other branches receive previews.

The repositories are [agriculture-viz](https://github.com/jameschapman19/agriculture-viz) (public) and [agriculture-forecast](https://github.com/jameschapman19/agriculture-forecast) (private). The existing Vercel project uses these settings:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root Directory | `web` |
| Install Command | Automatic (package lockfile) |
| Build Command | Automatic (`package.json` build script) |
| Output Directory | Next.js default (leave unset) |
| Node.js | 24.x on Vercel; 22 in CI, matching Inflation Radar |
| Production Branch | `main` |

The Vercel build uses committed observations and needs no provider credentials or Python runtime. `agriculture-forecast` is a private data pipeline and is not a separate Vercel frontend. Keep the two GitHub repositories separate so forecast methods and evaluation details never enter the frontend build.

For an authenticated CLI:

```sh
npx vercel link --project agriculture-radar --scope jameschapman19s-projects
npx vercel deploy --prod --scope jameschapman19s-projects
```

Project linking selects the owning Vercel team/project. The `.vercel` identity files are ignored by git. Credentials must stay in your Vercel account or secret store.

## Refreshing and forecasts

The site reads a reproducible data snapshot. Vercel rebuilds it whenever `main` receives a commit and creates previews for other branches. The observation workflow runs daily at 08:00 UTC, matching `inflation-viz`, and can also be triggered manually. Both workflows are registered on GitHub's default branch.

Forecasts use the private project's manual **Publish forecast** workflow, matching `inflation-forecast`. It stores full run details privately and opens an output-only PR against this repository. Merging that PR releases the forecast through Vercel. Configure `AGRICULTURE_VIZ_PUSH_TOKEN` in the private repository's Actions secrets with contents and pull-request write access to the visualization repository. No forecast schedule or Vercel deploy token is needed.

The forecasting project reads normalized observations; it does not import this project's code. Public exports omit coefficients, model-selection scores, candidate forecasts, and calibration details. The private source is not bundled into the Vercel deployment.

## Accounting and quality

- Country/territory identifiers use UN M49 to current ISO alpha-3 crosswalks. Provider aggregates and retired geographies are excluded, preventing the China aggregate from duplicating mainland and territory values.
- Missing observations stay missing. A reported zero remains zero. All five prior years and a positive mean are required for the production-change layer.
- Yield is normalized to tonnes per hectare from `kg/ha`, `hg/ha`, or `t/ha`; unknown units stop the run.
- Rice production is paddy; its price benchmark is milled rice. No price-times-production revenue inference is made.
- Production share is a share of covered country/territory observations in the same crop/year, not a claim of complete official world coverage.
- World Bank dates and prices retain historical specification changes. Publication dates are distinct from first retrieval. Unknown dates remain unknown.
- The map's Natural Earth 1:110m boundaries do not show every small territory; all crosswalked production countries remain in the country selector.
- Forecasts are experimental revised-history evaluations. Target-level undercoverage flags are visible when appropriate; future coverage is not guaranteed.

## Deliberately later in the brief

Bilateral trade, import dependence, USDA crop-year supply estimates, crop-area-weighted weather exposure, environmental footprints, and food-CPI pass-through need their own adapters and accounting validation. These are documented extensions, not inferred metrics in this release.

## Licences

Code: MIT, see `LICENSE`. Data rights remain with the providers and are recorded per release; consult the linked FAO and World Bank terms and commodity-specific third-party attribution. Natural Earth boundaries are public domain. This code licence does not relicense provider data.

## Shared Radar foundations

The sister projects share pinned `radar-contracts` releases and brand assets; both private forecast projects use the same Nixtla `radar-forecast` package. Domain adapters preserve their own targets, transforms and hierarchy rules. See the [shared architecture](https://github.com/jameschapman19/agriculture-viz/blob/main/docs/SHARED_ARCHITECTURE.md) and [satellite extension roadmap](https://github.com/jameschapman19/agriculture-viz/blob/main/docs/SATELLITE_ROADMAP.md).
