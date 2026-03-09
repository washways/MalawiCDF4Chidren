// Format helper for MWK currency
const formatCurrency = (value) => {
    if (value >= 1e9) {
        return `MWK ${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
        return `MWK ${(value / 1e6).toFixed(2)}M`;
    }
    return `MWK ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const formatCurrencyUSD = (value) => {
    if (value >= 1e6) {
        return `USD ${(value / 1e6).toFixed(2)}M`;
    }
    return `USD ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};
const formatNumber = (value, maxFractionDigits = 1) =>
    Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxFractionDigits
    });
const EXCHANGE_RATE_USD = 1750.0;
const getConstituencyKey = (districtName, constiName) => `${districtName}||${constiName}`;
const HAZARD_METRICS = [
    { key: 'river_flood', label: 'River Flood' },
    { key: 'ag_drought', label: 'Agricultural Drought' },
    { key: 'spei_drought', label: 'SPEI Drought' },
    { key: 'spi_drought', label: 'SPI Drought' },
    { key: 'drought_any', label: 'Any Drought' },
    { key: 'wind_era5', label: 'Wind Extreme (>=1 day)' },
    { key: 'wind_era5_ge5d', label: 'Wind Extreme (>=5 days)' },
    { key: 'wind_era5_ge15d', label: 'Wind Extreme (>=15 days)' },
    { key: 'wind_era5_ge30d', label: 'Wind Extreme (>=30 days)' },
    { key: 'rain_era5', label: 'Heavy Rain (>=1 day)' },
    { key: 'rain_era5_ge5d', label: 'Heavy Rain (>=5 days)' },
    { key: 'rain_era5_ge15d', label: 'Heavy Rain (>=15 days)' },
    { key: 'rain_era5_ge30d', label: 'Heavy Rain (>=30 days)' },
    { key: 'any_exceed', label: 'Any Wind/Rain Exceedance (>=1 day)' },
    { key: 'any_risk', label: 'Any Combined Hazard' }
];
const DEFAULT_HAZARD_CONTEXT = {
    analysisStart: '2020-01-01',
    analysisEndExclusive: '2025-02-01',
    windThresholdKmh: 40,
    rainThresholdMmDay: 40,
    windTier1: 5,
    windTier2: 15,
    windTier3: 30,
    rainTier1: 5,
    rainTier2: 15,
    rainTier3: 30
};
let hazardContext = { ...DEFAULT_HAZARD_CONTEXT };

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function daysBetweenIso(startIso, endExclusiveIso) {
    const start = new Date(`${startIso}T00:00:00Z`);
    const end = new Date(`${endExclusiveIso}T00:00:00Z`);
    const diffMs = end.getTime() - start.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
    return Math.round(diffMs / 86400000);
}

function parseHazardContext(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const sample = rows.find(r =>
        r.analysis_start || r.analysis_end_exclusive || r.wind_threshold_kmh || r.rain_threshold_mm_day
    );
    if (!sample) return null;

    return {
        analysisStart: sample.analysis_start || DEFAULT_HAZARD_CONTEXT.analysisStart,
        analysisEndExclusive: sample.analysis_end_exclusive || DEFAULT_HAZARD_CONTEXT.analysisEndExclusive,
        windThresholdKmh: toNumber(sample.wind_threshold_kmh) || DEFAULT_HAZARD_CONTEXT.windThresholdKmh,
        rainThresholdMmDay: toNumber(sample.rain_threshold_mm_day) || DEFAULT_HAZARD_CONTEXT.rainThresholdMmDay,
        windTier1: toNumber(sample.wind_exceed_days_tier_1) || DEFAULT_HAZARD_CONTEXT.windTier1,
        windTier2: toNumber(sample.wind_exceed_days_tier_2) || DEFAULT_HAZARD_CONTEXT.windTier2,
        windTier3: toNumber(sample.wind_exceed_days_tier_3) || DEFAULT_HAZARD_CONTEXT.windTier3,
        rainTier1: toNumber(sample.rain_exceed_days_tier_1) || DEFAULT_HAZARD_CONTEXT.rainTier1,
        rainTier2: toNumber(sample.rain_exceed_days_tier_2) || DEFAULT_HAZARD_CONTEXT.rainTier2,
        rainTier3: toNumber(sample.rain_exceed_days_tier_3) || DEFAULT_HAZARD_CONTEXT.rainTier3
    };
}

function updateHazardMetricLabelsFromContext() {
    const wind = `Wind >=${formatNumber(hazardContext.windThresholdKmh, 0)} km/h`;
    const rain = `Heavy Rain >=${formatNumber(hazardContext.rainThresholdMmDay, 0)} mm/day`;
    const setLabel = (key, label) => {
        const metric = HAZARD_METRICS.find(h => h.key === key);
        if (metric) metric.label = label;
    };

    setLabel('wind_era5', `${wind} (>=1 day)`);
    setLabel('wind_era5_ge5d', `${wind} (>=${formatNumber(hazardContext.windTier1, 0)} days)`);
    setLabel('wind_era5_ge15d', `${wind} (>=${formatNumber(hazardContext.windTier2, 0)} days)`);
    setLabel('wind_era5_ge30d', `${wind} (>=${formatNumber(hazardContext.windTier3, 0)} days)`);
    setLabel('rain_era5', `${rain} (>=1 day)`);
    setLabel('rain_era5_ge5d', `${rain} (>=${formatNumber(hazardContext.rainTier1, 0)} days)`);
    setLabel('rain_era5_ge15d', `${rain} (>=${formatNumber(hazardContext.rainTier2, 0)} days)`);
    setLabel('rain_era5_ge30d', `${rain} (>=${formatNumber(hazardContext.rainTier3, 0)} days)`);
    setLabel('any_exceed', `Any Wind/Rain Exceedance (>=1 day at stated thresholds)`);
}

function getHazardContextSummary() {
    const days = daysBetweenIso(hazardContext.analysisStart, hazardContext.analysisEndExclusive);
    return `Period ${hazardContext.analysisStart} to ${hazardContext.analysisEndExclusive} (end exclusive, ${formatNumber(days, 0)} days) | Wind >=${formatNumber(hazardContext.windThresholdKmh, 0)} km/h (tiers ${formatNumber(hazardContext.windTier1, 0)}/${formatNumber(hazardContext.windTier2, 0)}/${formatNumber(hazardContext.windTier3, 0)} days) | Rain >=${formatNumber(hazardContext.rainThresholdMmDay, 0)} mm/day (tiers ${formatNumber(hazardContext.rainTier1, 0)}/${formatNumber(hazardContext.rainTier2, 0)}/${formatNumber(hazardContext.rainTier3, 0)} days)`;
}

function updateHazardContextNote() {
    const noteEl = document.getElementById('hazard-context-note');
    if (!noteEl) return;
    noteEl.textContent = `Hazard basis: ${getHazardContextSummary()}`;
}

function normalizeName(name) {
    return String(name || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function getNormalizedConstituencyKey(districtName, constituencyName) {
    return `${normalizeName(districtName)}||${normalizeName(constituencyName)}`;
}

function parseCsvText(csvText) {
    if (!csvText || !csvText.trim()) return [];
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
    if (!lines.length) return [];

    const parseLine = (line) => {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        values.push(current);
        return values;
    };

    const headers = parseLine(lines[0]).map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (!cols.length) continue;
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = (cols[idx] ?? '').trim();
        });
        rows.push(row);
    }
    return rows;
}

function deriveTotalChildrenFromHazards(row) {
    const explicit = toNumber(row.child_population);
    if (explicit > 0) return explicit;

    for (const metric of HAZARD_METRICS) {
        const count = toNumber(row[`${metric.key}_exposed_children`]);
        const pct = toNumber(row[`${metric.key}_exposed_children_pct`]);
        if (count > 0 && pct > 0) {
            return (count * 100) / pct;
        }
    }
    return 0;
}

function parseHazardRows(rows, level) {
    const districtIndex = {};
    const constituencyIndex = {};
    const mergeProfiles = (base, incoming) => {
        const merged = {
            districtName: base?.districtName || incoming.districtName,
            constituencyName: base?.constituencyName || incoming.constituencyName,
            totalChildren: toNumber(base?.totalChildren) + toNumber(incoming.totalChildren),
            hazards: {}
        };
        HAZARD_METRICS.forEach(metric => {
            const count = toNumber(base?.hazards?.[metric.key]?.count) + toNumber(incoming.hazards?.[metric.key]?.count);
            const pct = merged.totalChildren > 0 ? (count / merged.totalChildren) * 100 : 0;
            merged.hazards[metric.key] = { count, pct };
        });
        return merged;
    };

    rows.forEach(row => {
        const districtName = row.district_name || row.feature_uid || '';
        const constituencyName = row.constituency_name || '';
        const totalChildren = deriveTotalChildrenFromHazards(row);
        const hazards = {};

        HAZARD_METRICS.forEach(metric => {
            const count = toNumber(row[`${metric.key}_exposed_children`]);
            const pct = toNumber(row[`${metric.key}_exposed_children_pct`]);
            hazards[metric.key] = { count, pct };
        });

        const payload = {
            districtName,
            constituencyName,
            totalChildren,
            hazards
        };

        if (level === 'district') {
            const key = normalizeName(districtName);
            districtIndex[key] = mergeProfiles(districtIndex[key], payload);
        } else if (level === 'constituency') {
            const key = getNormalizedConstituencyKey(districtName, constituencyName);
            constituencyIndex[key] = mergeProfiles(constituencyIndex[key], payload);
        }
    });

    return { districtIndex, constituencyIndex };
}

function getEmptyHazardProfile() {
    const hazards = {};
    HAZARD_METRICS.forEach(metric => {
        hazards[metric.key] = { count: 0, pct: 0 };
    });
    return { totalChildren: 0, hazards };
}

function combineHazardProfiles(profiles) {
    const merged = getEmptyHazardProfile();
    profiles.filter(Boolean).forEach(profile => {
        merged.totalChildren += toNumber(profile.totalChildren);
        HAZARD_METRICS.forEach(metric => {
            merged.hazards[metric.key].count += toNumber(profile.hazards?.[metric.key]?.count);
        });
    });
    HAZARD_METRICS.forEach(metric => {
        const count = merged.hazards[metric.key].count;
        merged.hazards[metric.key].pct = merged.totalChildren > 0 ? (count / merged.totalChildren) * 100 : 0;
    });
    return merged;
}

function getHazardProfileRows(profile) {
    if (!profile) return [];
    return HAZARD_METRICS.map(metric => ({
        key: metric.key,
        label: metric.label,
        count: toNumber(profile.hazards?.[metric.key]?.count),
        pct: toNumber(profile.hazards?.[metric.key]?.pct)
    }));
}

function renderHazardSectionHtml(profile, sectionTitle) {
    if (!profile) return '';
    const rows = getHazardProfileRows(profile);
    const contextSummary = getHazardContextSummary();
    return `
        <div style="margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; font-size: 12px;">
            <div style="font-weight: 600; color: #334155; margin-bottom: 6px;">${sectionTitle}</div>
            <div style="font-size: 10px; color:#475569; margin-bottom: 6px;">${contextSummary}</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #1e293b;">
                <span>Total Children:</span><strong>${formatNumber(profile.totalChildren, 0)}</strong>
            </div>
            <div style="display: grid; grid-template-columns: 1.6fr 1fr 0.8fr; gap: 4px; font-size: 11px; color:#1e293b;">
                <strong>Hazard</strong><strong>Exposed (#)</strong><strong>Exposed (%)</strong>
                ${rows.map(row => `
                    <span>${row.label}</span>
                    <span>${formatNumber(row.count, 0)}</span>
                    <span>${formatNumber(row.pct, 1)}%</span>
                `).join('')}
            </div>
        </div>
    `;
}

function renderPrintHazardSection(profile, sectionTitle) {
    if (!profile) return '';
    const rows = getHazardProfileRows(profile);
    const contextSummary = getHazardContextSummary();
    return `
        <div style="margin-top: 10px; margin-bottom: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px;">
            <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase;">${sectionTitle}</h4>
            <div style="margin-bottom: 6px; font-size: 10px; color:#475569;">${contextSummary}</div>
            <div style="margin-bottom: 6px; font-size: 11px; color:#1e293b;"><strong>Total Children:</strong> ${formatNumber(profile.totalChildren, 0)}</div>
            <table class="data-table" style="font-size: 10px;">
                <thead>
                    <tr>
                        <th>Hazard</th>
                        <th>Exposed (#)</th>
                        <th>Exposed (%)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td>${row.label}</td>
                            <td>${formatNumber(row.count, 0)}</td>
                            <td>${formatNumber(row.pct, 1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getHazardCsvHeaderColumns() {
    const cols = ['Children Total'];
    HAZARD_METRICS.forEach(metric => {
        cols.push(`${metric.label} Exposed (#)`);
        cols.push(`${metric.label} Exposed (%)`);
    });
    return cols;
}

function getHazardCsvValues(profile) {
    const p = profile || getEmptyHazardProfile();
    const values = [toNumber(p.totalChildren)];
    HAZARD_METRICS.forEach(metric => {
        values.push(toNumber(p.hazards?.[metric.key]?.count));
        values.push(toNumber(p.hazards?.[metric.key]?.pct));
    });
    return values;
}

function getCategoryPerChildHeaderColumns() {
    if (!dashboardData || !Array.isArray(dashboardData.categories)) return [];
    return dashboardData.categories.map(cat => `${cat} per Child (MWK)`);
}

function getDistrictCategoryPerChildValues(districtName, childrenTotal) {
    const values = [];
    const cats = dashboardData?.districts?.[districtName]?.categories || {};
    (dashboardData?.categories || []).forEach(cat => {
        const catBudget = toNumber(cats[cat]);
        values.push(childrenTotal > 0 ? catBudget / childrenTotal : 0);
    });
    return values;
}

function getBlankCategoryPerChildValues() {
    return (dashboardData?.categories || []).map(() => '');
}

// Global State
let dashboardData = null;
let geojsonData = null;
let institutionsData = [];
let gisStatsData = {};
let constituencyGisStatsData = {};
let districtHazardIndex = {};
let constituencyHazardIndex = {};
let districtBoundariesData = null;
let constituencyBoundariesData = null;
let geoStatsIndex = { districts: {}, constituencies: {} };
let currentSelection = 'National';
let mapLayer = null;
let districtLayer = null;
let districtOutlineLayer = null;
let constituencyOutlineLayer = null;
let currentColorMode = 'total'; // total, per_child, category, specific_category, specific_category_child, hazard_children
let currentMapScale = null;
let currentLegendRanges = [];
const EXPORT_MODE_NATIONAL_DISTRICT = 'national_district';
const EXPORT_MODE_NATIONAL_FULL = 'national_full';
const EXPORT_MODE_DISTRICT = 'district';

// Chart Instances
let categoryChart = null;
let districtChart = null;

// Chart Colors
const chartColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b',
    '#10b981', '#14b8a6', '#06b6d4'
];

function syncDistrictSelectors(selected) {
    const topSelect = document.getElementById('district-select');
    const option3Select = document.getElementById('option3-district-select');

    if (topSelect) {
        topSelect.value = selected || 'National';
    }
    if (option3Select) {
        option3Select.value = selected && selected !== 'National' ? selected : '';
    }
}

// Initialize Dashboard
async function init() {
    try {
        initSplashScreen();

        const hasEmbeddedData =
            typeof window.embeddedDashboardData !== 'undefined' &&
            typeof window.embeddedGeojsonData !== 'undefined';
        const preferEmbedded = hasEmbeddedData && window.location.protocol === 'file:';
        const fetchJson = async (path, fallbackValue = null, required = false) => {
            try {
                const response = await fetch(path, { cache: 'no-store' });
                if (!response.ok) {
                    if (required) {
                        throw new Error(`Failed to load ${path} (${response.status})`);
                    }
                    return fallbackValue;
                }
                return await response.json();
            } catch (err) {
                if (required) throw err;
                return fallbackValue;
            }
        };
        const fetchText = async (path, fallbackValue = '', required = false) => {
            try {
                const response = await fetch(path, { cache: 'no-store' });
                if (!response.ok) {
                    if (required) {
                        throw new Error(`Failed to load ${path} (${response.status})`);
                    }
                    return fallbackValue;
                }
                return await response.text();
            } catch (err) {
                if (required) throw err;
                return fallbackValue;
            }
        };

        const useEmbeddedData = () => {
            dashboardData = window.embeddedDashboardData;
            geojsonData = window.embeddedGeojsonData;
            institutionsData = window.embeddedInstitutionsData || [];
            gisStatsData = window.embeddedGisStats || {};
            constituencyGisStatsData = window.embeddedConstituencyGisStats || {};
            districtBoundariesData = window.embeddedDistrictBoundaries || null;
            constituencyBoundariesData = window.embeddedConstituencyBoundaries || null;
            districtHazardIndex = window.embeddedDistrictHazards || {};
            constituencyHazardIndex = window.embeddedConstituencyHazards || {};
            hazardContext = window.embeddedHazardContext || { ...DEFAULT_HAZARD_CONTEXT };
        };

        if (preferEmbedded) {
            useEmbeddedData();
            console.info('Data source: embedded (file protocol mode)');
        } else {
            try {
                const [dataJson, geoJson, instJson, gisJson, constiGisJson, distBoundJson, constBoundJson, districtHazCsv, constituencyHazCsv] = await Promise.all([
                    fetchJson('dashboard_data.json', null, true),
                    fetchJson('01_Malawi_Districts_2025_Ward_Boundaries_simplified.geojson', null, true),
                    fetchJson('institutions.json', []),
                    fetchJson('gis_stats.json', {}),
                    fetchJson('gis_stats_constituency.json', {}),
                    fetchJson('district_boundaries.geojson', null),
                    fetchJson('constituency_boundaries.geojson', null),
                    fetchText('washways_district_risks_v3.csv', '', true),
                    fetchText('washways_constituency_risks_v3.csv', '', true)
                ]);

                dashboardData = dataJson;
                geojsonData = geoJson;
                institutionsData = instJson || [];
                gisStatsData = gisJson || {};
                constituencyGisStatsData = constiGisJson || {};
                districtBoundariesData = distBoundJson || null;
                constituencyBoundariesData = constBoundJson || null;

                const districtHazRows = parseCsvText(districtHazCsv);
                const constituencyHazRows = parseCsvText(constituencyHazCsv);
                districtHazardIndex = parseHazardRows(districtHazRows, 'district').districtIndex;
                constituencyHazardIndex = parseHazardRows(constituencyHazRows, 'constituency').constituencyIndex;
                hazardContext = parseHazardContext(districtHazRows)
                    || parseHazardContext(constituencyHazRows)
                    || { ...DEFAULT_HAZARD_CONTEXT };
                console.info('Data source: live JSON files');
            } catch (loadErr) {
                if (!hasEmbeddedData) throw loadErr;
                console.warn('Live data load failed; falling back to embedded payload.', loadErr);
                useEmbeddedData();
                console.info('Data source: embedded fallback');
            }
        }

        updateHazardMetricLabelsFromContext();
        updateHazardContextNote();

        // Calculate National Aggregates
        calculateNationalData();
        buildGeoStatsIndex();

        // Setup UI
        setupMap();
        setupDropdown();
        setupCharts();
        setupChartAccordions();
        updateUI('National');

        // Event Listeners
        document.getElementById('reset-btn').addEventListener('click', () => {
            currentSelection = 'National';
            syncDistrictSelectors('National');
            if (mapLayer) {
                mapLayer.eachLayer(layer => {
                    mapLayer.resetStyle(layer);
                });
                mapLayer._map.fitBounds(mapLayer.getBounds(), { padding: [20, 20], maxZoom: 8 });
                mapLayer._map.closePopup();
            }
            updateUI('National');
        });
        document.getElementById('map-only-btn').addEventListener('click', toggleMapOnlyMode);

        const allocationToggleBtn = document.getElementById('allocation-toggle-btn');
        const allocationToolContent = document.getElementById('allocation-tool-content');
        if (allocationToggleBtn && allocationToolContent) {
            allocationToggleBtn.addEventListener('click', () => {
                const willExpand = allocationToolContent.classList.contains('hidden');
                allocationToolContent.classList.toggle('hidden', !willExpand);
                allocationToggleBtn.textContent = willExpand ? 'Collapse Tool' : 'Expand Tool';
                if (willExpand) calculateFairAllocation();
            });
        }

        // Sliders Listeners
        const sliders = ['pop', 'schools', 'hcfs', 'cbccs'];
        sliders.forEach(s => {
            const el = document.getElementById(`weight-${s}`);
            el.addEventListener('input', (e) => {
                document.getElementById(`weight-${s}-val`).textContent = e.target.value;
                calculateFairAllocation();
            });
        });

        // Export / Print quick actions
        document.getElementById('print-national-district-btn').addEventListener('click', () => {
            generateExportReport(EXPORT_MODE_NATIONAL_DISTRICT);
        });
        document.getElementById('print-national-full-btn').addEventListener('click', () => {
            generateExportReport(EXPORT_MODE_NATIONAL_FULL);
        });
        document.getElementById('print-district-btn').addEventListener('click', () => {
            generateExportReport(EXPORT_MODE_DISTRICT);
        });

        document.getElementById('excel-national-district-btn').addEventListener('click', () => {
            exportCSV(EXPORT_MODE_NATIONAL_DISTRICT);
        });
        document.getElementById('excel-national-full-btn').addEventListener('click', () => {
            exportCSV(EXPORT_MODE_NATIONAL_FULL);
        });
        document.getElementById('excel-district-btn').addEventListener('click', () => {
            exportCSV(EXPORT_MODE_DISTRICT);
        });

    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

function initSplashScreen() {
    const overlay = document.getElementById('splash-screen');
    const startBtn = document.getElementById('splash-start-btn');
    const dontShow = document.getElementById('splash-dont-show');
    if (!overlay || !startBtn || !dontShow) return;

    const prefKey = 'cdf_dashboard_hide_splash_v1';
    let shouldHide = false;
    try {
        shouldHide = localStorage.getItem(prefKey) === '1';
    } catch (e) {
        shouldHide = false;
    }

    if (!shouldHide) {
        overlay.classList.remove('hidden');
    }

    startBtn.addEventListener('click', () => {
        try {
            if (dontShow.checked) localStorage.setItem(prefKey, '1');
            else localStorage.removeItem(prefKey);
        } catch (e) {
            // Ignore persistence errors and continue.
        }
        overlay.classList.add('hidden');
    });
}

function toggleMapOnlyMode() {
    const body = document.body;
    const btn = document.getElementById('map-only-btn');
    const enabling = !body.classList.contains('map-only-mode');
    body.classList.toggle('map-only-mode', enabling);

    if (btn) {
        btn.textContent = enabling ? 'Exit Map Only' : 'Map Only Mode';
        btn.setAttribute('aria-pressed', enabling ? 'true' : 'false');
    }

    if (mapLayer && mapLayer._map) {
        setTimeout(() => mapLayer._map.invalidateSize(false), 180);
    }
}

// Calculate national totals from districts
function calculateNationalData() {
    dashboardData.national = {
        total: 0,
        categories: {}
    };

    // Initialize categories with 0
    dashboardData.categories.forEach(cat => {
        dashboardData.national.categories[cat] = 0;
    });

    // Sum from all districts
    for (const [district, info] of Object.entries(dashboardData.districts)) {
        dashboardData.national.total += info.total;
        for (const [cat, val] of Object.entries(info.categories)) {
            if (dashboardData.national.categories[cat] !== undefined) {
                dashboardData.national.categories[cat] += val;
            } else {
                dashboardData.national.categories[cat] = val;
            }
        }
    }
}

function incrementInstitutionCount(counter, type) {
    if (!counter) return;
    if (type === 'SCHOOL') counter.school += 1;
    else if (type === 'HCF') counter.hcf += 1;
    else if (type === 'CBCC') counter.cbcc += 1;
    else return;
    counter.total += 1;
}

function buildGeoStatsIndex() {
    const districtStats = {};
    const constituencyStats = {};

    const ensureDistrict = (districtName) => {
        if (!districtStats[districtName]) {
            districtStats[districtName] = {
                population: 0,
                wardCount: 0,
                constituencySet: new Set(),
                constituencyCount: 0,
                areaKm2: 0,
                popDensity: 0,
                roadsKm: 0,
                waterwaysKm: 0,
                roadDensityPer100Km2: 0,
                waterwaysDensityPer100Km2: 0,
                institutions: { school: 0, hcf: 0, cbcc: 0, total: 0 },
                institutionDensityPer100Km2: 0
            };
        }
        return districtStats[districtName];
    };

    const ensureConstituency = (districtName, constiName) => {
        const key = getConstituencyKey(districtName, constiName);
        if (!constituencyStats[key]) {
            constituencyStats[key] = {
                districtName,
                constituencyName: constiName,
                population: 0,
                wardCount: 0,
                areaKm2: 0,
                popDensity: 0,
                roadsKm: 0,
                waterwaysKm: 0,
                hasActualNetworkData: false,
                roadDensityPer100Km2: 0,
                waterwaysDensityPer100Km2: 0,
                institutions: { school: 0, hcf: 0, cbcc: 0, total: 0 },
                institutionDensityPer100Km2: 0
            };
        }
        return constituencyStats[key];
    };

    geojsonData.features.forEach(feature => {
        const props = feature.properties || {};
        const districtName = props.DistrictNa || 'Unknown';
        const constiName = props.ConstiName || 'Unknown';
        const population = Number(props.Population) || 0;

        const areaKm2 = typeof turf !== 'undefined'
            ? (turf.area(feature) / 1e6)
            : 0;

        const dStats = ensureDistrict(districtName);
        dStats.population += population;
        dStats.wardCount += 1;
        dStats.constituencySet.add(constiName);
        dStats.areaKm2 += areaKm2;

        const cStats = ensureConstituency(districtName, constiName);
        cStats.population += population;
        cStats.wardCount += 1;
        cStats.areaKm2 += areaKm2;
    });

    institutionsData.forEach(inst => {
        const districtName = inst.district || '';
        const constiName = inst.constituency || '';
        const dStats = districtStats[districtName];
        if (dStats) {
            incrementInstitutionCount(dStats.institutions, inst.type);
        }
        const cStats = constituencyStats[getConstituencyKey(districtName, constiName)];
        if (cStats) {
            incrementInstitutionCount(cStats.institutions, inst.type);
        }
    });

    Object.entries(districtStats).forEach(([districtName, stats]) => {
        stats.constituencyCount = stats.constituencySet.size;
        delete stats.constituencySet;

        stats.roadsKm = Number(gisStatsData[districtName]?.road_network_km) || 0;
        stats.waterwaysKm = Number(gisStatsData[districtName]?.waterways_km) || 0;

        if (stats.areaKm2 > 0) {
            stats.popDensity = stats.population / stats.areaKm2;
            stats.roadDensityPer100Km2 = (stats.roadsKm / stats.areaKm2) * 100;
            stats.waterwaysDensityPer100Km2 = (stats.waterwaysKm / stats.areaKm2) * 100;
            stats.institutionDensityPer100Km2 = (stats.institutions.total / stats.areaKm2) * 100;
        }
    });

    Object.values(constituencyStats).forEach(stats => {
        const constituencyGis = constituencyGisStatsData?.[stats.districtName]?.[stats.constituencyName];
        if (constituencyGis) {
            stats.roadsKm = Number(constituencyGis.road_network_km) || 0;
            stats.waterwaysKm = Number(constituencyGis.waterways_km) || 0;
            stats.hasActualNetworkData = true;
        }

        if (stats.areaKm2 > 0) {
            stats.popDensity = stats.population / stats.areaKm2;
            stats.roadDensityPer100Km2 = (stats.roadsKm / stats.areaKm2) * 100;
            stats.waterwaysDensityPer100Km2 = (stats.waterwaysKm / stats.areaKm2) * 100;
            stats.institutionDensityPer100Km2 = (stats.institutions.total / stats.areaKm2) * 100;
        }
    });

    geoStatsIndex = {
        districts: districtStats,
        constituencies: constituencyStats
    };
}

// Dropdown Setup
function setupDropdown() {
    const topSelect = document.getElementById('district-select');
    const option3Select = document.getElementById('option3-district-select');
    if (!topSelect && !option3Select) return;

    const districts = Object.keys(dashboardData.districts).sort();
    districts.forEach(d => {
        if (topSelect) {
            const option = document.createElement('option');
            option.value = d;
            option.textContent = d;
            topSelect.appendChild(option);
        }
        if (option3Select) {
            const opt3 = document.createElement('option');
            opt3.value = d;
            opt3.textContent = d;
            option3Select.appendChild(opt3);
        }
    });

    const applySelection = (selected) => {
        if (selected === 'National') {
            document.getElementById('reset-btn').click();
            return;
        }

        // Find a layer for this district to mimic a click
        let targetLayer = null;
        mapLayer.eachLayer(l => {
            if (!targetLayer && l.feature.properties.DistrictNa === selected) {
                targetLayer = l;
            }
        });

        if (targetLayer) {
            // Get center of district bounds
            const groupBounds = L.latLngBounds();
            mapLayer.eachLayer(l => {
                if (l.feature.properties.DistrictNa === selected) {
                    groupBounds.extend(l.getBounds());
                }
            });
            targetLayer.fire('click', { latlng: groupBounds.getCenter() });
        }
    };

    if (topSelect) {
        topSelect.addEventListener('change', (e) => {
            const selected = e.target.value;
            syncDistrictSelectors(selected);
            applySelection(selected);
        });
    }

    if (option3Select) {
        option3Select.addEventListener('change', (e) => {
            const selected = e.target.value;
            if (!selected) return;
            syncDistrictSelectors(selected);
            applySelection(selected);
        });
    }
}

// Color Scales
function getHazardMetricLabel(metricKey) {
    const match = HAZARD_METRICS.find(h => h.key === metricKey);
    return match ? match.label : 'Selected Hazard';
}

function getSelectedHazardMetricKey() {
    return document.getElementById('hazard-metric-select')?.value || 'any_risk';
}

function getSelectedHazardLevel() {
    return document.getElementById('hazard-level-select')?.value || 'district';
}

function getSelectedHazardValueType() {
    return document.getElementById('hazard-value-select')?.value || 'count';
}

function getModeDisplayLabel(mode = currentColorMode) {
    if (mode === 'total') return 'Total Investment';
    if (mode === 'per_child') return 'Investment per Child (District)';
    if (mode === 'category') return 'Top Investment Category';
    if (mode === 'specific_category') {
        const selectedCat = document.getElementById('category-select')?.value || 'Selected Category';
        return `${selectedCat} Amount`;
    }
    if (mode === 'specific_category_child') {
        const selectedCat = document.getElementById('category-select')?.value || 'Selected Category';
        return `${selectedCat} per Child`;
    }
    if (mode === 'hazard_children') {
        const hazardLabel = getHazardMetricLabel(getSelectedHazardMetricKey());
        const levelLabel = getSelectedHazardLevel() === 'district' ? 'District' : 'Constituency';
        const typeLabel = getSelectedHazardValueType() === 'pct' ? 'Exposed (%)' : 'Exposed (#)';
        return `${hazardLabel} - ${typeLabel} (${levelLabel})`;
    }
    return 'Mapped Value';
}

function formatModeValue(mode, value) {
    if (!Number.isFinite(value)) return 'No data';
    if (mode === 'hazard_children') {
        return getSelectedHazardValueType() === 'pct'
            ? `${formatNumber(value, 1)}%`
            : `${formatNumber(value, 0)} children`;
    }
    if (mode === 'per_child' || mode === 'specific_category_child') return `${formatCurrency(value)}/child`;
    return formatCurrency(value);
}

function getFeatureMappedMetric(feature) {
    const districtName = feature?.properties?.DistrictNa;
    const constiName = feature?.properties?.ConstiName;
    const districtData = districtName ? dashboardData?.districts?.[districtName] : null;
    const districtChildren = districtName ? toNumber(getDistrictHazardProfile(districtName)?.totalChildren) : 0;
    const selectedCat = document.getElementById('category-select')?.value || '';

    if (currentColorMode === 'hazard_children') {
        const hazardMetric = getSelectedHazardMetricKey();
        const hazardLevel = getSelectedHazardLevel();
        const hazardValueType = getSelectedHazardValueType();
        const hazardProfile = hazardLevel === 'district'
            ? getDistrictHazardProfile(districtName)
            : getConstituencyHazardProfile(districtName, constiName);
        const hazardValue = hazardValueType === 'pct'
            ? toNumber(hazardProfile?.hazards?.[hazardMetric]?.pct)
            : toNumber(hazardProfile?.hazards?.[hazardMetric]?.count);
        const hasProfileData = !!hazardProfile && toNumber(hazardProfile.totalChildren) > 0;
        const valueText = hazardValueType === 'pct'
            ? `${formatNumber(hazardValue, 1)}% of children`
            : `${formatNumber(hazardValue, 0)} children`;

        return {
            numericValue: hazardValue,
            displayValue: `${getHazardMetricLabel(hazardMetric)}: ${valueText}`,
            hasData: hasProfileData
        };
    }

    if (!districtData) {
        return { numericValue: 0, displayValue: 'No district investment data', hasData: false };
    }

    if (currentColorMode === 'total') {
        const value = Number(districtData.total || 0);
        return { numericValue: value, displayValue: formatCurrency(value), hasData: true };
    }

    if (currentColorMode === 'per_child') {
        const value = districtChildren > 0 ? Number(districtData.total || 0) / districtChildren : 0;
        return { numericValue: value, displayValue: `${formatCurrency(value)}/child`, hasData: districtChildren > 0 };
    }

    if (currentColorMode === 'category') {
        let topCat = '-';
        let topVal = 0;
        Object.entries(districtData.categories || {}).forEach(([cat, val]) => {
            const numeric = Number(val || 0);
            if (numeric > topVal) {
                topVal = numeric;
                topCat = cat;
            }
        });
        return {
            numericValue: topVal,
            displayValue: topCat === '-' ? 'No category data' : `${topCat}: ${formatCurrency(topVal)}`,
            hasData: topCat !== '-',
            categoryName: topCat
        };
    }

    if (currentColorMode === 'specific_category') {
        const value = Number((districtData.categories || {})[selectedCat] || 0);
        return { numericValue: value, displayValue: `${selectedCat}: ${formatCurrency(value)}`, hasData: true };
    }

    if (currentColorMode === 'specific_category_child') {
        const catVal = Number((districtData.categories || {})[selectedCat] || 0);
        const value = districtChildren > 0 ? catVal / districtChildren : 0;
        return { numericValue: value, displayValue: `${selectedCat}: ${formatCurrency(value)}/child`, hasData: districtChildren > 0 };
    }

    return { numericValue: 0, displayValue: 'No data', hasData: false };
}

function getFeatureTooltipHtml(feature) {
    const districtName = feature?.properties?.DistrictNa || 'Unknown District';
    const constiName = feature?.properties?.ConstiName || 'Unknown Constituency';
    const modeLabel = getModeDisplayLabel();
    const metric = getFeatureMappedMetric(feature);
    const valueText = metric.displayValue || 'No data';
    const hazardBasisHtml = currentColorMode === 'hazard_children'
        ? `<span style="color:#64748b;font-size:10px;">${getHazardContextSummary()}</span><br/>`
        : '';

    return `
        <strong>${districtName}</strong><br/>
        ${constiName}<br/>
        <span style="color:#475569;font-size:11px;">${modeLabel}</span><br/>
        ${hazardBasisHtml}
        <strong style="color:#0f172a;">${valueText}</strong>
    `;
}

function getLegendHtml(mode, maxVal, ranges = []) {
    if (mode === 'category') {
        let html = `<div style="font-size:11px; color:#334155; margin-bottom:6px; font-weight:600;">${getModeDisplayLabel(mode)}</div>`;
        html += '<div style="display:flex; flex-wrap:wrap; gap:10px; padding: 5px;">';
        dashboardData.categories.forEach((cat, idx) => {
            const color = chartColors[idx % chartColors.length];
            html += `<div style="display:flex; align-items:center; gap:4px; margin-bottom: 2px;"><div style="width:12px;height:12px;border-radius:2px;background:${color}"></div><span style="font-size:10px">${cat}</span></div>`;
        });
        html += '</div>';
        return html;
    }

    const title = getModeDisplayLabel(mode);
    const hazardBasis = mode === 'hazard_children'
        ? `<div style="font-size:10px; color:#64748b; margin-bottom:4px;">${getHazardContextSummary()}</div>`
        : '';

    const color1 = mode === 'hazard_children' ? '#fef3c7' : '#1e3a8a';
    const color2 = mode === 'hazard_children' ? '#f59e0b' : '#3b82f6';
    const color3 = mode === 'hazard_children' ? '#991b1b' : '#67e8f9';

    let binsHtml = '';
    if (ranges.length > 1 && currentMapScale) {
        for (let i = 0; i < ranges.length - 1; i++) {
            const start = ranges[i];
            const end = ranges[i + 1];
            const midpoint = (start + end) / 2;
            const color = currentMapScale(midpoint).hex();
            binsHtml += `
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
                    <span style="display:inline-block; width:12px; height:12px; border-radius:2px; background:${color}; border:1px solid rgba(15,23,42,0.15);"></span>
                    <span style="font-size:10px; color:#334155;">${formatModeValue(mode, start)} - ${formatModeValue(mode, end)}</span>
                </div>
            `;
        }
    }

    return `
        <div style="font-size:11px; color:#334155; margin-bottom:4px; font-weight:600;">${title}</div>
        ${hazardBasis}
        <span style="font-size:10px;">Low</span>
        <div class="legend-gradient" style="background: linear-gradient(to right, ${color1}, ${color2}, ${color3})"></div>
        <span style="font-size:10px;">High (${formatModeValue(mode, maxVal)})</span>
        <div style="margin-top:6px;">${binsHtml}</div>
    `;
}

// Map Setup
let schoolLayerGrp = L.layerGroup();
let cbccLayerGrp = L.layerGroup();
let hcfLayerGrp = L.layerGroup();

function setupMap() {
    const fallbackMalawiBounds = L.latLngBounds([[-17.2, 32.6], [-9.2, 36.0]]);

    // Center map on Malawi roughly
    const map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        minZoom: 6,
        maxZoom: 11,
        maxBounds: fallbackMalawiBounds.pad(0.12),
        maxBoundsViscosity: 1.0
    }).setView([-13.2543, 34.3015], 6);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initialize Layer Control
    const overlays = {
        "Schools": schoolLayerGrp,
        "Health Care Facilities": hcfLayerGrp,
        "CBCCs": cbccLayerGrp
    };
    L.control.layers(null, overlays, { position: 'topleft', collapsed: false }).addTo(map);

    // Populate Institution Markers
    institutionsData.forEach(inst => {
        if (!inst.lat || !inst.lon) return;

        let color = '#3b82f6'; // default blue
        let radius = 3;
        let layerGrp = null;

        if (inst.type === 'SCHOOL') {
            color = '#f59e0b'; // amber
            layerGrp = schoolLayerGrp;
        } else if (inst.type === 'HCF') {
            color = '#ec4899'; // pink
            radius = 4;
            layerGrp = hcfLayerGrp;
        } else if (inst.type === 'CBCC') {
            color = '#10b981'; // emerald
            layerGrp = cbccLayerGrp;
        }

        if (layerGrp) {
            const marker = L.circleMarker([inst.lat, inst.lon], {
                radius: radius,
                fillColor: color,
                color: '#ffffff',
                weight: 0.5,
                opacity: 1,
                fillOpacity: 0.8
            });

            marker.bindTooltip(`<strong>${inst.name}</strong>`, {
                direction: 'top',
                className: 'inst-tooltip'
            });

            layerGrp.addLayer(marker);
        }
    });

    // Setup coloring dropdown listener
    const colorSelect = document.getElementById('color-select');
    const categorySelect = document.getElementById('category-select');
    const hazardMetricSelect = document.getElementById('hazard-metric-select');
    const hazardLevelSelect = document.getElementById('hazard-level-select');
    const hazardValueSelect = document.getElementById('hazard-value-select');

    // Populate category dropdown
    dashboardData.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
    if (hazardMetricSelect) {
        HAZARD_METRICS.forEach(h => {
            const option = document.createElement('option');
            option.value = h.key;
            option.textContent = `Hazard: ${h.label}`;
            hazardMetricSelect.appendChild(option);
        });
        hazardMetricSelect.value = 'any_risk';
    }

    const syncMapModeControls = () => {
        const isCategoryMode = currentColorMode === 'specific_category' || currentColorMode === 'specific_category_child';
        const isHazardMode = currentColorMode === 'hazard_children';
        if (categorySelect) categorySelect.classList.toggle('hidden', !isCategoryMode);
        if (hazardMetricSelect) hazardMetricSelect.classList.toggle('hidden', !isHazardMode);
        if (hazardLevelSelect) hazardLevelSelect.classList.toggle('hidden', !isHazardMode);
        if (hazardValueSelect) hazardValueSelect.classList.toggle('hidden', !isHazardMode);
    };

    colorSelect.addEventListener('change', (e) => {
        currentColorMode = e.target.value;
        syncMapModeControls();
        updateMapColors();
    });

    categorySelect.addEventListener('change', (e) => {
        // Redraw when category changes
        updateMapColors();
    });
    if (hazardMetricSelect) hazardMetricSelect.addEventListener('change', updateMapColors);
    if (hazardLevelSelect) hazardLevelSelect.addEventListener('change', updateMapColors);
    if (hazardValueSelect) hazardValueSelect.addEventListener('change', updateMapColors);
    syncMapModeControls();

    // Pre-calculate scale before initializing map layers
    updateMapColors();

    const districtBoundaryGeojson = districtBoundariesData && Array.isArray(districtBoundariesData.features)
        ? districtBoundariesData
        : null;
    const constituencyBoundaryGeojson = constituencyBoundariesData && Array.isArray(constituencyBoundariesData.features)
        ? constituencyBoundariesData
        : null;

    // Map Style Function for Base Wards/Constituencies
    function styleWards(feature) {
        let fillColor = '#f8fafc'; // Light default
        let fillOpacity = 0.8;
        const metric = getFeatureMappedMetric(feature);

        if (currentColorMode === 'category') {
            const catIndex = dashboardData.categories.indexOf(metric.categoryName);
            fillColor = catIndex >= 0 ? chartColors[catIndex % chartColors.length] : '#f8fafc';
            fillOpacity = metric.hasData ? 0.8 : 0.2;
        } else if (currentMapScale) {
            fillColor = currentMapScale(metric.numericValue || 0).hex();
            fillOpacity = metric.hasData ? 0.8 : 0.2;
        }

        return {
            fillColor: fillColor,
            weight: 0,
            opacity: 0.9,
            color: 'transparent',
            fillOpacity: fillOpacity
        };
    }

    function styleConstituencyOutlines(feature) {
        return {
            weight: 0.7,
            color: '#475569',
            opacity: 0.45,
            fillOpacity: 0,
            interactive: false
        };
    }

    // Map Style Function for Top-Level District Outlines
    function styleDistricts(feature) {
        return {
            weight: 3,
            color: '#1e3a8a', // Strong primary boundary for districts
            opacity: 1,
            fillOpacity: 0,
            interactive: false // Allows hover events to pass through to Wards underneath
        };
    }

    function updateInfoBoxes(feature) {
        const districtName = feature.properties.DistrictNa;
        const constiName = feature.properties.ConstiName;
        const districtData = dashboardData.districts[districtName];
        const districtStats = geoStatsIndex.districts[districtName] || null;
        const constituencyStats = geoStatsIndex.constituencies[getConstituencyKey(districtName, constiName)] || null;
        const districtHazard = getDistrictHazardProfile(districtName);
        const constituencyHazard = getConstituencyHazardProfile(districtName, constiName);
        const totalChildren = toNumber(districtHazard?.totalChildren);
        const constiChildren = toNumber(constituencyHazard?.totalChildren);
        const proportion = totalChildren > 0 ? constiChildren / totalChildren : 0;
        const districtChildDensity = districtStats?.areaKm2 > 0 ? totalChildren / districtStats.areaKm2 : 0;
        const constituencyChildDensity = constituencyStats?.areaKm2 > 0 ? constiChildren / constituencyStats.areaKm2 : 0;
        const statRow = (label, value, accentColor = '') =>
            `<div style="display: flex; justify-content: space-between;"><span>${label}:</span> <strong${accentColor ? ` style="color:${accentColor};"` : ''}>${value}</strong></div>`;

        // Construct District Box HTML
        let distHTML = `
            <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${districtName}</h3>
                <span style="font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 600;">District Overview</span>
            </div>
        `;

        if (districtData) {
            distHTML += `
                <p style="margin: 0 0 5px 0; display: flex; justify-content: space-between; color: #1e293b;"><strong>Active Investment:</strong> <span><strong style="color: #059669;">${formatCurrency(districtData.total)}</strong></span></p>
                <p style="margin: 0 0 10px 0; display: flex; justify-content: space-between; color: #1e293b;"><strong>District Children Population:</strong> <span>${formatNumber(totalChildren, 0)}</span></p>
            `;

            const sortedCats = Object.entries(districtData.categories)
                .filter(([cat, val]) => val > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            if (sortedCats.length > 0) {
                distHTML += `<div style="margin-top: 10px; font-weight: 600; color: #334155; font-size: 12px; margin-bottom: 5px;">Primary Sectors:</div>`;
                sortedCats.forEach(([cat, val]) => {
                    distHTML += `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; padding-left: 5px; border-left: 2px solid #cbd5e1; color: #1e293b;"><span>${cat}</span> <strong>${formatCurrency(val)}</strong></div>`;
                });
            }
        } else {
            distHTML += `<p style="color: #ef4444; font-style: italic;">No investment data available globally.</p>`;
        }

        // Construct Constituency Box HTML
        const estTotal = districtData ? districtData.total * proportion : 0;
        let constHTML = `
            <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${constiName}</h3>
                <span style="font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 600;">Constituency Geography</span>
            </div>
            <p style="margin: 0 0 5px 0; display: flex; justify-content: space-between; color: #1e293b;"><strong>Est. Area Target:</strong> <span><strong style="color: #059669;">${formatCurrency(estTotal)}</strong></span></p>
            <p style="margin: 0 0 10px 0; display: flex; justify-content: space-between; color: #1e293b;"><strong>Constituency Children Population:</strong> <span>${formatNumber(constiChildren, 0)}</span></p>
            <p style="margin: 0 0 5px 0; font-size: 11px; color: #64748b;">(Target shown as a child-share slice of the parent district investment pool.)</p>
        `;

        const distSchoolCount = districtStats?.institutions.school || 0;
        const distCbccCount = districtStats?.institutions.cbcc || 0;
        const distHcfCount = districtStats?.institutions.hcf || 0;
        const constSchoolCount = constituencyStats?.institutions.school || 0;
        const constCbccCount = constituencyStats?.institutions.cbcc || 0;
        const constHcfCount = constituencyStats?.institutions.hcf || 0;

        if (districtStats) {
            distHTML += `
                <div style="margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; font-size: 12px;">
                    <div style="font-weight: 600; color: #334155; margin-bottom: 6px;">District Infrastructure & GIS:</div>
                    <div style="display: flex; flex-direction: column; gap: 4px; color: #1e293b;">
                        ${statRow('Wards', districtStats.wardCount)}
                        ${statRow('Constituencies', districtStats.constituencyCount)}
                        ${statRow('Area', `${formatNumber(districtStats.areaKm2, 0)} km2`)}
                        ${statRow('Children Density', `${formatNumber(districtChildDensity)} children/km2`)}
                        ${statRow('Schools', distSchoolCount, '#d97706')}
                        ${statRow('Health Facilities', distHcfCount, '#db2777')}
                        ${statRow('CBCCs', distCbccCount, '#059669')}
                        ${statRow('Inst Density', `${formatNumber(districtStats.institutionDensityPer100Km2)} per 100 km2`)}
                        ${statRow('Road Network', `${formatNumber(districtStats.roadsKm, 0)} km`)}
                        ${statRow('Waterways', `${formatNumber(districtStats.waterwaysKm, 0)} km`)}
                        ${statRow('Road Density', `${formatNumber(districtStats.roadDensityPer100Km2)} km per 100 km2`)}
                        ${statRow('Water Density', `${formatNumber(districtStats.waterwaysDensityPer100Km2)} km per 100 km2`)}
                    </div>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">Road and waterway lengths are sourced from OpenStreetMap via Overpass API district extracts.</p>
                </div>
            `;
        }
        if (districtHazard) {
            distHTML += renderHazardSectionHtml(districtHazard, 'District Child Hazard Exposure');
        }

        if (constituencyStats) {
            constHTML += `
                <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 10px; font-size: 12px;">
                    <div style="font-weight: 600; color: #334155; margin-bottom: 6px;">Constituency Infrastructure & GIS:</div>
                    <div style="display: flex; flex-direction: column; gap: 4px; color: #1e293b;">
                        ${statRow('Wards', constituencyStats.wardCount)}
                        ${statRow('Area', `${formatNumber(constituencyStats.areaKm2, 0)} km2`)}
                        ${statRow('Children Density', `${formatNumber(constituencyChildDensity)} children/km2`)}
                        ${statRow('Schools', constSchoolCount, '#d97706')}
                        ${statRow('Health Facilities', constHcfCount, '#db2777')}
                        ${statRow('CBCCs', constCbccCount, '#059669')}
                        ${statRow('Inst Density', `${formatNumber(constituencyStats.institutionDensityPer100Km2)} per 100 km2`)}
                        ${statRow('Road Network', constituencyStats.hasActualNetworkData ? `${formatNumber(constituencyStats.roadsKm, 1)} km` : 'Not Available')}
                        ${statRow('Waterways', constituencyStats.hasActualNetworkData ? `${formatNumber(constituencyStats.waterwaysKm, 1)} km` : 'Not Available')}
                        ${constituencyStats.hasActualNetworkData ? statRow('Road Density', `${formatNumber(constituencyStats.roadDensityPer100Km2)} km per 100 km2`) : ''}
                        ${constituencyStats.hasActualNetworkData ? statRow('Water Density', `${formatNumber(constituencyStats.waterwaysDensityPer100Km2)} km per 100 km2`) : ''}
                    </div>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">Constituency road and waterway lengths are measured from OpenStreetMap Overpass geometry using constituency boundaries.</p>
                </div>
            `;
        }
        if (constituencyHazard) {
            constHTML += renderHazardSectionHtml(constituencyHazard, 'Constituency Child Hazard Exposure');
        }

        const distEl = document.getElementById('district-info-box');
        const constEl = document.getElementById('constituency-info-box');
        if (distEl) distEl.innerHTML = distHTML;
        if (constEl) constEl.innerHTML = constHTML;
    }

    // Map Interaction Hooks
    function onEachFeature(feature, layer) {
        const districtName = feature.properties.DistrictNa;
        const districtData = dashboardData.districts[districtName];

        // Bind simple label tooltip for hover
        layer.bindTooltip(getFeatureTooltipHtml(feature), {
            direction: 'top',
            sticky: true
        });

        if (districtData) {
            layer.on({
                mouseover: (e) => {
                    layer.setTooltipContent(getFeatureTooltipHtml(feature));
                    updateInfoBoxes(feature);
                },
                mouseout: (e) => {
                    // Styles remain static as requested, only info boxes update on hover.
                },
                click: (e) => {
                    // Reset globally
                    mapLayer.eachLayer(l => mapLayer.resetStyle(l));

                    currentSelection = districtName;
                    syncDistrictSelectors(districtName);

                    // Apply Global Region Focus
                    const groupBounds = L.latLngBounds();
                    mapLayer.eachLayer(l => {
                        if (l.feature.properties.DistrictNa === districtName) {
                            l.setStyle({ weight: 2.5, color: '#0ea5e9', fillOpacity: 1 });
                            groupBounds.extend(l.getBounds());
                            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) l.bringToFront();
                        }
                    });

                    mapLayer._map.fitBounds(groupBounds, { padding: [50, 50], maxZoom: 9 });

                    // Update side charts


                    updateUI(districtName);
                }
            });
        }
    }

    // Render Both Layers
    mapLayer = L.geoJson(geojsonData, {
        style: styleWards,
        onEachFeature: onEachFeature
    }).addTo(map);

    constituencyOutlineLayer = L.geoJson(
        constituencyBoundaryGeojson || geojsonData,
        {
            style: styleConstituencyOutlines,
            interactive: false
        }
    ).addTo(map);

    if (districtBoundaryGeojson) {
        districtOutlineLayer = L.geoJson(districtBoundaryGeojson, {
            style: styleDistricts,
            interactive: false
        }).addTo(map);
        districtLayer = districtOutlineLayer;
    } else {
        districtOutlineLayer = null;
    }

    const constituencyToggle = document.getElementById('toggle-constituency-outlines');
    const districtToggle = document.getElementById('toggle-district-outlines');

    const syncOutlineVisibility = () => {
        if (constituencyToggle && constituencyOutlineLayer) {
            if (constituencyToggle.checked) {
                if (!map.hasLayer(constituencyOutlineLayer)) constituencyOutlineLayer.addTo(map);
            } else if (map.hasLayer(constituencyOutlineLayer)) {
                map.removeLayer(constituencyOutlineLayer);
            }
        }
        if (districtToggle) {
            districtToggle.disabled = !districtOutlineLayer;
            if (!districtOutlineLayer) {
                districtToggle.checked = false;
            } else if (districtToggle.checked) {
                if (!map.hasLayer(districtOutlineLayer)) districtOutlineLayer.addTo(map);
            } else if (map.hasLayer(districtOutlineLayer)) {
                map.removeLayer(districtOutlineLayer);
            }
        }
    };

    if (constituencyToggle) constituencyToggle.addEventListener('change', syncOutlineVisibility);
    if (districtToggle) districtToggle.addEventListener('change', syncOutlineVisibility);
    syncOutlineVisibility();

    if (constituencyOutlineLayer && map.hasLayer(constituencyOutlineLayer)) {
        constituencyOutlineLayer.bringToFront();
    }
    if (districtOutlineLayer && map.hasLayer(districtOutlineLayer)) {
        districtOutlineLayer.bringToFront();
    }

    // Fit Initial Bounds and lock map extent to Malawi geometry
    const malawiBounds = mapLayer && mapLayer.getBounds().isValid()
        ? mapLayer.getBounds()
        : fallbackMalawiBounds;
    map.setMaxBounds(malawiBounds.pad(0.12));
    map.fitBounds(malawiBounds, { padding: [20, 20], maxZoom: 8 });
    requestAnimationFrame(() => map.invalidateSize(false));
    window.addEventListener('resize', () => map.invalidateSize(false));
}

function updateMapColors() {
    let maxVal = 0;
    const legendDiv = document.getElementById('map-legend');
    currentLegendRanges = [];

    if (currentColorMode === 'total') {
        const totals = Object.values(dashboardData.districts).map(d => d.total);
        maxVal = Math.max(...totals);
        if (totals.length > 4) {
            const breaks = chroma.limits(totals, 'q', 4);
            currentLegendRanges = breaks;
            currentMapScale = chroma.scale(['#1e3a8a', '#1d4ed8', '#3b82f6', '#22d3ee', '#67e8f9']).domain(breaks);
        } else {
            currentLegendRanges = [0, maxVal];
            currentMapScale = chroma.scale(['#1e3a8a', '#67e8f9']).domain([0, maxVal]);
        }
    } else if (currentColorMode === 'per_child') {
        let maxPerChild = 0;
        const perChildValues = [];
        // Pre-calculate per-child values for all districts to find max
        for (const [districtInfoName, info] of Object.entries(dashboardData.districts)) {
            const children = toNumber(getDistrictHazardProfile(districtInfoName)?.totalChildren);
            const pc = children > 0 ? info.total / children : 0;
            perChildValues.push(pc);
            if (pc > maxPerChild) maxPerChild = pc;
        }
        maxVal = maxPerChild;
        if (perChildValues.length > 4) {
            const breaks = chroma.limits(perChildValues, 'q', 4);
            currentLegendRanges = breaks;
            currentMapScale = chroma.scale(['#1e3a8a', '#1d4ed8', '#3b82f6', '#22d3ee', '#67e8f9']).domain(breaks);
        } else {
            currentLegendRanges = [0, maxVal];
            currentMapScale = chroma.scale(['#1e3a8a', '#67e8f9']).domain([0, maxVal]);
        }
    } else if (currentColorMode === 'specific_category') {
        const selectedCat = document.getElementById('category-select').value;
        const catTotals = [];
        for (const [districtInfoName, info] of Object.entries(dashboardData.districts)) {
            const val = info.categories[selectedCat] || 0;
            catTotals.push(val);
        }
        maxVal = catTotals.length > 0 ? Math.max(...catTotals) : 0;
        if (catTotals.length > 4 && maxVal > 0) {
            const breaks = chroma.limits(catTotals, 'q', 4);
            currentLegendRanges = breaks;
            currentMapScale = chroma.scale(['#4c1d95', '#6d28d9', '#8b5cf6', '#a78bfa', '#ddd6fe']).domain(breaks);
        } else {
            currentLegendRanges = [0, maxVal];
            currentMapScale = chroma.scale(['#4c1d95', '#ddd6fe']).domain([0, maxVal]);
        }
    } else if (currentColorMode === 'specific_category_child') {
        const selectedCat = document.getElementById('category-select').value;
        let maxPerChild = 0;
        const perChildValues = [];
        for (const [districtInfoName, info] of Object.entries(dashboardData.districts)) {
            const children = toNumber(getDistrictHazardProfile(districtInfoName)?.totalChildren);
            const catVal = info.categories[selectedCat] || 0;
            const pc = children > 0 ? catVal / children : 0;
            perChildValues.push(pc);
            if (pc > maxPerChild) maxPerChild = pc;
        }
        maxVal = maxPerChild;
        if (perChildValues.length > 4 && maxVal > 0) {
            const breaks = chroma.limits(perChildValues, 'q', 4);
            currentLegendRanges = breaks;
            currentMapScale = chroma.scale(['#831843', '#be185d', '#ec4899', '#f472b6', '#fbcfe8']).domain(breaks);
        } else {
            currentLegendRanges = [0, maxVal];
            currentMapScale = chroma.scale(['#831843', '#fbcfe8']).domain([0, maxVal]);
        }
    } else if (currentColorMode === 'hazard_children') {
        const hazardMetric = getSelectedHazardMetricKey();
        const hazardLevel = getSelectedHazardLevel();
        const hazardValueType = getSelectedHazardValueType();
        const hazardVals = [];

        if (hazardLevel === 'district') {
            const seenDistricts = new Set();
            geojsonData.features.forEach(f => {
                const districtName = f?.properties?.DistrictNa;
                const norm = normalizeName(districtName);
                if (!norm || seenDistricts.has(norm)) return;
                seenDistricts.add(norm);
                const profile = getDistrictHazardProfile(districtName);
                if (!profile) return;
                const val = hazardValueType === 'pct'
                    ? toNumber(profile?.hazards?.[hazardMetric]?.pct)
                    : toNumber(profile?.hazards?.[hazardMetric]?.count);
                hazardVals.push(val);
            });
        } else {
            const seenConstituencies = new Set();
            geojsonData.features.forEach(f => {
                const districtName = f?.properties?.DistrictNa;
                const constiName = f?.properties?.ConstiName;
                const normKey = getNormalizedConstituencyKey(districtName, constiName);
                if (!normKey || seenConstituencies.has(normKey)) return;
                seenConstituencies.add(normKey);
                const profile = getConstituencyHazardProfile(districtName, constiName);
                if (!profile) return;
                const val = hazardValueType === 'pct'
                    ? toNumber(profile?.hazards?.[hazardMetric]?.pct)
                    : toNumber(profile?.hazards?.[hazardMetric]?.count);
                hazardVals.push(val);
            });
        }

        maxVal = hazardVals.length > 0 ? Math.max(...hazardVals) : 0;
        const domainMax = maxVal > 0 ? maxVal : 1;
        if (hazardVals.length > 4 && maxVal > 0) {
            const breaks = chroma.limits(hazardVals, 'q', 4);
            currentLegendRanges = breaks;
            currentMapScale = chroma.scale(['#fef3c7', '#f59e0b', '#dc2626', '#7f1d1d']).domain(breaks);
        } else {
            currentLegendRanges = [0, maxVal];
            currentMapScale = chroma.scale(['#fef3c7', '#7f1d1d']).domain([0, domainMax]);
        }
    } else if (currentColorMode === 'category') {
        currentMapScale = null;
        currentLegendRanges = [];
    }

    // Draw legend
    legendDiv.innerHTML = getLegendHtml(currentColorMode, maxVal, currentLegendRanges);

    // Apply styles
    if (mapLayer) {
        mapLayer.eachLayer(layer => {
            if (layer.getTooltip && layer.getTooltip()) {
                layer.setTooltipContent(getFeatureTooltipHtml(layer.feature));
            }
            // We trigger the default style resolution by calling resetStyle IF it's not currently selected
            if (currentSelection === 'National' || currentSelection !== layer.feature.properties.DistrictNa) {
                mapLayer.resetStyle(layer);
            }
        });
    }
}

// Chart Setup
function setupCharts() {
    Chart.defaults.color = '#475569';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    // Common options
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleFont: { size: 14, family: "'Outfit', sans-serif" },
                bodyFont: { size: 13, family: "'Outfit', sans-serif" },
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: function (context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null && context.chart.canvas.id === 'categoryChart') {
                            label += formatCurrency(context.parsed.y);
                        } else if (context.parsed.x !== null) {
                            label += formatCurrency(context.parsed.x);
                        }
                        return label;
                    }
                }
            }
        }
    };

    // Category Chart (Row Chart)
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(ctxCat, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            ...commonOptions,
            indexAxis: 'y', // Makes it a horizontal row chart
            plugins: {
                ...commonOptions.plugins,
                legend: { display: false } // No legend needed for simple category list
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });

    // District Chart (Top 10 - Stacked Row Chart)
    const ctxDist = document.getElementById('districtChart').getContext('2d');
    districtChart = new Chart(ctxDist, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            ...commonOptions,
            indexAxis: 'y',
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { size: 10 } }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                },
                y: {
                    stacked: true,
                    grid: { display: false }
                }
            }
        }
    });
}

