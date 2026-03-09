# Publish Minimal Repo to GitHub (`MalawiCDF4Chidren`)

## 1) Build the minimal folder
From project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\prepare_minimal_release.ps1
```

This creates:
- `release/MalawiCDF4Chidren/`

## 2) Create GitHub repository
Create a new repository on GitHub named:
- `MalawiCDF4Chidren`

## 3) Upload minimal files
Upload contents of:
- `release/MalawiCDF4Chidren/`

Do not upload the parent `release` folder itself unless you want that structure in GitHub.

## 4) Verify repository contents
Confirm these are present:
- `index.html`, `style.css`, `app.js`
- `dashboard_data.json`, simplified/district/constituency geojson files
- `institutions.json`, `gis_stats*.json`
- `washways_*_risks_v4.csv`
- docs (`README.md`, `METHODOLOGY.md`, `MINIMAL_REQUIREMENTS.md`)

## 5) Run from GitHub clone
```powershell
python -m http.server 8000
```
Open `http://localhost:8000/index.html`.
