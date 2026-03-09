var DISTRICT_BOUNDARIES = ee.FeatureCollection('projects/washways/assets/districts');
var CONSTITUENCY_BOUNDARIES = ee.FeatureCollection('projects/washways/assets/constituencies');

var START_DATE = '2020-01-01';
var END_DATE = '2025-02-01'; // exclusive
var WIND_THRESHOLD_KMH = 40;
var RAIN_THRESHOLD_MM = 40;
var WIND_EXCEED_DAYS_TIER_1 = 5;
var WIND_EXCEED_DAYS_TIER_2 = 15;
var WIND_EXCEED_DAYS_TIER_3 = 30;
var RAIN_EXCEED_DAYS_TIER_1 = 5;
var RAIN_EXCEED_DAYS_TIER_2 = 15;
var RAIN_EXCEED_DAYS_TIER_3 = 30;

var EXPORT_TO_DRIVE = true;
var EXPORT_GEOJSON = false;
// Run district and constituency exports separately when resources are tight.
var RUN_DISTRICT_EXPORT = true;
var RUN_CONSTITUENCY_EXPORT = false;
// Disable sample prints by default to avoid triggering full server evaluation timeouts.
var DEBUG_PRINT_SAMPLES = false;
// Optional heavy reducers; keep hazard intensity stats off by default for faster exports.
var INCLUDE_HAZARD_INTENSITY_STATS = false;
var INCLUDE_EXCEEDANCE_STATS = true;

var QUICK_MODE = true;
var EXCEEDANCE_SCALE_M = QUICK_MODE ? 10000 : 5000;
var HAZARD_SCALE_M = 1000;
// Keep child population reduction at 100 m to avoid denominator drift in exposure percentages.
var POP_SCALE_M = 100;
var TILE_SCALE = QUICK_MODE ? 8 : 4;

var MALAWI_BBOX = ee.Geometry.Rectangle([32.6, -17.2, 36.0, -9.2], 'EPSG:4326', false);

var windThresholdMs = ee.Number(WIND_THRESHOLD_KMH).divide(3.6);
var rainThresholdM = ee.Number(RAIN_THRESHOLD_MM).divide(1000);

var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/HOURLY');

var childpop = ee.ImageCollection('projects/unicef-ccri/assets/misc_population/WorldPop_Con_T_U18')
  .mosaic()
  .select(0)
  .rename('child_population')
  .clip(MALAWI_BBOX);

var riverFlood = ee.ImageCollection('projects/unicef-ccri/assets/hazards/river_flood_r100')
  .mosaic()
  .rename('river_flood')
  .clip(MALAWI_BBOX);

var agDrought = ee.Image('projects/unicef-ccri/assets/hazards/ASI_return_level_100yr')
  .rename('ag_drought')
  .updateMask(ee.Image('projects/unicef-ccri/assets/hazards/ASI_return_level_100yr').lte(100))
  .clip(MALAWI_BBOX);

var speiDrought = ee.Image('projects/unicef-ccri/assets/droughts/drought_spei_copernicus_1940_2024')
  .rename('spei_drought')
  .updateMask(ee.Image('projects/unicef-ccri/assets/droughts/drought_spei_copernicus_1940_2024').gt(-1000))
  .clip(MALAWI_BBOX);

var spiDrought = ee.Image('projects/unicef-ccri/assets/droughts/drought_spi_copernicus_1940_2024')
  .rename('spi_drought')
  .updateMask(ee.Image('projects/unicef-ccri/assets/droughts/drought_spi_copernicus_1940_2024').gt(-1000))
  .clip(MALAWI_BBOX);

var RIVER_FLOOD_THRESHOLD = 0.01;
var AG_DROUGHT_THRESHOLD = 30;
var SPEI_THRESHOLD = -1.5;
var SPI_THRESHOLD = -1.5;

function prepGeometry(feature) {
  return ee.Feature(feature)
    .geometry()
    .buffer(0)
    .intersection(MALAWI_BBOX, 1);
}