// Update UI based on selection
function updateUI(selection) {
    const isNational = selection === 'National';
    const dataObj = isNational ? dashboardData.national : dashboardData.districts[selection];

    // Update KPI Cards
    document.getElementById('val-total').textContent = formatCurrency(dataObj.total);
    document.getElementById('val-region').textContent = isNational ? 'National Total' : selection + ' District';

    // Update charts
    updateCategoryChart(dataObj, isNational ? 'National' : selection);

    updateDistrictChart(isNational ? null : selection);
    updateExportActionState();
    calculateFairAllocation();
}

function setupChartAccordions() {
    const accordions = document.querySelectorAll('.chart-accordion');
    if (!accordions.length) return;
    accordions.forEach(acc => {
        acc.addEventListener('toggle', () => {
            if (!acc.open) return;
            setTimeout(() => {
                if (categoryChart) categoryChart.resize();
                if (districtChart) districtChart.resize();
            }, 120);
        });
    });
}

function updateCategoryChart(dataObj, region) {
    document.getElementById('category-chart-title').textContent = `Investment by Category (${region})`;

    const labels = dashboardData.categories;
    const values = labels.map(cat => dataObj.categories[cat] || 0);

    categoryChart.data = {
        labels: labels,
        datasets: [{
            label: 'Investment',
            data: values,
            backgroundColor: chartColors,
            borderRadius: 6,
            borderWidth: 0
        }]
    };
    categoryChart.update();
}

