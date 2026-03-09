# Minimal Requirements for `MalawiCDF4Chidren`

## Runtime requirements
- Python 3.9+ (for local static serving and standalone build)
- A modern browser (Chrome, Edge, Firefox)

## Required files in the repository
- `index.html`
- `style.css`
- `app.js`
- `README.md`
- `METHODOLOGY.md`
- `hazard_extraction_gee_reference.js`
- `build_standalone.py`
- `dashboard_data.json`
- `01_Malawi_Districts_2025_Ward_Boundaries_simplified.geojson`
- `district_boundaries.geojson`
- `constituency_boundaries.geojson`
- `gis_stats.json`
- `gis_stats_constituency.json`
- `institutions.json`
- `washways_district_risks_v3.csv`
- `washways_constituency_risks_v3.csv`

## Files to exclude
- All Excel workbooks (`*.xlsx`)
- Large raw geometry source not used by app:
  - `01_Malawi_Districts_2025_Ward_Boundaries.geojson`
- Local helper/inspection scripts not required to run dashboard:
  - `inspect_*.py`
  - `prepare_data.py`
  - `process_institutions.py`
  - `simplify_geojson.py`
  - `fetch_osm_stats.py`

## Run locally
```powershell
python -m http.server 8000
```
Open `http://localhost:8000/index.html`.

## Optional standalone build
```powershell
python build_standalone.py
```