function cleanFeature(feature, level) {
  var districtName = ee.String(ee.Algorithms.If(feature.get('DistrictNa'), feature.get('DistrictNa'), ''));
  var constituencyName = ee.String(ee.Algorithms.If(feature.get('ConstiName'), feature.get('ConstiName'), ''));
  var featureId = ee.String(ee.Algorithms.If(
    level === 'district',
    districtName,
    districtName.cat('||').cat(constituencyName)
  ));

  return ee.Feature(prepGeometry(feature), feature.toDictionary())
    .set('feature_uid', featureId)
    .set('admin_level', level)
    .set('district_name', districtName)
    .set('constituency_name', constituencyName);
}

function monthChunks(startStr, endStrExclusive) {
  var chunks = [];
  var cursor = new Date(startStr + 'T00:00:00');
  var end = new Date(endStrExclusive + 'T00:00:00');

  while (cursor < end) {
    var chunkStart = new Date(cursor);
    var nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    var chunkEnd = nextMonth < end ? nextMonth : end;

    chunks.push({
      start: chunkStart.toISOString().slice(0, 10),
      end: chunkEnd.toISOString().slice(0, 10)
    });
    cursor = chunkEnd;
  }

  return chunks;
}

function dailyFlagsEra5(date) {
  date = ee.Date(date);
  var next = date.advance(1, 'day');

  var dayCollection = era5.filterDate(date, next).filterBounds(MALAWI_BBOX);

  var windDay = dayCollection
    .select(['u_component_of_wind_10m', 'v_component_of_wind_10m'])
    .map(function(img) {
      return img.select('u_component_of_wind_10m')
        .pow(2)
        .add(img.select('v_component_of_wind_10m').pow(2))
        .sqrt()
        .rename('wind_era5_exceed_days');
    })
    .max()
    .gt(windThresholdMs)
    .rename('wind_era5_exceed_days');

  var rainDay = dayCollection
    .select('total_precipitation_hourly')
    .sum()
    .gt(rainThresholdM)
    .rename('rain_era5_exceed_days');

  return windDay.addBands(rainDay).set('system:time_start', date.millis());
}

function monthlyEra5Exceedance(startStr, endStrExclusive) {
  var start = ee.Date(startStr);
  var end = ee.Date(endStrExclusive);
  var dayCount = end.difference(start, 'day');

  var dates = ee.List.sequence(0, dayCount.subtract(1)).map(function(offset) {
    return start.advance(offset, 'day');
  });

  return ee.ImageCollection.fromImages(dates.map(dailyFlagsEra5))
    .sum()
    .rename(['wind_era5_exceed_days', 'rain_era5_exceed_days']);
}

function buildEra5ExceedanceTotals(startStr, endStrExclusive) {
  var monthlyImages = monthChunks(startStr, endStrExclusive).map(function(chunk) {
    return monthlyEra5Exceedance(chunk.start, chunk.end);
  });

  return ee.ImageCollection.fromImages(monthlyImages)
    .sum()
    .clip(MALAWI_BBOX)
    .rename(['wind_era5_exceed_days', 'rain_era5_exceed_days']);
}

var era5ExceedanceTotals = buildEra5ExceedanceTotals(START_DATE, END_DATE);

var riverFloodMask = riverFlood.gt(RIVER_FLOOD_THRESHOLD);
var agDroughtMask = agDrought.gt(AG_DROUGHT_THRESHOLD);
var speiDroughtMask = speiDrought.lt(SPEI_THRESHOLD);
var spiDroughtMask = spiDrought.lt(SPI_THRESHOLD);
var droughtAnyMask = agDroughtMask.or(speiDroughtMask).or(spiDroughtMask);
var windExceedDays = era5ExceedanceTotals.select('wind_era5_exceed_days');
var rainExceedDays = era5ExceedanceTotals.select('rain_era5_exceed_days');
var windExceedMask = windExceedDays.gt(0);
var rainExceedMask = rainExceedDays.gt(0);
var windExceedMaskGe5d = windExceedDays.gte(WIND_EXCEED_DAYS_TIER_1);
var windExceedMaskGe15d = windExceedDays.gte(WIND_EXCEED_DAYS_TIER_2);
var windExceedMaskGe30d = windExceedDays.gte(WIND_EXCEED_DAYS_TIER_3);
var rainExceedMaskGe5d = rainExceedDays.gte(RAIN_EXCEED_DAYS_TIER_1);
var rainExceedMaskGe15d = rainExceedDays.gte(RAIN_EXCEED_DAYS_TIER_2);
var rainExceedMaskGe30d = rainExceedDays.gte(RAIN_EXCEED_DAYS_TIER_3);
var anyExceedMask = windExceedMask.or(rainExceedMask);
var anyRiskMask = riverFloodMask.or(droughtAnyMask).or(anyExceedMask);

