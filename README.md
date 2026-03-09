# CDF for Children Dashboard (Malawi)

Interactive planning dashboard for Constituency Development Fund (CDF) for Children analysis across Malawi, combining:
- budget allocations,
- GIS coverage and infrastructure metrics,
- institution counts,
- child hazard exposure metrics,
- print-ready reports and CSV exports.

## Child-Focused Data Definition
This dashboard prioritizes **child population (U18)** indicators from hazard extraction outputs for:
- child exposure mapping,
- funding normalization (`$ per child`),
- child-focused reporting and exports.

## Repository Contents
- `index.html`: primary dashboard page (multi-file mode).
- `style.css`: dashboard styles.
- `app.js`: all runtime logic (data loading, map behavior, panels, print/export generation).
- `build_standalone.py`: generates `CDF_Dashboard.html` with embedded data payloads.
- `CDF_Dashboard.html`: standalone single-file build output.

Core input datasets:
- `dashboard_data.json`: CDF budget by district and category.
- `01_Malawi_Districts_2025_Ward_Boundaries_simplified.geojson`: ward/constituency map geometry.
- `district_boundaries.geojson`: district outline geometries.
- `constituency_boundaries.geojson`: constituency outline geometries.
- `institutions.json`: institution point dataset (schools/HCFs/CBCCs).
- `gis_stats.json`: district GIS metrics (roads, waterways, etc.).
- `gis_stats_constituency.json`: constituency GIS metrics.
- `washways_district_risks_v3.csv`: district hazard outputs (current).
- `washways_constituency_risks_v3.csv`: constituency hazard outputs (current).

Reference scripts:
- `hazard_extraction_gee_reference.js`: GEE reference script used to generate hazard exports.

Documentation:
- `METHODOLOGY.md`: detailed methodology, assumptions, and data processing notes.
- `MINIMAL_REQUIREMENTS.md`: minimal runtime and file requirements for GitHub publication.
- `PUBLISH_TO_GITHUB.md`: step-by-step guide to publish minimal repo `MalawiCDF4Chidren`.

## Minimal Publish Target
If publishing to GitHub as `MalawiCDF4Chidren`, keep only the minimal dashboard files and data listed in:
- `MINIMAL_REQUIREMENTS.md`

Explicitly exclude:
- Excel workbooks (`*.xlsx`)
- raw large geometry source not used by runtime (`01_Malawi_Districts_2025_Ward_Boundaries.geojson`)
- local helper scripts used for one-off processing.

## Hazard Extraction Parameters (Current Reference)
From `hazard_extraction_gee_reference.js`:
- Analysis start date: `2020-01-01`
- Analysis end date (exclusive): `2025-02-01`
- Total analysis days: `1858`
- Wind exceedance threshold: `40 km/h`
- Rain exceedance threshold: `40 mm/day`
- Wind exceedance day tiers: `>=5`, `>=15`, `>=30` days over the analysis window
- Rain exceedance day tiers: `>=5`, `>=15`, `>=30` days over the analysis window
- River flood threshold: `0.01`
- Ag drought threshold: `30`
- SPEI threshold: `-1.5`
- SPI threshold: `-1.5`

## What the Dashboard Produces
1. Interactive map and filters:
- map coloring by total investment, `$ per child`, category amount, and category `$ per child`.
- map coloring by child hazard exposure using either counts (`#`) or percentages (`%`).
- wind/rain hazard map options include day-tiered exposure (`>=1`, `>=5`, `>=15`, `>=30` days).
- hazard indicators display the analysis basis first (period, wind/rain thresholds, day tiers).
- district and constituency boundary toggles.
- dynamic legends and tooltips tied to active map coloring mode.

2. District/constituency analytics panels:
- child population and infrastructure indicators.
- institution counts and densities.
- roads/waterways lengths and densities.
- child hazard exposure (`#` and `%`) by hazard type.

3. Print reports:
- Option 1: national + district.
- Option 2: national + district + constituency.
- Option 3: selected district only.
- includes summary maps, district/constituency tables, and hazard sections.

4. CSV exports:
- same 3 scopes as print options.
- includes infrastructure metrics plus full hazard output columns.

## Hazard Fields Included in App and Exports
For district and constituency rows:
- total children (`Children Total`)
- per hazard:
  - exposed children count (`#`)
  - exposed children percentage (`%`)

Hazard categories:
- river flood
- agricultural drought
- SPEI drought
- SPI drought
- any drought
- wind exceedance (`>=1 day`, `>=5 days`, `>=15 days`, `>=30 days`)
- rain exceedance (`>=1 day`, `>=5 days`, `>=15 days`, `>=30 days`)
- any exceedance
- any combined risk

## Build and Run
Local multi-file mode (recommended for active data updates):
```powershell
python -m http.server 8000
```
Then open `http://localhost:8000/index.html`.

Standalone build:
```powershell
python build_standalone.py
```
Output:
- `CDF_Dashboard.html`

Notes:
- Multi-file mode prefers live files and bypasses cache (`no-store`) in app fetches.
- Standalone embeds data snapshots at build time.
- For GEE hazard exports, run district and constituency separately if you hit capacity/timeouts, and keep debug sample prints disabled.
- `*_exceed_days_*` fields are day counts and should be within `0..1858` for the current analysis window.

## Data Matching Notes
Hazard rows are matched to dashboard entities using normalized district/constituency names:
- lowercase
- trimmed whitespace
- collapsed spaces

If duplicate normalized keys exist (for example spelling/case variants), records are merged:
- total children summed,
- hazard exposed counts summed,
- percentages recomputed from merged totals.

## Known Caveats
- Child-focused funding indicators use hazard child-population totals as the denominator.
- Legacy source population fields may still exist in raw source layers, but core map/export indicators are child-based.
- Constituency naming differences between sources can still create occasional mismatches despite normalization.
- Hazard CSVs are consumed as provided; upstream methodology changes should be reflected in docs and metadata fields.

## Related Documentation
- See `METHODOLOGY.md` for full processing flow and methodological assumptions.
- See `hazard_extraction_gee_reference.js` for the exact GEE reference code and export selectors.
