# Methodology

This document describes the end-to-end method used to produce and integrate hazard and planning analytics in the Malawi CDF for Children dashboard.

## 1) Scope and Intent
The dashboard combines planning and risk data to support district and constituency decision-making:
- CDF allocations and category totals.
- Child-population-linked planning indicators.
- Infrastructure and service access proxies (roads, waterways, institutions).
- Child hazard exposure from raster-based geospatial analysis.

## 2) Population Definition (Primary)
- **Child population (U18)**:
  - source: hazard workflow raster `WorldPop_Con_T_U18`.
  - used in: hazard exposure counts/percentages and child-normalized funding indicators (`$ per child`).
- Legacy source-population fields can still appear in upstream layers, but dashboard map/export indicators are child-focused.

## 3) Hazard Generation Pipeline (GEE Reference)
Reference code:
- `hazard_extraction_gee_reference.js`

Administrative units:
- `projects/washways/assets/districts`
- `projects/washways/assets/constituencies`

### 3.1 Analysis Parameters (Current)
- Analysis start date: `2020-01-01`
- Analysis end date (exclusive): `2025-02-01`
- Wind threshold: `40 km/h`
- Rain threshold: `40 mm/day`
- Wind exceedance day tiers: `>=5`, `>=15`, `>=30`
- Rain exceedance day tiers: `>=5`, `>=15`, `>=30`
- River flood threshold: `0.01`
- Agricultural drought threshold: `30`
- SPEI drought threshold: `-1.5`
- SPI drought threshold: `-1.5`
- Exceedance scale: `10,000 m` (quick mode)
- Hazard scale: `1,000 m`
- Population reduction scale: `100 m` (kept fixed for stable child exposure denominators)
- Tile scale: `8` (quick mode default)

### 3.2 Input Layers
- Child population:
  - `projects/unicef-ccri/assets/misc_population/WorldPop_Con_T_U18`
- River flood:
  - `projects/unicef-ccri/assets/hazards/river_flood_r100`
- Drought:
  - `projects/unicef-ccri/assets/hazards/ASI_return_level_100yr`
  - `projects/unicef-ccri/assets/droughts/drought_spei_copernicus_1940_2024`
  - `projects/unicef-ccri/assets/droughts/drought_spi_copernicus_1940_2024`
- Weather:
  - `ECMWF/ERA5_LAND/HOURLY`

### 3.3 Processing Flow
1. Geometry preparation:
- clean feature geometry using `buffer(0)` and bbox intersection.
- derive stable IDs:
  - district: `DistrictNa`
  - constituency: `DistrictNa||ConstiName`

2. ERA5 exceedance derivation:
- calculate daily wind exceedance from max hourly wind magnitude (U/V components).
- calculate daily rain exceedance from daily sum of hourly precipitation.
- aggregate daily flags to monthly totals.
- sum monthly totals over full analysis period.

3. Hazard mask construction:
- river flood mask.
- ag drought mask.
- SPEI drought mask.
- SPI drought mask.
- wind exceedance masks:
  - `wind_era5_exceed_days > 0` (legacy baseline)
  - `wind_era5_exceed_days >= 5`
  - `wind_era5_exceed_days >= 15`
  - `wind_era5_exceed_days >= 30`
- rain exceedance masks:
  - `rain_era5_exceed_days > 0` (legacy baseline)
  - `rain_era5_exceed_days >= 5`
  - `rain_era5_exceed_days >= 15`
  - `rain_era5_exceed_days >= 30`
- combined masks:
  - `drought_any`
  - `any_exceed` (wind or rain exceedance)
  - `any_risk` (flood or drought_any or any_exceed)

4. Exposure derivation:
- apply each mask to child population raster.
- compute per-hazard exposed child counts.
- compute per-hazard exposed percentages against `child_population`.
- compute masked area (km2) where relevant.

5. Region reduction and merge:
- reduce rasters to district and constituency boundaries.
- attach hazard intensity stats (`mean`, `min`, `max`, `p10`, `p90`) for selected layers.
- attach exceedance summary stats.
- export district and constituency tables.

### 3.4 GEE Output Tables
Primary exported files:
- `washways_district_risks_v4.csv` (current)
- `washways_constituency_risks_v4.csv` (current)

Selected output columns include:
- `child_population`
- `*_exposed_children`
- `*_exposed_children_pct`
- `*_affected_km2`
- exceedance diagnostics:
  - `wind_era5_exceed_days_mean`, `wind_era5_exceed_days_max`, `wind_era5_exceed_days_p90`
  - `rain_era5_exceed_days_mean`, `rain_era5_exceed_days_max`, `rain_era5_exceed_days_p90`
- tier metadata:
  - `wind_exceed_days_tier_1/2/3`
  - `rain_exceed_days_tier_1/2/3`
- thresholds and metadata:
  - `analysis_start`
  - `analysis_end_exclusive`
  - `wind_threshold_kmh`
  - `rain_threshold_mm_day`
  - drought/flood thresholds

## 4) Dashboard Data Integration
Integration logic in `app.js`:
- load hazard CSVs in multi-file mode.
- load embedded hazard indexes in standalone mode.
- normalize district and constituency names for key matching.
- merge duplicate normalized keys by:
  - summing total children,
  - summing hazard exposed counts,
  - recomputing percentages from merged totals.

## 5) In-Product Usage
Hazard outputs are exposed in:
- district info panel:
  - total children + hazard-specific exposure (`#`, `%`).
- constituency info panel:
  - total children + hazard-specific exposure (`#`, `%`).
- map coloring mode:
  - hazard-specific child exposure as count (`#`) or percent (`%`),
  - district or constituency level,
  - including wind/rain day-tier variants (`>=1`, `>=5`, `>=15`, `>=30` days).
  - indicators include analysis basis text first: period, thresholds, and day-tier settings.
- print reports:
  - scope-level hazard summary,
  - district hazard section,
  - constituency hazard section.
- CSV export:
  - district and constituency rows include full hazard columns.

## 6) Export and Reporting Method
Report modes:
- national + district,
- national + district + constituency,
- selected district.

Each report integrates:
- financial allocation metrics,
- child population and service/infrastructure indicators,
- child hazard exposure indicators.

CSV export schema includes:
- planning metrics (population/infrastructure/budget),
- appended hazard columns (`children total`, per-hazard `#`, per-hazard `%`).

## 7) Interpretation Guidance
- Hazard percentages are child-population based and should be read as child exposure rates.
- Funding normalization metrics in map/export (`$ per child`) use child-population denominators.

## 8) Limitations and Quality Notes
- Name differences across sources can still cause occasional mismatches.
- Hazard exposure quality depends on raster resolution, thresholds, and source model assumptions.
- Quick mode exceedance scale (`10 km`) is optimized for runtime; finer runs may alter local detail.
- Duplicate constituency labels can occur in input hazard CSVs and are merged by normalized key.

## 9) Reproducibility Checklist
1. Confirm GEE parameters (dates, thresholds, scales).
2. Run hazard extraction in GEE and export both CSV files.
   - if capacity errors occur, run district and constituency exports separately using:
     - `RUN_DISTRICT_EXPORT = true`, `RUN_CONSTITUENCY_EXPORT = false`, then swap.
   - keep `DEBUG_PRINT_SAMPLES = false` for export runs.
3. Replace local hazard CSV files in repo root.
4. Run dashboard in multi-file mode or rebuild standalone:
   - `python build_standalone.py`
5. Validate one district and one constituency:
   - side panel hazard values,
   - print report hazard sections,
   - CSV hazard columns.
