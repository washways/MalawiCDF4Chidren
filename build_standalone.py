import json
import os
import csv

HAZARD_METRICS = [
    'river_flood',
    'ag_drought',
    'spei_drought',
    'spi_drought',
    'drought_any',
    'wind_era5',
    'wind_era5_ge5d',
    'wind_era5_ge15d',
    'wind_era5_ge30d',
    'rain_era5',
    'rain_era5_ge5d',
    'rain_era5_ge15d',
    'rain_era5_ge30d',
    'any_exceed',
    'any_risk'
]

def to_number(value):
    try:
        n = float(value)
        if n != n:  # NaN
            return 0.0
        return n
    except (TypeError, ValueError):
        return 0.0

def normalize_name(name):
    return " ".join(str(name or "").strip().lower().split())

def constituency_key(district_name, constituency_name):
    return f"{normalize_name(district_name)}||{normalize_name(constituency_name)}"

def derive_total_children(row):
    child_population = to_number(row.get('child_population'))
    if child_population > 0:
        return child_population

    for metric in HAZARD_METRICS:
        count = to_number(row.get(f'{metric}_exposed_children'))
        pct = to_number(row.get(f'{metric}_exposed_children_pct'))
        if count > 0 and pct > 0:
            return (count * 100.0) / pct
    return 0.0

def parse_hazard_csv(path, level):
    if not os.path.exists(path):
        return {}

    out = {}
    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            district_name = row.get('district_name') or row.get('feature_uid') or ''
            constituency_name = row.get('constituency_name') or ''
            hazards = {}
            for metric in HAZARD_METRICS:
                hazards[metric] = {
                    'count': to_number(row.get(f'{metric}_exposed_children')),
                    'pct': to_number(row.get(f'{metric}_exposed_children_pct'))
                }

            payload = {
                'districtName': district_name,
                'constituencyName': constituency_name,
                'totalChildren': derive_total_children(row),
                'hazards': hazards
            }

            def merge(existing, incoming):
                if not existing:
                    return incoming
                merged = {
                    'districtName': existing.get('districtName') or incoming.get('districtName'),
                    'constituencyName': existing.get('constituencyName') or incoming.get('constituencyName'),
                    'totalChildren': to_number(existing.get('totalChildren')) + to_number(incoming.get('totalChildren')),
                    'hazards': {}
                }
                for metric in HAZARD_METRICS:
                    count = to_number(existing.get('hazards', {}).get(metric, {}).get('count')) + to_number(incoming.get('hazards', {}).get(metric, {}).get('count'))
                    pct = (count / merged['totalChildren'] * 100.0) if merged['totalChildren'] > 0 else 0.0
                    merged['hazards'][metric] = {'count': count, 'pct': pct}
                return merged

            if level == 'district':
                key = normalize_name(district_name)
                out[key] = merge(out.get(key), payload)
            else:
                key = constituency_key(district_name, constituency_name)
                out[key] = merge(out.get(key), payload)

    return out

def parse_hazard_context(path):
    if not os.path.exists(path):
        return {}

    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        first = next(reader, None)
        if not first:
            return {}
        return {
            'analysisStart': first.get('analysis_start') or '2020-01-01',
            'analysisEndExclusive': first.get('analysis_end_exclusive') or '2025-02-01',
            'windThresholdKmh': to_number(first.get('wind_threshold_kmh')) or 40.0,
            'rainThresholdMmDay': to_number(first.get('rain_threshold_mm_day')) or 40.0,
            'windTier1': to_number(first.get('wind_exceed_days_tier_1')) or 5.0,
            'windTier2': to_number(first.get('wind_exceed_days_tier_2')) or 15.0,
            'windTier3': to_number(first.get('wind_exceed_days_tier_3')) or 30.0,
            'rainTier1': to_number(first.get('rain_exceed_days_tier_1')) or 5.0,
            'rainTier2': to_number(first.get('rain_exceed_days_tier_2')) or 15.0,
            'rainTier3': to_number(first.get('rain_exceed_days_tier_3')) or 30.0
        }

def build_standalone():
    # Read assets
    with open('index.html', 'r', encoding='utf-8') as f:
        html_content = f.read()

    with open('style.css', 'r', encoding='utf-8') as f:
        css_content = f.read()

    with open('app.js', 'r', encoding='utf-8') as f:
        js_content = f.read()

    with open('dashboard_data.json', 'r', encoding='utf-8') as f:
        data_json = f.read()

    with open('01_Malawi_Districts_2025_Ward_Boundaries_simplified.geojson', 'r', encoding='utf-8') as f:
        geo_json = f.read()

    try:
        with open('institutions.json', 'r', encoding='utf-8') as f:
            institutions_json = f.read()
    except FileNotFoundError:
        institutions_json = '[]'

    try:
        with open('gis_stats.json', 'r', encoding='utf-8') as f:
            gis_stats_json = f.read()
    except FileNotFoundError:
        gis_stats_json = '{}'

    try:
        with open('gis_stats_constituency.json', 'r', encoding='utf-8') as f:
            constituency_gis_stats_json = f.read()
    except FileNotFoundError:
        constituency_gis_stats_json = '{}'

    try:
        with open('district_boundaries.geojson', 'r', encoding='utf-8') as f:
            district_boundaries_json = f.read()
    except FileNotFoundError:
        district_boundaries_json = 'null'

    try:
        with open('constituency_boundaries.geojson', 'r', encoding='utf-8') as f:
            constituency_boundaries_json = f.read()
    except FileNotFoundError:
        constituency_boundaries_json = 'null'

    district_hazards_json = json.dumps(
        parse_hazard_csv('washways_district_risks_v3.csv', 'district'),
        ensure_ascii=False
    )
    constituency_hazards_json = json.dumps(
        parse_hazard_csv('washways_constituency_risks_v3.csv', 'constituency'),
        ensure_ascii=False
    )
    hazard_context_json = json.dumps(
        parse_hazard_context('washways_district_risks_v3.csv') or parse_hazard_context('washways_constituency_risks_v3.csv'),
        ensure_ascii=False
    )

    # Create the embedded JS payload
    embedded_script = f"""
    <script>
        window.embeddedDashboardData = {data_json};
        window.embeddedGeojsonData = {geo_json};
        window.embeddedInstitutionsData = {institutions_json};
        window.embeddedGisStats = {gis_stats_json};
        window.embeddedConstituencyGisStats = {constituency_gis_stats_json};
        window.embeddedDistrictBoundaries = {district_boundaries_json};
        window.embeddedConstituencyBoundaries = {constituency_boundaries_json};
        window.embeddedDistrictHazards = {district_hazards_json};
        window.embeddedConstituencyHazards = {constituency_hazards_json};
        window.embeddedHazardContext = {hazard_context_json};
    </script>
    """

    # Replace CSS
    css_tag = '<link rel="stylesheet" href="style.css">'
    inline_css = f"<style>\n{css_content}\n</style>"
    if css_tag in html_content:
        html_content = html_content.replace(css_tag, inline_css)

    # Replace JS and inject embedded data
    js_tag = '<script src="app.js"></script>'
    inline_js = f"{embedded_script}\n<script>\n{js_content}\n</script>"
    if js_tag in html_content:
        html_content = html_content.replace(js_tag, inline_js)

    # Write output
    output_filename = 'CDF_Dashboard.html'
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    print(f"Successfully generated standalone dashboard: {output_filename}")

if __name__ == "__main__":
    build_standalone()