var populationExposureImage = ee.Image.cat([
  childpop,
  childpop.updateMask(riverFloodMask).rename('river_flood_exposed_children'),
  childpop.updateMask(agDroughtMask).rename('ag_drought_exposed_children'),
  childpop.updateMask(speiDroughtMask).rename('spei_drought_exposed_children'),
  childpop.updateMask(spiDroughtMask).rename('spi_drought_exposed_children'),
  childpop.updateMask(droughtAnyMask).rename('drought_any_exposed_children'),
  childpop.updateMask(windExceedMask).rename('wind_era5_exposed_children'),
  childpop.updateMask(windExceedMaskGe5d).rename('wind_era5_ge5d_exposed_children'),
  childpop.updateMask(windExceedMaskGe15d).rename('wind_era5_ge15d_exposed_children'),
  childpop.updateMask(windExceedMaskGe30d).rename('wind_era5_ge30d_exposed_children'),
  childpop.updateMask(rainExceedMask).rename('rain_era5_exposed_children'),
  childpop.updateMask(rainExceedMaskGe5d).rename('rain_era5_ge5d_exposed_children'),
  childpop.updateMask(rainExceedMaskGe15d).rename('rain_era5_ge15d_exposed_children'),
  childpop.updateMask(rainExceedMaskGe30d).rename('rain_era5_ge30d_exposed_children'),
  childpop.updateMask(anyExceedMask).rename('any_exceed_exposed_children'),
  childpop.updateMask(anyRiskMask).rename('any_risk_exposed_children')
]);

var areaExposureImage = ee.Image.cat([
  ee.Image.pixelArea().divide(1e6).updateMask(riverFloodMask).rename('river_flood_affected_km2'),
  ee.Image.pixelArea().divide(1e6).updateMask(agDroughtMask).rename('ag_drought_affected_km2'),
  ee.Image.pixelArea().divide(1e6).updateMask(speiDroughtMask).rename('spei_drought_affected_km2'),
  ee.Image.pixelArea().divide(1e6).updateMask(spiDroughtMask).rename('spi_drought_affected_km2'),
  ee.Image.pixelArea().divide(1e6).updateMask(droughtAnyMask).rename('drought_any_affected_km2'),
  ee.Image.pixelArea().divide(1e6).updateMask(anyRiskMask).rename('any_risk_affected_km2')
]);

var hazardIntensityImage = ee.Image.cat([
  riverFlood,
  agDrought,
  speiDrought,
  spiDrought
]);

function withBaseFields(collection, level) {
  return collection
    .filter(ee.Filter.notNull(['DistrictNa']))
    .map(function(feature) {
      return cleanFeature(feature, level);
    });
}

function reduceSum(collection, image, scale) {
  return image.reduceRegions({
    collection: collection,
    reducer: ee.Reducer.sum(),
    scale: scale,
    tileScale: TILE_SCALE,
    maxPixelsPerRegion: 1e10
  });
}

function reduceHazardStats(collection) {
  var reducer = ee.Reducer.mean()
    .combine(ee.Reducer.minMax(), '', true)
    .combine(ee.Reducer.percentile([10, 90]), '', true);

  return hazardIntensityImage.reduceRegions({
    collection: collection,
    reducer: reducer,
    scale: HAZARD_SCALE_M,
    tileScale: TILE_SCALE,
    maxPixelsPerRegion: 1e10
  });
}

function reduceExceedanceStats(collection) {
  var reducer = ee.Reducer.mean()
    .combine(ee.Reducer.max(), '', true)
    .combine(ee.Reducer.percentile([90]), '', true);

  return era5ExceedanceTotals.reduceRegions({
    collection: collection,
    reducer: reducer,
    scale: EXCEEDANCE_SCALE_M,
    tileScale: TILE_SCALE,
    maxPixelsPerRegion: 1e10
  });
}

