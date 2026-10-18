# Agriculture Radar: product and first-build proposal

Prepared 4 October 2026. This is a researched build proposal, not an implemented dashboard. The provisional recommendation is supply and prices; environmental impact and farm economics remain viable directions.

Build a public, source-transparent map of agricultural production and food-system exposure, paired with a private forecasting product. Start with wheat, maize, and rice at country level. The central question is: **Where does our food come from, what is changing there, and what could that mean for supply and prices?**

## What transfers from the existing projects

Reviewed the default branches of [inflation-viz](https://github.com/jameschapman19/inflation-viz) and [inflation-forecast](https://github.com/jameschapman19/inflation-forecast), including their source registry, storage schema, frontend types, model registry, reconciliation, and backtesting code. Reference heads were `13e44dd59250fa5e62b3b48bf4100e8db99d2578` and `c8d51b499e490ed30964b52605101f267eed5eb3` respectively.

| Existing pattern | Agriculture adaptation |
| --- | --- |
| Registry-driven ingestion, including live ONS discovery | Provider adapters plus country, commodity, metric, and unit registries |
| Immutable Parquet vintages with provenance | Preserve provider releases, retrieved raw files, checksums, and revision flags |
| Python pipeline → JSON → Next.js frontend | Same boundary; add geographic features and export only the selected crop/metric views |
| Public historical data; private forecasting methods | `agriculture-viz` publishes observations; `agriculture-forecast` consumes them and publishes selected forecast outputs |
| One-click source links and methodology | Sources on every map value and chart, with observation period and publication date visible |
| Model registry, forecast store, intervals, coverage metadata | Reuse the structure; choose new targets, frequencies, baselines, and aggregation rules |

The architecture transfers more readily than the ONS-specific adapters, CPI identifiers, and models. There is no need to create a general shared framework before the first agriculture slice works.

[Electricity Maps](https://github.com/electricitymaps/electricitymaps-contrib) contributes the geographic interaction, provider-by-provider ingestion model, and production-versus-consumption accounting idea. Its current contribution repository contains parsers; its current map frontend is not open source. An agriculture implementation would build its own interface and accounting logic.

## Three viable products

| Direction | Public map | Forecasting or paid extension | Main constraint |
| --- | --- | --- | --- |
| Supply and prices — recommended starting point | Production, yield trends, trade dependence, crop conditions, benchmark prices | Supply revisions, crop-year production forecasts, price scenarios, exposure alerts | Mixed calendars and frequencies; demonstrate value beyond existing dashboards |
| Environmental impact — closest to Electricity Maps' core metric | Commodity-specific emissions intensity, land use, and eventually water pressure | Sourcing scenarios and consumption-based footprint estimates | Commodity coverage, accounting boundaries, processing, and origin attribution |
| Farm economics — strong UK pilot | Farm-gate prices versus fertilizer, feed, energy, and other input prices | Commodity price outlooks and representative enterprise scenarios | Price indices alone do not establish farm margins |

For the public supply product, a useful distinction from existing services would be the connection between crop conditions, import exposure, and an auditable forecast. [GEOGLAM Crop Monitor](https://cropmonitor.org/) already publishes crop-condition maps and monthly reports; another crop map alone is a weak differentiation.

## Data feasibility checked

Read-only checks succeeded against the following sources. Full results and sample responses are in [source-checks.json](source-checks.json).

| Source | Useful data | Frequency and scope | What was checked |
| --- | --- | --- | --- |
| [FAOSTAT](https://www.fao.org/faostat/en/#data/QCL) | Production, harvested area, yields; separate trade, food balance, emissions, fertilizer, and land-use domains | Production and many structural measures are annual; coverage differs by domain, crop, and country | Public bulk catalogue, domain descriptions, downloadable file locations and sizes. Full production and trade files were not downloaded. |
| [World Bank commodity markets](https://www.worldbank.org/en/research/commodity-markets) | Crop, fertilizer, and energy benchmark prices | Monthly; benchmark specifications rather than each country's farm-gate prices | Downloaded and parsed the monthly workbook: historical prices from January 1960, latest populated price period September 2026. Handle missing cells and specification changes. |
| [USDA WASDE](https://www.usda.gov/oce/commodity/wasde) | Supply, use, stocks, and official projections | Monthly releases of annual crop/marketing-year estimates; region and commodity coverage varies | Release page, current XML links, and archive page containing release-specific CSV links. Individual release files were not parsed. |
| [NASA POWER](https://power.larc.nasa.gov/) | Temperature and precipitation history | Daily gridded data; availability lag and resolution must be respected | A real public API request returned five daily temperature and rainfall observations at one coordinate. No country aggregation or forecast endpoint was tested. |
| [DEFRA Agricultural Price Index](https://www.gov.uk/government/statistics/agricultural-price-indices) | Prices received and paid by UK farmers, by category | Monthly with publication lag; current base 2020 = 100 | Downloaded and parsed the CSV: columns `type`, `category`, `date`, `index`; latest rows July 2026, published 24 September 2026. |
| [GEOGLAM Crop Monitor](https://cropmonitor.org/) | Expert crop-condition assessments, calendars, and monitoring context | Monthly assessments and associated resources | Public site and reports confirmed. Machine-readable access and redistribution rights need verification before integration. |

These checks establish accessible inputs, not complete country/crop coverage or forecast accuracy. Preserve upstream observed/estimated/imputed flags. World Bank benchmark prices, producer prices, and retail CPI must remain distinct.

The FAOSTAT detailed trade matrix is approximately 411 MB compressed in the checked catalogue, with over 52 million rows. Filter and normalize it in the pipeline; never ship the full matrix to the browser.

## First working slice

Implement **wheat → country → production and yield history → benchmark price → source drawer** using FAOSTAT production and the verified World Bank workbook. This exercises ingestion, geography, units, vintages, exports, and the interface before adding trade or models.

The first public release would then add maize and rice, giving:

1. A crop selector, metric selector, year selector, and country map. Production is the default metric. Yield and change from a stated historical baseline are separate choices; grey means unavailable.
2. A country panel with production, harvested area, yield, share of world production, history, and source metadata. Use a consistent year and explicit missing-coverage handling for world shares.
3. A crop-level price panel with clearly named benchmark grades and locations. Do not paint a global reference price onto countries as if it were a local price.
4. A methodology page and downloadable observations. Every displayed number resolves to its provider release and any transformation.

Add import dependence and bilateral flows only after units, country histories, crop calendars, mirror discrepancies, and processed-product conversions are validated. Add USDA supply estimates and crop-specific weather exposure next. Environmental intensity can be a separate layer where its product coverage and boundaries are documented.

Display each layer's own reference period and publication date. A site refreshed today can still contain last year's production, last month's price, and recent weather. A refresh timestamp does not make every number a current observation.

## Data contract

Keep the familiar forecasting view `unique_id, ds, y`, but support it with richer observations and metadata:

```text
series: unique_id, geography_id, commodity_id, metric, unit,
        frequency, calendar_basis, benchmark_specification

observations: unique_id, period_start, period_end, crop_year,
              value, status_flag, provider_release_id

releases: provider_release_id, published_at, first_seen_at,
          retrieved_at, source_url, raw_file_hash, license

forecasts: run_id, unique_id, target_period, issued_at,
           data_cutoff, point, quantiles, coverage_status
```

Keep `published_at` unknown when the provider does not establish it. Archive retrieval timestamps separately. Crosswalk provider commodity and geography codes explicitly; distinguish sovereign countries, territories, historical countries, and provider aggregates. Avoid double-counting regional totals.

Prices need currency and grade/location definitions. Yields need compatible area and production units. Rice requires explicit paddy-versus-milled treatment. Crop-year estimates are not monthly output merely because USDA updates them monthly.

## Private forecasting product

Start with monthly crop benchmark price baselines; add crop-year supply forecasts when enough appropriate data is available. For each target, compare the proposed model against a meaningful naive baseline and the official USDA forecast where applicable. Publish an experimental model only with visible limitations until validation supports its intended use.

Retain the existing registry, append-only forecast runs, and public output boundary. Extend the data-cutoff contract so each historical evaluation uses the releases and covariates actually available at that cutoff. Downloading today's revised history and then running rolling cross-validation is not a historical information-set backtest. Preserve release archives where available; otherwise label evaluations as revised-history tests and collect vintages going forward.

Use weather anomalies only within the relevant growing season and crop-growing area. Country-centroid weather is adequate for an API smoke test, not a crop-risk model. Future weather regressors must come from archived forecast vintages or explicit scenarios.

Reconcile physical quantities only when definitions and units genuinely add. Regional wheat production can sum to a covered wheat total. Yields must be derived from total production and harvested area; prices and emissions intensities require appropriate weighting. Different crop tonnages do not produce a meaningful general food-supply index without an explicit conversion and purpose. Aggregate intervals must reflect dependence, rather than summing individual bounds.

Use errors appropriate to each target: MAE/RMSE or suitable scaled errors for points, pinball loss and empirical interval coverage for probabilistic forecasts. Do not blindly carry over MAPE gates for series that can be zero. Treat the existing 12-month horizon as an inflation design choice, not an agriculture default.

Potential paid users are food procurement teams, commodity researchers, and supply-risk teams. Buyer demand is a hypothesis to test. The clearest connection to Inflation Radar is agricultural commodity and input prices → food producer/import prices → retail food CPI, with exchange rates, processing, distribution, and lags explicitly modeled. A wheat-price forecast alone is not a food-inflation forecast.

## Environmental extension

FAOSTAT explicitly provides country-level greenhouse-gas emissions per kilogram for selected products, including rice, other cereals, meat, milk, and eggs. That supports a useful commodity-specific production-intensity layer.

Consumption-based attribution would be a further modeled product. It requires trade origins, re-exports, processing yields, stock changes, and aligned emissions boundaries. Food balance sheets distinguish food, feed, seed, processing, losses, and other uses; simple production plus imports minus exports is not household consumption. Water use also needs local scarcity context to describe impact rather than just volume.

The emissions accounting scope must be stated for each metric. Do not describe a farm-production factor as a complete food-system lifecycle footprint without the required evidence.

## Completion criteria for the first slice

- Production and price adapters run against actual provider files, with raw-file hashes and immutable releases.
- Map values use one selected crop, metric, and period with explicit units and missing states.
- Each displayed number is traceable to a source and documented transformation.
- Country and commodity crosswalks exclude provider aggregates and prevent duplicates.
- The JSON export is reproducible from a selected vintage; no sample or manually typed measurements ship as observations.
- Verification checks unit conversions, missing-versus-zero behavior, joins, and map/source agreement. The frontend builds successfully.
- Forecasts and trade-derived exposure are added only when their separate validation criteria are met.

This slice establishes the same source transparency as Inflation Radar while making agriculture's geographic and seasonal structure useful to the reader.