function updateDistrictChart(districtName = null) {
    const parentContainer = document.querySelector('#districtChart').parentElement.parentElement;
    const titleElement = parentContainer.querySelector('.section-header h2');

    if (districtName) {
        // Show Infrastructure by Constituency within the selected District
        if (titleElement) titleElement.textContent = `Infrastructure in ${districtName}`;

        // Find constituencies in this district
        const constituencies = new Set();
        geojsonData.features.forEach(f => {
            if (f.properties.DistrictNa === districtName && f.properties.ConstiName) {
                constituencies.add(f.properties.ConstiName);
            }
        });

        const constLabels = Array.from(constituencies).sort();

        let schoolData = Array(constLabels.length).fill(0);
        let cbccData = Array(constLabels.length).fill(0);
        let hcfData = Array(constLabels.length).fill(0);

        institutionsData.forEach(inst => {
            const idx = constLabels.indexOf(inst.constituency);
            if (idx !== -1) {
                if (inst.type === 'SCHOOL') schoolData[idx]++;
                else if (inst.type === 'CBCC') cbccData[idx]++;
                else if (inst.type === 'HCF') hcfData[idx]++;
            }
        });

        districtChart.data = {
            labels: constLabels,
            datasets: [
                { label: 'Schools', data: schoolData, backgroundColor: '#d97706', borderRadius: 2 },
                { label: 'Health Facilities', data: hcfData, backgroundColor: '#db2777', borderRadius: 2 },
                { label: 'CBCCs', data: cbccData, backgroundColor: '#059669', borderRadius: 2 }
            ]
        };
        districtChart.update();

    } else {
        // Show Top Funded Districts globally
        if (titleElement) titleElement.textContent = `Top Funded Districts`;

        // Sort districts by total investment to get Top 10
        const sortedDistricts = Object.entries(dashboardData.districts)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 10); // Top 10

        const districtLabels = sortedDistricts.map(d => d[0]);

        // Create a dataset for each category
        const datasets = dashboardData.categories.map((category, index) => {
            return {
                label: category,
                data: sortedDistricts.map(d => d[1].categories[category] || 0),
                backgroundColor: chartColors[index % chartColors.length],
                borderRadius: 2
            };
        });

        districtChart.data = {
            labels: districtLabels,
            datasets: datasets
        };
        districtChart.update();
    }
}