function mergeProperties(baseFc, extraFc, propertyNames) {
  var join = ee.Join.saveFirst('matched');
  var joined = join.apply({
    primary: baseFc,
    secondary: extraFc,
    condition: ee.Filter.equals({
      leftField: 'feature_uid',
      rightField: 'feature_uid'
    })
  });

  return ee.FeatureCollection(joined).map(function(feature) {
    var matched = ee.Feature(feature.get('matched'));
    var dict = ee.Dictionary(ee.Algorithms.If(
      feature.get('matched'),
      matched.toDictionary(propertyNames),
      ee.Dictionary({})
    ));
    return ee.Feature(feature).setMulti(dict);
  });
}

function addThresholdsAndPercents(feature) {
  var totalChildren = ee.Number(ee.Algorithms.If(feature.get('child_population'), feature.get('child_population'), 0));

  function pct(prop) {
    var value = ee.Number(ee.Algorithms.If(feature.get(prop), feature.get(prop), 0));
    return ee.Algorithms.If(totalChildren.gt(0), value.divide(totalChildren).multiply(100), 0);
  }

  return feature
    .set('river_flood_threshold', RIVER_FLOOD_THRESHOLD)
    .set('ag_drought_threshold', AG_DROUGHT_THRESHOLD)
    .set('spei_drought_threshold', SPEI_THRESHOLD)
    .set('spi_drought_threshold', SPI_THRESHOLD)
    .set('wind_threshold_kmh', WIND_THRESHOLD_KMH)
    .set('rain_threshold_mm_day', RAIN_THRESHOLD_MM)
    .set('wind_exceed_days_tier_1', WIND_EXCEED_DAYS_TIER_1)
    .set('wind_exceed_days_tier_2', WIND_EXCEED_DAYS_TIER_2)
    .set('wind_exceed_days_tier_3', WIND_EXCEED_DAYS_TIER_3)
    .set('rain_exceed_days_tier_1', RAIN_EXCEED_DAYS_TIER_1)
    .set('rain_exceed_days_tier_2', RAIN_EXCEED_DAYS_TIER_2)
    .set('rain_exceed_days_tier_3', RAIN_EXCEED_DAYS_TIER_3)
    .set('analysis_start', START_DATE)
    .set('analysis_end_exclusive', END_DATE)
    .set('analysis_scale_m', EXCEEDANCE_SCALE_M)
    .set('river_flood_exposed_children_pct', pct('river_flood_exposed_children'))
    .set('ag_drought_exposed_children_pct', pct('ag_drought_exposed_children'))
    .set('spei_drought_exposed_children_pct', pct('spei_drought_exposed_children'))
    .set('spi_drought_exposed_children_pct', pct('spi_drought_exposed_children'))
    .set('drought_any_exposed_children_pct', pct('drought_any_exposed_children'))
    .set('wind_era5_exposed_children_pct', pct('wind_era5_exposed_children'))
    .set('wind_era5_ge5d_exposed_children_pct', pct('wind_era5_ge5d_exposed_children'))
    .set('wind_era5_ge15d_exposed_children_pct', pct('wind_era5_ge15d_exposed_children'))
    .set('wind_era5_ge30d_exposed_children_pct', pct('wind_era5_ge30d_exposed_children'))
    .set('rain_era5_exposed_children_pct', pct('rain_era5_exposed_children'))
    .set('rain_era5_ge5d_exposed_children_pct', pct('rain_era5_ge5d_exposed_children'))
    .set('rain_era5_ge15d_exposed_children_pct', pct('rain_era5_ge15d_exposed_children'))
    .set('rain_era5_ge30d_exposed_children_pct', pct('rain_era5_ge30d_exposed_children'))
    .set('any_exceed_exposed_children_pct', pct('any_exceed_exposed_children'))
    .set('any_risk_exposed_children_pct', pct('any_risk_exposed_children'));
}

