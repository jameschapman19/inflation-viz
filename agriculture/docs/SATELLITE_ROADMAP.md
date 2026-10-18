# Satellite crop and yield extension

The first pilot should cover one crop and one region with usable historical labels, for example UK wheat if regional yield and crop-label coverage are sufficient. Expand after spatial and season-held-out evaluation, rather than applying a global model without local validation.

## Two distinct capabilities

| Capability | Inputs and labels | Output | Evaluation |
| --- | --- | --- | --- |
| Crop classification | Sentinel-2 optical sequences, optional Sentinel-1 radar, independently labelled parcels/pixels, crop calendar | Crop probabilities, validated crop-area estimates, uncertainty and coverage | Per-class precision/recall, class imbalance, held-out regions/farms and seasons; area error against independent totals |
| Yield forecasting/nowcasting | Available vegetation/phenology summaries, weather, soil, crop identity, historic yield labels and validated harvested-area data | Yield by region/crop/harvest season, issue date, horizon and bands | MAE/RMSE in t/ha, coverage by lead time, held-out seasons and regions, baseline comparison |

Classification is a geospatial computer-vision task upstream of Nixtla. It is not a direct StatsForecast or TimeGPT image input. Crop probabilities and imagery summaries become time-indexed features for the forecast adapter. Use MLForecast for regional/seasonal time-series models with suitable labels and covariates; keep feature extraction and any classifier in their own modules. Annual targets need an explicit harvest-season/cadence contract instead of repeating a yearly label across months.

Yield and area also have distinct meanings. Production equals yield times harvested area on consistent geography and crop definitions. Classified planted area is not automatically harvested area. Regional yield aggregates require harvested-area weighting; yields and independent interval endpoints must not be summed. Any production forecast needs a validated area relationship and propagation of joint uncertainty.

## Data and compute

1. Discover acquisitions through STAC and pin collection/item IDs, acquisition times, processing versions, asset checksums, CRS, resolution and geography versions. Start with Sentinel-2 surface reflectance; add Sentinel-1 where optical gaps warrant it.
2. Mask cloud, shadow and invalid pixels. Save valid-area fraction, observation counts, compositing windows and missingness. Compute vegetation/phenology summaries and optional radar features. Never interpret a cloudy pixel as a low-yield observation.
3. Aggregate on documented parcel/grid/administrative boundaries and crop masks. Retain crop-calendar, harvest-season and geographic identifiers. Version feature extraction and label alignment with the immutable feature vintage.
4. Run imagery extraction in scheduled batch/container compute, with object storage for rasters and Parquet summaries. Keep large rasters and imagery processing outside Vercel and Git; publish only validated summaries and forecast outputs.

Public data availability is not enough: crop classification needs trustworthy labels, and yield forecasts need sufficiently granular yield outcomes. Check provider terms and label geography/definition compatibility when selecting the pilot.

## Availability contract and leakage controls

Long feature rows use `unique_id`, `ds`, `feature`, `value`, `available_at` (UTC) and `known_future` (boolean). Retain `source_id`, `geometry_id`, `season_id`, acquisition/composite start/end, processing version and coverage in the feature vintage manifest. `ds` describes the measured feature period; season alignment is an explicit adapter step after availability filtering.

The shared engine's `features_as_of` selects the latest revision actually available by issuance. Unobserved future measurements are excluded; genuinely known future covariates still require an availability timestamp. A satellite feature's availability is when its source and processing result were obtainable, not just the satellite overpass time. Later cloud-free composites, end-of-season crop labels and revised yield totals must not enter an earlier-origin fit. Published weather forecasts may enter as dated forecasts; realised future weather may not.

Build rolling evaluations from archived feature/label vintages. If historic processing availability cannot be reconstructed, label the study retrospective/revised-history. Include spatial buffers or held-out administrative regions as well as held-out years to address spatial autocorrelation. Keep model choice, interval calibration and final evaluation separate. Inspect seasonal, regional and crop coverage, not just a pooled headline score.

## Release gates

- Obtain a useful labelled pilot dataset and establish statistical/climatological yield baselines.
- Validate classification and feature extraction independently; quantify missing imagery and crop-area uncertainty.
- Freeze an issuance-aware feature vintage and evaluate yield predictions at several within-season lead times.
- Introduce a versioned annual/seasonal public contract and explicit map/chart units, provenance and coverage.
- Publish an experimental output-only PR with documented evaluation limitations; expand geography only after evidence supports it.

These are extension contracts and a roadmap. No crop classifier or satellite-derived yield forecast is deployed in the current release.