// --- Fair Allocation & Export Logic ---

let allocationResults = [];
let currentAllocationTotal = 0;
let currentAllocationContext = 'National'; // 'National' or Specific District

function updateExportActionState() {
    const districtLabels = [document.getElementById('topbar-district-context')].filter(Boolean);
    const option3Select = document.getElementById('option3-district-select');
    const isNational = currentSelection === 'National';

    districtLabels.forEach(label => {
        label.textContent = isNational ? 'National (Select District for Option 3)' : currentSelection;
    });

    if (option3Select) {
        option3Select.value = isNational ? '' : currentSelection;
    }

    ['print-district-btn', 'excel-district-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = isNational;
            btn.title = isNational
                ? 'Select a district in Option 3 to enable this action.'
                : '';
        }
    });
}

function calculateFairAllocation() {
    const rawPop = parseFloat(document.getElementById('weight-pop').value) || 0;
    const rawSch = parseFloat(document.getElementById('weight-schools').value) || 0;
    const rawHcf = parseFloat(document.getElementById('weight-hcfs').value) || 0;
    const rawCbc = parseFloat(document.getElementById('weight-cbccs').value) || 0;

    const totalWeight = rawPop + rawSch + rawHcf + rawCbc;

    const wPop = totalWeight > 0 ? rawPop / totalWeight : 0;
    const wSch = totalWeight > 0 ? rawSch / totalWeight : 0;
    const wHcf = totalWeight > 0 ? rawHcf / totalWeight : 0;
    const wCbc = totalWeight > 0 ? rawCbc / totalWeight : 0;

    currentAllocationContext = currentSelection;
    const isNational = currentSelection === 'National';
    updateExportActionState();

    // Step 1: Pre-calculate the total metrics for EACH DISTRICT
    // The budget available for constituency splits is strictly the "Construction and Rehabilitation" category
    const districtMetrics = {};
    Object.keys(dashboardData.districts).forEach(dist => {
        const cats = dashboardData.districts[dist].categories;
        const constructionBudget = cats && cats["Construction and Rehabilitation"] ? cats["Construction and Rehabilitation"] : 0;
        const districtGeoStats = geoStatsIndex.districts[dist];

        districtMetrics[dist] = {
            pop: toNumber(getDistrictHazardProfile(dist)?.totalChildren),
            sch: districtGeoStats?.institutions.school || 0,
            hcf: districtGeoStats?.institutions.hcf || 0,
            cbc: districtGeoStats?.institutions.cbcc || 0,
            totalHQBudget: dashboardData.districts[dist].total,
            constructionBudget: constructionBudget
        };
    });

    // Step 2: Build Constituency Entities and their inner metrics
    const constituencyEntities = {};
    Object.values(geoStatsIndex.constituencies).forEach(stats => {
        const key = getConstituencyKey(stats.districtName, stats.constituencyName);
        constituencyEntities[key] = {
            district: stats.districtName,
            name: stats.constituencyName,
            pop: toNumber(getConstituencyHazardProfile(stats.districtName, stats.constituencyName)?.totalChildren),
            sch: stats.institutions.school,
            hcf: stats.institutions.hcf,
            cbc: stats.institutions.cbcc
        };
    });

    // Calculate Fair Shares for every constituency based on its District's parent metrics
    allocationResults = [];
    Object.keys(constituencyEntities).forEach(entityKey => {
        const c = constituencyEntities[entityKey];
        const dMet = districtMetrics[c.district];

        if (!dMet) return;

        const popShare = dMet.pop > 0 ? c.pop / dMet.pop : 0;
        const schShare = dMet.sch > 0 ? c.sch / dMet.sch : 0;
        const hcfShare = dMet.hcf > 0 ? c.hcf / dMet.hcf : 0;
        const cbcShare = dMet.cbc > 0 ? c.cbc / dMet.cbc : 0;

        const combinedFairShare = (popShare * wPop) + (schShare * wSch) + (hcfShare * wHcf) + (cbcShare * wCbc);

        // Fair Target Budget uses only the Construction budget pool
        const fairBudget = combinedFairShare * dMet.constructionBudget;
        const fairBudgetUSD = fairBudget / EXCHANGE_RATE_USD;

        // Est current proxy base (baseline strictly by child-share ratio applied to Construction budget)
        const currentPopRatio = dMet.pop > 0 ? c.pop / dMet.pop : 0;
        const currentExpectedBudget = currentPopRatio * dMet.constructionBudget;

        const totalInst = c.sch + c.hcf + c.cbc;
        const mwkPerInst = totalInst > 0 ? fairBudget / totalInst : 0;

        allocationResults.push({
            district: c.district,
            area: c.name,
            pop: c.pop,
            sch: c.sch,
            hcf: c.hcf,
            cbc: c.cbc,
            inst: totalInst,
            mwkPerInst: mwkPerInst,
            fairSharePct: combinedFairShare * 100,
            fairBudget: fairBudget,
            fairBudgetUSD: fairBudgetUSD,
            currentBudget: currentExpectedBudget,
            diff: fairBudget - currentExpectedBudget
        });
    });

    // Determine what to display based on Context
    const tbody = document.querySelector('#allocation-table tbody');
    const thead = document.querySelector('#allocation-table thead');
    tbody.innerHTML = '';

    let displayResults = [];

    if (isNational) {
        document.getElementById('allocation-table-title').textContent = 'Estimated Distribution (Previewing District Construction & Rehab Budgets)';

        thead.innerHTML = `
            <tr>
                <th>Area</th>
                <th>Children Pop.</th>
                <th>Schools</th>
                <th>HCFs</th>
                <th>CBCCs</th>
                <th>Target Budget (MWK)</th>
                <th>Target Budget (USD)</th>
                <th>MWK / Inst</th>
            </tr>
        `;

        currentAllocationTotal = 0;

        displayResults = Object.keys(districtMetrics).map(dist => {
            const dMet = districtMetrics[dist];
            currentAllocationTotal += dMet.constructionBudget;

            const totalInst = dMet.sch + dMet.hcf + dMet.cbc;
            const mwkPerInst = totalInst > 0 ? dMet.constructionBudget / totalInst : 0;

            return {
                area: dist,
                pop: dMet.pop,
                sch: dMet.sch,
                hcf: dMet.hcf,
                cbc: dMet.cbc,
                inst: totalInst,
                mwkPerInst: mwkPerInst,
                fairSharePct: 100, // District acts universally bounded
                fairBudget: dMet.constructionBudget,
                fairBudgetUSD: dMet.constructionBudget / EXCHANGE_RATE_USD,
                currentBudget: dMet.constructionBudget,
                diff: 0
            };
        });

    } else {
        document.getElementById('allocation-table-title').textContent = `Estimated Distribution (${currentSelection} -> Constituencies - Construction & Rehab ONLY)`;

        thead.innerHTML = `
            <tr>
                <th>Area</th>
                <th>Children Pop.</th>
                <th>Schools</th>
                <th>HCFs</th>
                <th>CBCCs</th>
                <th>Fair Share %</th>
                <th>Target Budget (MWK)</th>
                <th>Target Budget (USD)</th>
                <th>MWK / Inst</th>
            </tr>
        `;

        currentAllocationTotal = districtMetrics[currentSelection].constructionBudget;
        displayResults = allocationResults.filter(r => r.district === currentSelection);
    }

    displayResults.sort((a, b) => b.fairBudget - a.fairBudget);

    // Render Table Rows
    let sumChildren = 0, sumSch = 0, sumHcf = 0, sumCbc = 0, sumFair = 0, sumFairUSD = 0, sumBase = 0, sumDiff = 0;

    displayResults.forEach(res => {
        const rowChildren = isNational
            ? toNumber(getDistrictHazardProfile(res.area)?.totalChildren)
            : toNumber(getConstituencyHazardProfile(currentSelection, res.area)?.totalChildren);
        sumChildren += rowChildren;
        sumSch += res.sch;
        sumHcf += res.hcf;
        sumCbc += res.cbc;
        sumFair += res.fairBudget;
        sumFairUSD += res.fairBudgetUSD;
        sumBase += res.currentBudget;
        sumDiff += res.diff;

        const tr = document.createElement('tr');

        if (isNational) {
            tr.innerHTML = `
                <td><strong>${res.area}</strong></td>
                <td>${formatNumber(rowChildren, 0)}</td>
                <td>${res.sch.toLocaleString()}</td>
                <td>${res.hcf.toLocaleString()}</td>
                <td>${res.cbc.toLocaleString()}</td>
                <td style="color: #67e8f9;">${formatCurrency(res.fairBudget)}</td>
                <td style="color: #67e8f9;">${formatCurrencyUSD(res.fairBudgetUSD)}</td>
                <td style="color: #cbd5e1; font-size: 0.9em;">${formatCurrency(res.mwkPerInst)}</td>
            `;
        } else {
            tr.innerHTML = `
                <td><strong>${res.area}</strong></td>
                <td>${formatNumber(rowChildren, 0)}</td>
                <td>${res.sch.toLocaleString()}</td>
                <td>${res.hcf.toLocaleString()}</td>
                <td>${res.cbc.toLocaleString()}</td>
                <td>${res.fairSharePct.toFixed(2)}%</td>
                <td style="color: #67e8f9;">${formatCurrency(res.fairBudget)}</td>
                <td style="color: #67e8f9;">${formatCurrencyUSD(res.fairBudgetUSD)}</td>
                <td style="color: #cbd5e1; font-size: 0.9em;">${formatCurrency(res.mwkPerInst)}</td>
            `;
        }
        tbody.appendChild(tr);
    });

    // Appending Totals Row
    const totalInstSum = sumSch + sumHcf + sumCbc;
    const totalMwkPerInstSum = totalInstSum > 0 ? sumFair / totalInstSum : 0;

    const trTotals = document.createElement('tr');
    trTotals.style.backgroundColor = 'rgba(255,255,255,0.05)';
    trTotals.style.fontWeight = 'bold';

    if (isNational) {
        trTotals.innerHTML = `
            <td>TOTAL</td>
            <td>${formatNumber(sumChildren, 0)}</td>
            <td>${sumSch.toLocaleString()}</td>
            <td>${sumHcf.toLocaleString()}</td>
            <td>${sumCbc.toLocaleString()}</td>
            <td style="color: #67e8f9;">${formatCurrency(sumFair)}</td>
            <td style="color: #67e8f9;">${formatCurrencyUSD(sumFairUSD)}</td>
            <td style="color: #cbd5e1; font-size: 0.9em;">${formatCurrency(totalMwkPerInstSum)}</td>
        `;
    } else {
        trTotals.innerHTML = `
            <td>TOTAL</td>
            <td>${formatNumber(sumChildren, 0)}</td>
            <td>${sumSch.toLocaleString()}</td>
            <td>${sumHcf.toLocaleString()}</td>
            <td>${sumCbc.toLocaleString()}</td>
            <td>100.00%</td>
            <td style="color: #67e8f9;">${formatCurrency(sumFair)}</td>
            <td style="color: #67e8f9;">${formatCurrencyUSD(sumFairUSD)}</td>
            <td style="color: #cbd5e1; font-size: 0.9em;">${formatCurrency(totalMwkPerInstSum)}</td>
        `;
    }
    tbody.appendChild(trTotals);
}