function buildOutput(collection, level) {
  var base = withBaseFields(collection, level);
  var popReduced = reduceSum(base, populationExposureImage, POP_SCALE_M);
  var areaReduced = reduceSum(base, areaExposureImage, HAZARD_SCALE_M);

  var popFields = [
    'child_population',
    'river_flood_exposed_children',
    'ag_drought_exposed_children',
    'spei_drought_exposed_children',
    'spi_drought_exposed_children',
    'drought_any_exposed_children',
    'wind_era5_exposed_children',
    'wind_era5_ge5d_exposed_children',
    'wind_era5_ge15d_exposed_children',
    'wind_era5_ge30d_exposed_children',
    'rain_era5_exposed_children',
    'rain_era5_ge5d_exposed_children',
    'rain_era5_ge15d_exposed_children',
    'rain_era5_ge30d_exposed_children',
    'any_exceed_exposed_children',
    'any_risk_exposed_children'
  ];

  var areaFields = [
    'river_flood_affected_km2',
    'ag_drought_affected_km2',
    'spei_drought_affected_km2',
    'spi_drought_affected_km2',
    'drought_any_affected_km2',
    'any_risk_affected_km2'
  ];

  var hazardFields = [
    'river_flood_mean',
    'river_flood_min',
    'river_flood_max',
    'river_flood_p10',
    'river_flood_p90',
    'ag_drought_mean',
    'ag_drought_min',
    'ag_drought_max',
    'ag_drought_p10',
    'ag_drought_p90',
    'spei_drought_mean',
    'spei_drought_min',
    'spei_drought_max',
    'spei_drought_p10',
    'spei_drought_p90',
    'spi_drought_mean',
    'spi_drought_min',
    'spi_drought_max',
    'spi_drought_p10',
    'spi_drought_p90'
  ];

  var exceedFields = [
    'wind_era5_exceed_days_mean',
    'wind_era5_exceed_days_max',
    'wind_era5_exceed_days_p90',
    'rain_era5_exceed_days_mean',
    'rain_era5_exceed_days_max',
    'rain_era5_exceed_days_p90'
  ];

  var merged = mergeProperties(base, popReduced, popFields);
  merged = mergeProperties(merged, areaReduced, areaFields);

  if (INCLUDE_HAZARD_INTENSITY_STATS) {
    var hazardReduced = reduceHazardStats(base);
    merged = mergeProperties(merged, hazardReduced, hazardFields);
  }

  if (INCLUDE_EXCEEDANCE_STATS) {
    var exceedReduced = reduceExceedanceStats(base);
    merged = mergeProperties(merged, exceedReduced, exceedFields);
  }

  return merged.map(addThresholdsAndPercents);
}

var districtOut = RUN_DISTRICT_EXPORT ? buildOutput(DISTRICT_BOUNDARIES, 'district') : null;
var constituencyOut = RUN_CONSTITUENCY_EXPORT ? buildOutput(CONSTITUENCY_BOUNDARIES, 'constituency') : null;

var districtSelectors = [
  'feature_uid',
  'admin_level',
  'district_name',
  'child_population',
  'river_flood_threshold',
  'river_flood_mean',
  'river_flood_min',
  'river_flood_max',
  'river_flood_p10',
  'river_flood_p90',
  'river_flood_affected_km2',
  'river_flood_exposed_children',
  'river_flood_exposed_children_pct',
  'ag_drought_threshold',
  'ag_drought_mean',
  'ag_drought_min',
  'ag_drought_max',
  'ag_drought_p10',
  'ag_drought_p90',
  'ag_drought_affected_km2',
  'ag_drought_exposed_children',
  'ag_drought_exposed_children_pct',
  'spei_drought_threshold',
  'spei_drought_mean',
  'spei_drought_min',
  'spei_drought_max',
  'spei_drought_p10',
  'spei_drought_p90',
  'spei_drought_affected_km2',
  'spei_drought_exposed_children',
  'spei_drought_exposed_children_pct',
  'spi_drought_threshold',
  'spi_drought_mean',
  'spi_drought_min',
  'spi_drought_max',
  'spi_drought_p10',
  'spi_drought_p90',
  'spi_drought_affected_km2',
  'spi_drought_exposed_children',
  'spi_drought_exposed_children_pct',
  'drought_any_exposed_children',
  'drought_any_exposed_children_pct',
  'drought_any_affected_km2',
  'wind_threshold_kmh',
  'rain_threshold_mm_day',
  'wind_exceed_days_tier_1',
  'wind_exceed_days_tier_2',
  'wind_exceed_days_tier_3',
  'rain_exceed_days_tier_1',
  'rain_exceed_days_tier_2',
  'rain_exceed_days_tier_3',
  'analysis_start',
  'analysis_end_exclusive',
  'analysis_scale_m',
  'wind_era5_exceed_days_mean',
  'wind_era5_exceed_days_max',
  'wind_era5_exceed_days_p90',
  'rain_era5_exceed_days_mean',
  'rain_era5_exceed_days_max',
  'rain_era5_exceed_days_p90',
  'wind_era5_exposed_children',
  'wind_era5_exposed_children_pct',
  'wind_era5_ge5d_exposed_children',
  'wind_era5_ge5d_exposed_children_pct',
  'wind_era5_ge15d_exposed_children',
  'wind_era5_ge15d_exposed_children_pct',
  'wind_era5_ge30d_exposed_children',
  'wind_era5_ge30d_exposed_children_pct',
  'rain_era5_exposed_children',
  'rain_era5_exposed_children_pct',
  'rain_era5_ge5d_exposed_children',
  'rain_era5_ge5d_exposed_children_pct',
  'rain_era5_ge15d_exposed_children',
  'rain_era5_ge15d_exposed_children_pct',
  'rain_era5_ge30d_exposed_children',
  'rain_era5_ge30d_exposed_children_pct',
  'any_exceed_exposed_children',
  'any_exceed_exposed_children_pct',
  'any_risk_exposed_children',
  'any_risk_exposed_children_pct',
  'any_risk_affected_km2'
];

var constituencySelectors = [
  'feature_uid',
  'admin_level',
  'district_name',
  'constituency_name'
].concat(districtSelectors.slice(4));

Map.setOptions('SATELLITE');
Map.setCenter(34.3, -13.5, 7);

Map.addLayer(
  childpop,
  {min: 0, max: 500, palette: ['#fff7ec', '#fdd49e', '#fc8d59', '#d7301f', '#7f0000']},
  'Child Population',
  true
);

Map.addLayer(
  riverFlood,
  {min: 0, max: 1, palette: ['#cfe8ff', '#8fcbff', '#1d7bff', '#0654be', '#00357d']},
  'River Flood',
  false
);

Map.addLayer(
  era5ExceedanceTotals.select('wind_era5_exceed_days'),
  {min: 0, max: 120, palette: ['#fff5eb', '#fd8d3c', '#7f2704']},
  'Wind Exceed Days ERA5',
  false
);

Map.addLayer(
  era5ExceedanceTotals.select('rain_era5_exceed_days'),
  {min: 0, max: 120, palette: ['#f7fbff', '#6baed6', '#08306b']},
  'Rain Exceed Days ERA5',
  false
);

Map.addLayer(
  DISTRICT_BOUNDARIES.style({color: '#2563eb', width: 2, fillColor: '00000000'}),
  {},
  'District Boundaries',
  true
);

Map.addLayer(
  CONSTITUENCY_BOUNDARIES.style({color: '#00ffaa', width: 1, fillColor: '00000000'}),
  {},
  'Constituency Boundaries',
  false
);

if (DEBUG_PRINT_SAMPLES && districtOut) {
  print('District sample', districtOut.limit(5));
}
if (DEBUG_PRINT_SAMPLES && constituencyOut) {
  print('Constituency sample', constituencyOut.limit(5));
}

if (EXPORT_TO_DRIVE) {
  if (districtOut) {
    Export.table.toDrive({
      collection: districtOut.select(districtSelectors),
      description: 'washways_district_risks_v3',
      fileFormat: 'CSV',
      selectors: districtSelectors
    });
  }

  if (constituencyOut) {
    Export.table.toDrive({
      collection: constituencyOut.select(constituencySelectors),
      description: 'washways_constituency_risks_v3',
      fileFormat: 'CSV',
      selectors: constituencySelectors
    });
  }

  if (EXPORT_GEOJSON) {
    if (districtOut) {
      Export.table.toDrive({
        collection: districtOut.select(districtSelectors),
        description: 'washways_district_risks_v3_geojson',
        fileFormat: 'GeoJSON',
        selectors: districtSelectors
      });
    }

    if (constituencyOut) {
      Export.table.toDrive({
        collection: constituencyOut.select(constituencySelectors),
        description: 'washways_constituency_risks_v3_geojson',
        fileFormat: 'GeoJSON',
        selectors: constituencySelectors
      });
    }
  }
}