function renderSVGMap(geojsons, institutionsData, width = 600, height = 400, colorMapFn = null, drawDistrictLabels = false, labelMode = 'district') {
    if (!geojsons || geojsons.length === 0) return '';
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;

    geojsons.forEach(f => {
        if (!f.geometry || !f.geometry.coordinates) return;
        if (f.geometry.type === 'Polygon') {
            f.geometry.coordinates[0].forEach(c => {
                minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0]);
                minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
            });
        } else if (f.geometry.type === 'MultiPolygon') {
            f.geometry.coordinates.forEach(poly => {
                poly[0].forEach(c => {
                    minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0]);
                    minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
                });
            });
        }
    });

    let padLon = (maxLon - minLon) * 0.08 || 0.05;
    let padLat = (maxLat - minLat) * 0.08 || 0.05;
    minLon -= padLon; maxLon += padLon;
    minLat -= padLat; maxLat += padLat;

    const lonRange = Math.max(maxLon - minLon, 1e-9);
    const latRange = Math.max(maxLat - minLat, 1e-9);
    const framePadPx = 12;
    const usableWidth = Math.max(width - (framePadPx * 2), 1);
    const usableHeight = Math.max(height - (framePadPx * 2), 1);
    const scale = Math.min(usableWidth / lonRange, usableHeight / latRange);
    const renderWidth = lonRange * scale;
    const renderHeight = latRange * scale;
    const offsetX = (width - renderWidth) / 2;
    const offsetY = (height - renderHeight) / 2;

    const lonToX = (lon) => offsetX + ((lon - minLon) * scale);
    const latToY = (lat) => height - (offsetY + ((lat - minLat) * scale));

    let svgPath = '';
    let featureLabels = '';

    let labelCentroids = {};

    geojsons.forEach(f => {
        if (!f.geometry || !f.geometry.coordinates) return;

        let fMinLon = 180, fMaxLon = -180, fMinLat = 90, fMaxLat = -90;

        const processRing = (ring) => {
            ring.forEach(c => {
                fMinLon = Math.min(fMinLon, c[0]); fMaxLon = Math.max(fMaxLon, c[0]);
                fMinLat = Math.min(fMinLat, c[1]); fMaxLat = Math.max(fMaxLat, c[1]);
            });
            return 'M ' + ring.map(c => `${lonToX(c[0]).toFixed(1)},${latToY(c[1]).toFixed(1)}`).join(' L ') + ' Z ';
        }

        let pathD = '';
        if (f.geometry.type === 'Polygon') {
            pathD = processRing(f.geometry.coordinates[0]);
        } else if (f.geometry.type === 'MultiPolygon') {
            f.geometry.coordinates.forEach(poly => { pathD += processRing(poly[0]); });
        }

        // Determine color for district
        let fillColor = '#3b82f6';
        let fillOpacity = 0.1;
        const districtName = f.properties.DistrictNa;

        if (colorMapFn) {
            const res = colorMapFn(districtName, f.properties.Population);
            fillColor = res.color;
            fillOpacity = res.opacity;
        }

        svgPath += `<path d="${pathD}" fill="${fillColor}" fill-opacity="${fillOpacity}" stroke="#3b82f6" stroke-width="1.5" />`;

        if (drawDistrictLabels) {
            const labelKey = labelMode === 'constituency' ? f.properties.ConstiName : districtName;
            if (labelKey && labelKey !== 'Unknown') {
                if (!labelCentroids[labelKey]) {
                    labelCentroids[labelKey] = {
                        minLon: fMinLon, maxLon: fMaxLon,
                        minLat: fMinLat, maxLat: fMaxLat
                    };
                } else {
                    labelCentroids[labelKey].minLon = Math.min(labelCentroids[labelKey].minLon, fMinLon);
                    labelCentroids[labelKey].maxLon = Math.max(labelCentroids[labelKey].maxLon, fMaxLon);
                    labelCentroids[labelKey].minLat = Math.min(labelCentroids[labelKey].minLat, fMinLat);
                    labelCentroids[labelKey].maxLat = Math.max(labelCentroids[labelKey].maxLat, fMaxLat);
                }
            }
        }
    });

    if (drawDistrictLabels) {
        Object.entries(labelCentroids).forEach(([name, bounds]) => {
            let cx = lonToX((bounds.maxLon + bounds.minLon) / 2);
            let cy = latToY((bounds.maxLat + bounds.minLat) / 2);
            featureLabels += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="sans-serif" font-size="11" fill="#1e293b" text-anchor="middle" font-weight="bold" stroke="#fff" stroke-width="2" paint-order="stroke">${name}</text>`;
        });
    }

    let markers = '';
    institutionsData.forEach(inst => {
        if (inst.lat >= minLat && inst.lat <= maxLat && inst.lon >= minLon && inst.lon <= maxLon) {
            let color = inst.type === 'SCHOOL' ? '#f59e0b' : (inst.type === 'HCF' ? '#ec4899' : '#10b981');
            let cx = lonToX(inst.lon).toFixed(1);
            let cy = latToY(inst.lat).toFixed(1);
            // Smaller circle radius
            markers += `<circle cx="${cx}" cy="${cy}" r="2" fill="${color}" stroke="#fff" stroke-width="0.5"/>`;
            // Smaller and less obtrusive label
            markers += `<text x="${parseFloat(cx) + 3}" y="${parseFloat(cy) + 2}" font-family="sans-serif" font-size="5" fill="#334155" font-weight="bold" stroke="#fff" stroke-width="1.5" paint-order="stroke">${inst.name.substring(0, 15)}</text>`;
        }
    });

    return `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px;">
        ${svgPath}
        ${featureLabels}
        ${markers}
    </svg>`;
}

function getChoroplethColorForDistrict(districtName, _unusedPopulation) {
    if (!currentMapScale) {
        return { color: '#3b82f6', opacity: 0.1 };
    }
    const districtData = dashboardData.districts[districtName];
    let fillColor = '#0f172a';
    let fillOpacity = 0.8;

    if (currentColorMode === 'hazard_children') {
        const hazardMetric = getSelectedHazardMetricKey();
        const hazardValueType = getSelectedHazardValueType();
        const hazardProfile = getDistrictHazardProfile(districtName);
        const hazardValue = hazardValueType === 'pct'
            ? toNumber(hazardProfile?.hazards?.[hazardMetric]?.pct)
            : toNumber(hazardProfile?.hazards?.[hazardMetric]?.count);
        fillColor = currentMapScale(hazardValue).hex();
        fillOpacity = hazardProfile && toNumber(hazardProfile.totalChildren) > 0 ? 0.8 : 0.2;
    } else if (districtData) {
        const districtChildren = toNumber(getDistrictHazardProfile(districtName)?.totalChildren);
        if (currentColorMode === 'total') {
            fillColor = currentMapScale(districtData.total).hex();
        } else if (currentColorMode === 'per_child') {
            const perChild = districtChildren > 0 ? districtData.total / districtChildren : 0;
            fillColor = currentMapScale(perChild).hex();
        } else if (currentColorMode === 'category') {
            let topCat = '-';
            let topCatVal = -1;
            for (const [cat, val] of Object.entries(districtData.categories)) {
                if (val > topCatVal) {
                    topCatVal = val;
                    topCat = cat;
                }
            }
            const catIndex = dashboardData.categories.indexOf(topCat);
            fillColor = catIndex >= 0 ? chartColors[catIndex % chartColors.length] : '#0f172a';
        } else if (currentColorMode === 'specific_category') {
            const selectedCat = document.getElementById('category-select').value;
            const val = districtData.categories[selectedCat] || 0;
            fillColor = currentMapScale(val).hex();
        } else if (currentColorMode === 'specific_category_child') {
            const selectedCat = document.getElementById('category-select').value;
            const val = districtData.categories[selectedCat] || 0;
            const perChild = districtChildren > 0 ? val / districtChildren : 0;
            fillColor = currentMapScale(perChild).hex();
        }
    } else {
        fillOpacity = 0.2;
    }
    return { color: fillColor, opacity: fillOpacity };
}

function generateHTMLBarChart(items, maxValue) {
    let html = '<div class="html-bar-chart">';
    items.forEach(item => {
        let pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        if (pct < 1 && item.value > 0) pct = 1; // minimum visible bar
        if (pct > 100) pct = 100;
        html += `
            <div class="h-bar-row">
                <div class="h-bar-label">${item.label}</div>
                <div class="h-bar-track">
                    <div class="h-bar-fill" style="width: ${pct}%; background-color: ${item.color};"></div>
                    <span class="h-bar-val">${formatCurrency(item.value)}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function cleanupPrintArtifacts(printContainer, progressOverlay) {
    document.body.classList.remove('printing');
    if (printContainer && document.body.contains(printContainer)) {
        document.body.removeChild(printContainer);
    }
    if (progressOverlay && document.body.contains(progressOverlay)) {
        document.body.removeChild(progressOverlay);
    }
}

function getConstructionBudget(districtName) {
    const cats = dashboardData.districts[districtName]?.categories;
    return cats && cats["Construction and Rehabilitation"] ? cats["Construction and Rehabilitation"] : 0;
}

function getDistrictAggregates(results, districtFilter = null) {
    const districtNames = districtFilter
        ? [districtFilter]
        : [...new Set(results.map(r => r.district))].sort();

    return districtNames.map(dist => {
        const distResults = results.filter(r => r.district === dist);
        const totalPop = distResults.reduce((acc, r) => acc + r.pop, 0);
        const totalSch = distResults.reduce((acc, r) => acc + r.sch, 0);
        const totalHcf = distResults.reduce((acc, r) => acc + r.hcf, 0);
        const totalCbc = distResults.reduce((acc, r) => acc + r.cbc, 0);
        const totalInst = totalSch + totalHcf + totalCbc;
        const constructionBudget = getConstructionBudget(dist);
        const districtGeo = geoStatsIndex.districts[dist] || {};
        const districtHazard = getDistrictHazardProfile(dist);

        return {
            district: dist,
            results: distResults,
            pop: totalPop,
            sch: totalSch,
            hcf: totalHcf,
            cbc: totalCbc,
            totalInst: totalInst,
            budget: constructionBudget,
            budgetUSD: constructionBudget / EXCHANGE_RATE_USD,
            mwkPerInst: totalInst > 0 ? constructionBudget / totalInst : 0,
            areaKm2: districtGeo.areaKm2 || 0,
            wardCount: districtGeo.wardCount || 0,
            constituencyCount: districtGeo.constituencyCount || 0,
            roadsKm: districtGeo.roadsKm || 0,
            waterwaysKm: districtGeo.waterwaysKm || 0,
            popDensity: districtGeo.popDensity || 0,
            roadDensityPer100Km2: districtGeo.roadDensityPer100Km2 || 0,
            waterwaysDensityPer100Km2: districtGeo.waterwaysDensityPer100Km2 || 0,
            institutionDensityPer100Km2: districtGeo.institutionDensityPer100Km2 || 0,
            hazard: districtHazard || getEmptyHazardProfile()
        };
    }).filter(d => d.results.length > 0);
}

function getConstituencyStats(districtName, constituencyName) {
    return geoStatsIndex.constituencies[getConstituencyKey(districtName, constituencyName)] || null;
}

function getDistrictHazardProfile(districtName) {
    return districtHazardIndex[normalizeName(districtName)] || null;
}

function getConstituencyHazardProfile(districtName, constituencyName) {
    return constituencyHazardIndex[getNormalizedConstituencyKey(districtName, constituencyName)] || null;
}

async function generateExportReport(mode = EXPORT_MODE_NATIONAL_DISTRICT) {
    if (!allocationResults || allocationResults.length === 0) {
        calculateFairAllocation();
    }
    if (!allocationResults || allocationResults.length === 0) {
        alert("No results to export. Please calculate allocation first.");
        return;
    }

    if (mode === EXPORT_MODE_DISTRICT && currentSelection === 'National') {
        alert("Select a district on the main dashboard before using District level print.");
        return;
    }

    document.body.classList.add('printing');

    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';

    // Remove old if exists
    const oldContainer = document.getElementById('print-container');
    if (oldContainer && oldContainer.parentNode) {
        oldContainer.parentNode.removeChild(oldContainer);
    }
    const oldOverlay = document.getElementById('print-progress-overlay');
    if (oldOverlay && oldOverlay.parentNode) {
        oldOverlay.parentNode.removeChild(oldOverlay);
    }

    const isNationalMode = mode !== EXPORT_MODE_DISTRICT;
    const districtFilter = mode === EXPORT_MODE_DISTRICT ? currentSelection : null;

    let pagesData = [];
    try {
        const districtRows = getDistrictAggregates(allocationResults, districtFilter);
        const reportTotals = districtRows.reduce((acc, d) => {
            acc.population += d.pop;
            acc.schools += d.sch;
            acc.hcfs += d.hcf;
            acc.cbccs += d.cbc;
            acc.totalInstitutions += d.totalInst;
            acc.areaKm2 += d.areaKm2;
            acc.roadsKm += d.roadsKm;
            acc.waterwaysKm += d.waterwaysKm;
            acc.targetBudget += d.budget;
            return acc;
        }, {
            population: 0,
            schools: 0,
            hcfs: 0,
            cbccs: 0,
            totalInstitutions: 0,
            areaKm2: 0,
            roadsKm: 0,
            waterwaysKm: 0,
            targetBudget: 0
        });
        const reportHazardProfile = combineHazardProfiles(districtRows.map(d => d.hazard));
        reportTotals.roadDensityPer100Km2 = reportTotals.areaKm2 > 0 ? (reportTotals.roadsKm / reportTotals.areaKm2) * 100 : 0;
        reportTotals.waterwayDensityPer100Km2 = reportTotals.areaKm2 > 0 ? (reportTotals.waterwaysKm / reportTotals.areaKm2) * 100 : 0;
        reportTotals.popDensity = reportTotals.areaKm2 > 0 ? reportTotals.population / reportTotals.areaKm2 : 0;
        reportTotals.instDensityPer100Km2 = reportTotals.areaKm2 > 0 ? (reportTotals.totalInstitutions / reportTotals.areaKm2) * 100 : 0;
        reportTotals.hazard = reportHazardProfile;
        districtRows.forEach(d => {
            pagesData.push({
                title: `District Report: ${d.district}`,
                type: 'district',
                entityName: d.district,
                stats: {
                    pop: d.pop,
                    sch: d.sch,
                    hcf: d.hcf,
                    cbc: d.cbc,
                    inst: d.totalInst,
                    budget: d.budget,
                    budgetUSD: d.budgetUSD,
                    mwkPerInst: d.mwkPerInst,
                    areaKm2: d.areaKm2,
                    wardCount: d.wardCount,
                    constituencyCount: d.constituencyCount,
                    roadsKm: d.roadsKm,
                    waterwaysKm: d.waterwaysKm,
                    popDensity: d.popDensity,
                    roadDensityPer100Km2: d.roadDensityPer100Km2,
                    waterwaysDensityPer100Km2: d.waterwaysDensityPer100Km2,
                    institutionDensityPer100Km2: d.institutionDensityPer100Km2,
                    hazard: d.hazard
                },
                childrenResults: d.results
            });
        });

        if (mode === EXPORT_MODE_NATIONAL_FULL || mode === EXPORT_MODE_DISTRICT) {
            const constituencyRows = mode === EXPORT_MODE_DISTRICT
                ? allocationResults.filter(r => r.district === currentSelection)
                : allocationResults.slice();

            constituencyRows
                .sort((a, b) => a.district.localeCompare(b.district) || a.area.localeCompare(b.area))
                .forEach(res => {
                    const cStats = getConstituencyStats(res.district, res.area);
                    const cHazard = getConstituencyHazardProfile(res.district, res.area) || getEmptyHazardProfile();
                    pagesData.push({
                        title: `Constituency Report: ${res.area} (${res.district})`,
                        type: 'constituency',
                        entityName: res.area,
                        stats: {
                            district: res.district,
                            pop: res.pop,
                            sch: res.sch,
                            hcf: res.hcf,
                            cbc: res.cbc,
                            inst: res.inst,
                            currentBudget: res.currentBudget,
                            fairBudget: res.fairBudget,
                            fairBudgetUSD: res.fairBudgetUSD,
                            diff: res.diff,
                            fairSharePct: res.fairSharePct,
                            mwkPerInst: res.mwkPerInst,
                            areaKm2: cStats?.areaKm2 || 0,
                            wardCount: cStats?.wardCount || 0,
                            roadsKm: cStats?.roadsKm || 0,
                            waterwaysKm: cStats?.waterwaysKm || 0,
                            popDensity: cStats?.popDensity || 0,
                            roadDensityPer100Km2: cStats?.roadDensityPer100Km2 || 0,
                            waterwaysDensityPer100Km2: cStats?.waterwaysDensityPer100Km2 || 0,
                            hasActualNetworkData: !!cStats?.hasActualNetworkData,
                            hazard: cHazard
                        },
                        childrenResults: [res]
                    });
                });
        }

        if (pagesData.length === 0) {
            alert("No data available for the selected report option.");
            cleanupPrintArtifacts(printContainer, null);
            return;
        }

    // --- Generate Front Page ---
    const frontGeojsonFeatures = mode === EXPORT_MODE_DISTRICT
        ? geojsonData.features.filter(f => f.properties.DistrictNa === currentSelection)
        : geojsonData.features;
    const coverTitle = mode === EXPORT_MODE_NATIONAL_FULL
        ? 'National District + Constituency Strategy'
        : (mode === EXPORT_MODE_DISTRICT ? `${currentSelection} District + Constituency Strategy` : 'National District Strategy');
    const coverScopeText = mode === EXPORT_MODE_NATIONAL_FULL
        ? 'Districts and Constituencies'
        : (mode === EXPORT_MODE_NATIONAL_DISTRICT ? 'Districts' : `District and Constituencies in ${currentSelection}`);
    const summaryLabelMode = mode === EXPORT_MODE_DISTRICT ? 'constituency' : 'district';

    const svgMapHtmlFront = renderSVGMap(frontGeojsonFeatures, [], 900, 650, getChoroplethColorForDistrict, false, 'district');
    const svgMapHtmlSummary = renderSVGMap(frontGeojsonFeatures, [], 900, 820, getChoroplethColorForDistrict, true, summaryLabelMode);

    const overviewPage = document.createElement('div');
    overviewPage.className = 'print-page';
    overviewPage.innerHTML = `
        <div class="print-header with-flag center" style="display:flex; flex-direction:column; align-items:center; text-align: center; border-bottom: none; padding-bottom: 0px; margin-top: 30px;">
            <span class="mw-flag print-cover-flag" aria-hidden="true"></span>
            <h1 style="font-size: 38px; color: #1e293b; margin-bottom: 10px; font-weight: 700;">CDF for Children</h1>
            <h2 style="font-size: 24px; color: #475569; font-weight: 400; margin-top: 0; margin-bottom: 20px;">${coverTitle}</h2>
        </div>
        
        <div class="print-stats" style="max-width: 750px; margin: 0 auto; text-align: left; font-size: 14px; color: #334155; line-height: 1.6;">
            <p>This report details child-focused CDF allocation insights across Malawian ${coverScopeText}. Target budget values are shown alongside child hazard exposure indicators and local institutional context (Public Schools, Health Facilities, and CBCCs).</p>
            
            <p><strong>Note on Sourcing Additional/Alternative Data:</strong> The current model serves as a foundation framework. For enhanced accuracy, local authorities are encouraged to continually populate the underlying database with high-resolution localized statistics or alternative environmental equity markers. Recommended themes for expanding this allocation model include:</p>
            <ul style="margin-top: 5px; margin-bottom: 20px; color: #475569; padding-left: 20px; font-size: 13px;">
                <li><strong>Children Exposure Basis:</strong> Child population (U18) and hazard extraction outputs from the UNICEF/ERA5 pipeline.</li>
                <li><strong>Health/Education Needs:</strong> HMIS data for active clinic operational statuses, and EMIS data for classroom deficit ratios.</li>
                <li><strong>Climate Vulnerability:</strong> Future iterations should inject Climate Risk parameters (e.g. drought or flood prevalence geometries) to weight mitigation fund targets towards harder hit areas.</li>
                <li><strong>Accessibility & Terrain Risk:</strong> Integrating rural road network constraints and terrain toughness models to boost equity allocations to isolated child populations.</li>
            </ul>
            
            <div style="margin-top: 15px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
                <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #64748b;">Selected Operational Weightings For This Report:</p>
                <p style="margin: 0; font-size: 15px;">
                    <strong>Children:</strong> ${document.getElementById('weight-pop-val').textContent}% &nbsp;|&nbsp; 
                    <strong>Schools:</strong> ${document.getElementById('weight-schools-val').textContent}% &nbsp;|&nbsp; 
                    <strong>Health Facilities:</strong> ${document.getElementById('weight-hcfs-val').textContent}% &nbsp;|&nbsp; 
                    <strong>CBCCs:</strong> ${document.getElementById('weight-cbccs-val').textContent}%
                </p>
            </div>

            <div style="margin-top: 12px; padding: 12px; background: #eef2ff; border-radius: 8px; border: 1px solid #c7d2fe;">
                <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 13px; text-transform: uppercase; color: #4338ca;">Disaggregated Scope Metrics</p>
                <div style="display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 12px; font-size: 12px; color:#1e293b;">
                    <div><strong>Children Population:</strong> ${formatNumber(reportTotals.hazard?.totalChildren || 0, 0)}</div>
                    <div><strong>Area:</strong> ${formatNumber(reportTotals.areaKm2, 1)} km2</div>
                    <div><strong>Children Density:</strong> ${reportTotals.areaKm2 > 0 ? formatNumber((reportTotals.hazard?.totalChildren || 0) / reportTotals.areaKm2, 1) : '0.0'} / km2</div>
                    <div><strong>Schools:</strong> ${formatNumber(reportTotals.schools, 0)}</div>
                    <div><strong>HCFs:</strong> ${formatNumber(reportTotals.hcfs, 0)}</div>
                    <div><strong>CBCCs:</strong> ${formatNumber(reportTotals.cbccs, 0)}</div>
                    <div><strong>Total Institutions:</strong> ${formatNumber(reportTotals.totalInstitutions, 0)}</div>
                    <div><strong>Road Network:</strong> ${formatNumber(reportTotals.roadsKm, 1)} km</div>
                    <div><strong>Waterways:</strong> ${formatNumber(reportTotals.waterwaysKm, 1)} km</div>
                    <div><strong>Road Density:</strong> ${formatNumber(reportTotals.roadDensityPer100Km2, 1)} /100 km2</div>
                    <div><strong>Waterway Density:</strong> ${formatNumber(reportTotals.waterwayDensityPer100Km2, 1)} /100 km2</div>
                    <div><strong>Inst Density:</strong> ${formatNumber(reportTotals.instDensityPer100Km2, 1)} /100 km2</div>
                    <div style="grid-column: span 3;"><strong>Target Budget Pool:</strong> ${formatCurrency(reportTotals.targetBudget)} (${formatCurrencyUSD(reportTotals.targetBudget / EXCHANGE_RATE_USD)})</div>
                </div>
            </div>
            ${renderPrintHazardSection(reportTotals.hazard, 'Child Hazard Exposure Summary (Report Scope)')}
            
            <p style="margin-top: 15px; font-size: 13px; color: #94a3b8; text-align: center;">Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="print-map-container" style="height: 560px; max-width: 900px; margin: 20px auto 0 auto; border: none; background: transparent;">
            ${svgMapHtmlFront}
        </div>
    `;
    printContainer.appendChild(overviewPage);

    // --- Generate Page 2 (Summary Map) ---
    const summaryPage = document.createElement('div');
    summaryPage.className = 'print-page';
    summaryPage.innerHTML = `
        <div class="print-header with-flag center" style="display:flex; flex-direction:column; align-items:center; text-align: center; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; padding-bottom: 10px;">
            <span class="mw-flag" aria-hidden="true"></span>
            <h2 style="font-size: 28px; color: #1e293b; margin: 0;">${isNationalMode ? 'National Summary Map' : currentSelection + ' Summary Map'}</h2>
            <p style="color: #64748b; margin-top: 5px; font-size: 14px;">Detailed Geographical Overview Layered by ${summaryLabelMode === 'district' ? 'District' : 'Constituency'} Bounds.</p>
        </div>
        <div class="print-map-container" style="height: 720px; max-width: 900px; margin: 0 auto; border: none; background: transparent;">
            ${svgMapHtmlSummary}
        </div>
    `;
    printContainer.appendChild(summaryPage);

    // --- Generate Pages ---
    for (let i = 0; i < pagesData.length; i++) {
        const pageData = pagesData[i];
        const page = document.createElement('div');
        page.className = `print-page ${pageData.type === 'district' ? 'district-report-page' : 'constituency-report-page'}`;

        const reportBadge = pageData.type === 'district' ? 'District-Level Report' : 'Constituency-Level Report';
        const reportClass = pageData.type === 'district' ? 'district-report-header' : 'constituency-report-header';
        let pageHtml = `
            <div class="print-header with-flag ${reportClass}">
                <span class="mw-flag" aria-hidden="true"></span>
                <span>${pageData.title}</span>
                <span class="report-type-badge ${pageData.type}">${reportBadge}</span>
            </div>
        `;

        // Generate data for this page map
        let pGeojsonFeatures = [];
        if (pageData.type === 'district') {
            pGeojsonFeatures = geojsonData.features.filter(f => f.properties.DistrictNa === pageData.entityName);
        } else {
            pGeojsonFeatures = geojsonData.features.filter(f => f.properties.ConstiName === pageData.entityName && f.properties.DistrictNa === pageData.childrenResults[0].district);
            if (pGeojsonFeatures.length === 0) {
                pGeojsonFeatures = geojsonData.features.filter(f => f.properties.DistrictNa === pageData.childrenResults[0].district);
            }
        }

        const mapHeight = pageData.type === 'district' ? 380 : 500;
        const mapLabelMode = pageData.type === 'district' ? 'constituency' : 'district';
        const drawPageLabels = pageData.type === 'district';
        const svgPageMap = renderSVGMap(
            pGeojsonFeatures,
            [],
            800,
            mapHeight,
            getChoroplethColorForDistrict,
            drawPageLabels,
            mapLabelMode
        );

        if (pageData.type === 'district') {
            const sumPop = pageData.childrenResults.reduce((a, r) => a + r.pop, 0);
            const sumSch = pageData.childrenResults.reduce((a, r) => a + r.sch, 0);
            const sumHcf = pageData.childrenResults.reduce((a, r) => a + r.hcf, 0);
            const sumCbc = pageData.childrenResults.reduce((a, r) => a + r.cbc, 0);
            const sumFair = pageData.childrenResults.reduce((a, r) => a + r.fairBudget, 0);
            const sumFairUSD = pageData.childrenResults.reduce((a, r) => a + r.fairBudgetUSD, 0);

            const totalInstSum = sumSch + sumHcf + sumCbc;
            const totalMwkPerInstSum = totalInstSum > 0 ? sumFair / totalInstSum : 0;
            const childGeoRows = pageData.childrenResults.map(r => ({
                res: r,
                stats: getConstituencyStats(r.district, r.area),
                hazard: getConstituencyHazardProfile(r.district, r.area) || getEmptyHazardProfile()
            }));
            const sumArea = childGeoRows.reduce((a, row) => a + (row.stats?.areaKm2 || 0), 0);
            const sumRoads = childGeoRows.reduce((a, row) => a + (row.stats?.roadsKm || 0), 0);
            const sumWaterways = childGeoRows.reduce((a, row) => a + (row.stats?.waterwaysKm || 0), 0);
            const sumChildrenTotal = childGeoRows.reduce((a, row) => a + toNumber(row.hazard?.totalChildren), 0);
            const sumAnyRiskChild = childGeoRows.reduce((a, row) => a + toNumber(row.hazard?.hazards?.any_risk?.count), 0);
            const sumAnyRiskPct = sumChildrenTotal > 0 ? (sumAnyRiskChild / sumChildrenTotal) * 100 : 0;

            // Re-calculate percentages for this specific district to show in the explanation
            const wPop = parseFloat(document.getElementById('weight-pop-val').textContent) / 100;
            const wSch = parseFloat(document.getElementById('weight-schools-val').textContent) / 100;
            const wHcf = parseFloat(document.getElementById('weight-hcfs-val').textContent) / 100;
            const wCbc = parseFloat(document.getElementById('weight-cbccs-val').textContent) / 100;

            pageHtml += `
                <div class="print-stats-grid">
                    <div><strong>Children Population:</strong> ${formatNumber(pageData.stats.hazard?.totalChildren || 0, 0)}</div>
                    <div><strong>Area:</strong> ${formatNumber(pageData.stats.areaKm2, 1)} km2</div>
                    <div><strong>Children Density:</strong> ${pageData.stats.areaKm2 > 0 ? formatNumber((pageData.stats.hazard?.totalChildren || 0) / pageData.stats.areaKm2, 1) : '0.0'} / km2</div>
                    <div><strong>Wards:</strong> ${formatNumber(pageData.stats.wardCount, 0)}</div>
                    <div><strong>Constituencies:</strong> ${formatNumber(pageData.stats.constituencyCount, 0)}</div>
                    <div><strong>Schools:</strong> ${formatNumber(pageData.stats.sch, 0)}</div>
                    <div><strong>HCFs:</strong> ${formatNumber(pageData.stats.hcf, 0)}</div>
                    <div><strong>CBCCs:</strong> ${formatNumber(pageData.stats.cbc, 0)}</div>
                    <div><strong>Total Institutions:</strong> ${formatNumber(pageData.stats.inst, 0)}</div>
                    <div><strong>Total Children:</strong> ${formatNumber(pageData.stats.hazard?.totalChildren || 0, 0)}</div>
                    <div><strong>Road Network:</strong> ${formatNumber(pageData.stats.roadsKm, 1)} km</div>
                    <div><strong>Waterways:</strong> ${formatNumber(pageData.stats.waterwaysKm, 1)} km</div>
                    <div><strong>Road Density:</strong> ${formatNumber(pageData.stats.roadDensityPer100Km2, 1)} /100 km2</div>
                    <div><strong>Waterway Density:</strong> ${formatNumber(pageData.stats.waterwaysDensityPer100Km2, 1)} /100 km2</div>
                    <div><strong>Inst Density:</strong> ${formatNumber(pageData.stats.institutionDensityPer100Km2, 1)} /100 km2</div>
                    <div><strong>Target Pool:</strong> ${formatCurrency(pageData.stats.budget)} (${formatCurrencyUSD(pageData.stats.budgetUSD)})</div>
                    <div><strong>MWK / Institution:</strong> ${formatCurrency(pageData.stats.mwkPerInst)}</div>
                </div>

                <div class="print-map-container" style="height: 380px; margin-bottom: 15px;">
                    ${svgPageMap}
                </div>

                <div style="background-color: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 5px 0; font-size: 11px; text-transform: uppercase;">Methodology Example: Fair Share Calculation</h4>
                    <p style="margin: 0; font-size: 10px; color: #475569;">Each Constituency's <strong>Fair Share %</strong> is calculated by evaluating its proportion of the District's total metrics, multiplied by the active weightings.</p>
                    <p style="margin: 3px 0 0 0; font-size: 10px; font-family: monospace; background: #fff; padding: 4px; border: 1px dashed #cbd5e1;">Fair Share % = ((Area_Pop / Dist_Pop) x ${(wPop * 100).toFixed(0)}%) + ((Area_Schools / Dist_Schools) x ${(wSch * 100).toFixed(0)}%) + ((Area_Health / Dist_Health) x ${(wHcf * 100).toFixed(0)}%) + ((Area_CBCCs / Dist_CBCCs) x ${(wCbc * 100).toFixed(0)}%)</p>
                </div>
                ${renderPrintHazardSection(pageData.stats.hazard, `District Child Hazard Exposure: ${pageData.entityName}`)}

                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Constituency</th>
                            <th>Children Pop.</th>
                            <th>Area<br>(km2)</th>
                            <th>Schools</th>
                            <th>HCFs</th>
                            <th>CBCCs</th>
                            <th>Total<br>Inst</th>
                            <th>Roads<br>(km)</th>
                            <th>Waterways<br>(km)</th>
                            <th>Children<br>Total</th>
                            <th>Any Risk<br>Exp (#)</th>
                            <th>Any Risk<br>Exp (%)</th>
                            <th>Fair Share %</th>
                            <th>Target<br>(MWK)</th>
                            <th>Target<br>(USD)</th>
                            <th>MWK / Inst</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${childGeoRows.map(({ res: r, stats, hazard }) => `
                            <tr>
                                <td><strong>${r.area}</strong></td>
                                <td>${formatNumber(hazard?.totalChildren || 0, 0)}</td>
                                <td>${formatNumber(stats?.areaKm2 || 0, 1)}</td>
                                <td>${r.sch.toLocaleString()}</td>
                                <td>${r.hcf.toLocaleString()}</td>
                                <td>${r.cbc.toLocaleString()}</td>
                                <td>${r.inst.toLocaleString()}</td>
                                <td>${formatNumber(stats?.roadsKm || 0, 1)}</td>
                                <td>${formatNumber(stats?.waterwaysKm || 0, 1)}</td>
                                <td>${formatNumber(hazard?.totalChildren || 0, 0)}</td>
                                <td>${formatNumber(hazard?.hazards?.any_risk?.count || 0, 0)}</td>
                                <td>${formatNumber(hazard?.hazards?.any_risk?.pct || 0, 1)}%</td>
                                <td>${r.fairSharePct.toFixed(2)}%</td>
                                <td>${formatCurrency(r.fairBudget)}</td>
                                <td>${formatCurrencyUSD(r.fairBudgetUSD)}</td>
                                <td>${formatCurrency(r.mwkPerInst)}</td>
                            </tr>
                        `).join('')}
                        <tr style="font-weight: bold; background-color: #f1f5f9; border-top: 2px solid #cbd5e1;">
                            <td>TOTAL</td>
                            <td>${formatNumber(sumChildrenTotal, 0)}</td>
                            <td>${formatNumber(sumArea, 1)}</td>
                            <td>${sumSch.toLocaleString()}</td>
                            <td>${sumHcf.toLocaleString()}</td>
                            <td>${sumCbc.toLocaleString()}</td>
                            <td>${totalInstSum.toLocaleString()}</td>
                            <td>${formatNumber(sumRoads, 1)}</td>
                            <td>${formatNumber(sumWaterways, 1)}</td>
                            <td>${formatNumber(sumChildrenTotal, 0)}</td>
                            <td>${formatNumber(sumAnyRiskChild, 0)}</td>
                            <td>${formatNumber(sumAnyRiskPct, 1)}%</td>
                            <td>100.00%</td>
                            <td>${formatCurrency(sumFair)}</td>
                            <td>${formatCurrencyUSD(sumFairUSD)}</td>
                            <td>${formatCurrency(totalMwkPerInstSum)}</td>
                        </tr>
                    </tbody>
                </table>
            `;
        } else {
            // Constituency detail
            const r = pageData.childrenResults[0];

            const wPop = parseFloat(document.getElementById('weight-pop-val').textContent) / 100;
            const wSch = parseFloat(document.getElementById('weight-schools-val').textContent) / 100;
            const wHcf = parseFloat(document.getElementById('weight-hcfs-val').textContent) / 100;
            const wCbc = parseFloat(document.getElementById('weight-cbccs-val').textContent) / 100;
            const hasNetworkData = pageData.stats.hasActualNetworkData;

            pageHtml += `
                <div class="print-stats-grid">
                    <div><strong>District:</strong> ${pageData.stats.district}</div>
                    <div><strong>Constituency:</strong> ${r.area}</div>
                    <div><strong>Children Population:</strong> ${formatNumber(pageData.stats.hazard?.totalChildren || 0, 0)}</div>
                    <div><strong>Area:</strong> ${formatNumber(pageData.stats.areaKm2, 1)} km2</div>
                    <div><strong>Children Density:</strong> ${pageData.stats.areaKm2 > 0 ? formatNumber((pageData.stats.hazard?.totalChildren || 0) / pageData.stats.areaKm2, 1) : '0.0'} / km2</div>
                    <div><strong>Wards:</strong> ${formatNumber(pageData.stats.wardCount, 0)}</div>
                    <div><strong>Schools:</strong> ${formatNumber(pageData.stats.sch, 0)}</div>
                    <div><strong>HCFs:</strong> ${formatNumber(pageData.stats.hcf, 0)}</div>
                    <div><strong>CBCCs:</strong> ${formatNumber(pageData.stats.cbc, 0)}</div>
                    <div><strong>Total Institutions:</strong> ${formatNumber(pageData.stats.inst, 0)}</div>
                    <div><strong>Total Children:</strong> ${formatNumber(pageData.stats.hazard?.totalChildren || 0, 0)}</div>
                    <div><strong>Any Risk Exposed:</strong> ${formatNumber(pageData.stats.hazard?.hazards?.any_risk?.count || 0, 0)} (${formatNumber(pageData.stats.hazard?.hazards?.any_risk?.pct || 0, 1)}%)</div>
                    <div><strong>Road Network:</strong> ${hasNetworkData ? `${formatNumber(pageData.stats.roadsKm, 1)} km` : 'No OSM lines detected'}</div>
                    <div><strong>Waterways:</strong> ${hasNetworkData ? `${formatNumber(pageData.stats.waterwaysKm, 1)} km` : 'No OSM lines detected'}</div>
                    <div><strong>Road Density:</strong> ${hasNetworkData ? `${formatNumber(pageData.stats.roadDensityPer100Km2, 1)} /100 km2` : 'n/a'}</div>
                    <div><strong>Waterway Density:</strong> ${hasNetworkData ? `${formatNumber(pageData.stats.waterwaysDensityPer100Km2, 1)} /100 km2` : 'n/a'}</div>
                    <div><strong>Fair Share:</strong> ${r.fairSharePct.toFixed(2)}%</div>
                    <div><strong>Target Budget:</strong> ${formatCurrency(pageData.stats.fairBudget)} (${formatCurrencyUSD(pageData.stats.fairBudgetUSD)})</div>
                    <div><strong>Baseline (Pop-only):</strong> ${formatCurrency(pageData.stats.currentBudget)}</div>
                    <div><strong>Difference:</strong> ${formatCurrency(pageData.stats.diff)}</div>
                    <div><strong>MWK / Institution:</strong> ${formatCurrency(pageData.stats.mwkPerInst)}</div>
                </div>

                <div class="print-map-container" style="height: 500px; margin-bottom: 20px;">
                    ${svgPageMap}
                </div>

                <div style="background-color: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase;">Allocation Calculation Profile for ${r.area}</h4>
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #334155; line-height: 1.5;">The <strong>Fair Budget Target</strong> for this constituency is derived by calculating its <strong>${r.fairSharePct.toFixed(2)}%</strong> consolidated demographic and institutional share of the larger district envelope.</p>
                    <p style="margin: 0; font-size: 11px; font-family: monospace; background: #fff; padding: 8px; border: 1px dashed #cbd5e1; line-height: 1.4;">
                        Fair Share % = <br>
                        ((Child Share) x ${(wPop * 100).toFixed(0)}%) + ((School Share) x ${(wSch * 100).toFixed(0)}%) + ((Health Share) x ${(wHcf * 100).toFixed(0)}%) + ((CBCC Share) x ${(wCbc * 100).toFixed(0)}%)<br>
                        <strong>Total: ${r.fairSharePct.toFixed(2)}%</strong> of District Pool -> <strong>${formatCurrency(pageData.stats.fairBudget)} / ${formatCurrencyUSD(pageData.stats.fairBudgetUSD)}</strong>
                    </p>
                </div>
                ${renderPrintHazardSection(pageData.stats.hazard, `Constituency Child Hazard Exposure: ${r.area}`)}
            `;
        }

        page.innerHTML = pageHtml;
        printContainer.appendChild(page);
    }

    document.body.appendChild(printContainer);

    // Ensure layout is committed before invoking print.
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));

    try {
        window.print();
    } finally {
        cleanupPrintArtifacts(printContainer, null);
    }
    } catch (error) {
        console.error("Error while generating print report:", error);
        cleanupPrintArtifacts(printContainer, null);
        alert("Unable to generate the print report. Please try again.");
    }
}

function exportCSV(mode = EXPORT_MODE_NATIONAL_DISTRICT) {
    if (!allocationResults || allocationResults.length === 0) {
        calculateFairAllocation();
    }
    if (!allocationResults || allocationResults.length === 0) {
        alert("No results to export. Please calculate allocation first.");
        return;
    }

    if (mode === EXPORT_MODE_DISTRICT && currentSelection === 'National') {
        alert("Select a district on the main dashboard before using District level export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    const baseColumns = [
        'Level',
        'District',
        'Constituency',
        'Children Population',
        'Area (km2)',
        'Children Density (/km2)',
        'Schools',
        'HCFs',
        'CBCCs',
        'Total Institutions',
        'Roads (km)',
        'Waterways (km)',
        'Road Density (/100 km2)',
        'Waterway Density (/100 km2)',
        'Fair Share %',
        'Target Budget (MWK)',
        'Target Budget (USD)',
        'Target Budget per Child (MWK)',
        'Target Budget per Child (USD)',
        'MWK per Inst'
    ];
    const detailedHeader = `${baseColumns.concat(getCategoryPerChildHeaderColumns(), getHazardCsvHeaderColumns()).join(",")}\n`;

    if (mode === EXPORT_MODE_NATIONAL_DISTRICT) {
        csvContent += detailedHeader;
        const districtRows = getDistrictAggregates(allocationResults, null);
        districtRows.forEach(d => {
            const childrenTotal = toNumber(d.hazard?.totalChildren);
            const childDensity = d.areaKm2 > 0 ? childrenTotal / d.areaKm2 : 0;
            const targetPerChild = childrenTotal > 0 ? d.budget / childrenTotal : 0;
            const targetUsdPerChild = childrenTotal > 0 ? d.budgetUSD / childrenTotal : 0;
            const row = [
                "District",
                `"${d.district}"`,
                '""',
                childrenTotal,
                d.areaKm2,
                childDensity,
                d.sch,
                d.hcf,
                d.cbc,
                d.totalInst,
                d.roadsKm,
                d.waterwaysKm,
                d.roadDensityPer100Km2,
                d.waterwaysDensityPer100Km2,
                "",
                d.budget,
                d.budgetUSD,
                targetPerChild,
                targetUsdPerChild,
                d.mwkPerInst,
                ...getDistrictCategoryPerChildValues(d.district, childrenTotal),
                ...getHazardCsvValues(d.hazard)
            ].join(",");
            csvContent += row + "\n";
        });
    } else if (mode === EXPORT_MODE_NATIONAL_FULL || mode === EXPORT_MODE_DISTRICT) {
        csvContent += detailedHeader;
        const districtRows = getDistrictAggregates(
            allocationResults,
            mode === EXPORT_MODE_DISTRICT ? currentSelection : null
        );
        districtRows.forEach(d => {
            const childrenTotal = toNumber(d.hazard?.totalChildren);
            const childDensity = d.areaKm2 > 0 ? childrenTotal / d.areaKm2 : 0;
            const targetPerChild = childrenTotal > 0 ? d.budget / childrenTotal : 0;
            const targetUsdPerChild = childrenTotal > 0 ? d.budgetUSD / childrenTotal : 0;
            const row = [
                "District",
                `"${d.district}"`,
                '""',
                childrenTotal,
                d.areaKm2,
                childDensity,
                d.sch,
                d.hcf,
                d.cbc,
                d.totalInst,
                d.roadsKm,
                d.waterwaysKm,
                d.roadDensityPer100Km2,
                d.waterwaysDensityPer100Km2,
                "",
                d.budget,
                d.budgetUSD,
                targetPerChild,
                targetUsdPerChild,
                d.mwkPerInst,
                ...getDistrictCategoryPerChildValues(d.district, childrenTotal),
                ...getHazardCsvValues(d.hazard)
            ].join(",");
            csvContent += row + "\n";
        });

        const constituencyRows = mode === EXPORT_MODE_DISTRICT
            ? allocationResults.filter(r => r.district === currentSelection)
            : allocationResults.slice();

        constituencyRows
            .sort((a, b) => a.district.localeCompare(b.district) || a.area.localeCompare(b.area))
            .forEach(r => {
                const cStats = getConstituencyStats(r.district, r.area);
                const cHazard = getConstituencyHazardProfile(r.district, r.area) || getEmptyHazardProfile();
                const childrenTotal = toNumber(cHazard.totalChildren);
                const childDensity = (cStats?.areaKm2 || 0) > 0 ? childrenTotal / (cStats?.areaKm2 || 0) : 0;
                const targetPerChild = childrenTotal > 0 ? r.fairBudget / childrenTotal : 0;
                const targetUsdPerChild = childrenTotal > 0 ? r.fairBudgetUSD / childrenTotal : 0;
                const row = [
                    "Constituency",
                    `"${r.district}"`,
                    `"${r.area}"`,
                    childrenTotal,
                    cStats?.areaKm2 || 0,
                    childDensity,
                    r.sch,
                    r.hcf,
                    r.cbc,
                    r.inst,
                    cStats?.roadsKm || 0,
                    cStats?.waterwaysKm || 0,
                    cStats?.roadDensityPer100Km2 || 0,
                    cStats?.waterwaysDensityPer100Km2 || 0,
                    r.fairSharePct,
                    r.fairBudget,
                    r.fairBudgetUSD,
                    targetPerChild,
                    targetUsdPerChild,
                    r.mwkPerInst,
                    ...getBlankCategoryPerChildValues(),
                    ...getHazardCsvValues(cHazard)
                ].join(",");
                csvContent += row + "\n";
            });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cdf_for_children_export_${mode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Start

document.addEventListener('DOMContentLoaded', init);
