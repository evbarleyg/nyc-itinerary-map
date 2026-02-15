import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetDayHistoryForTests,
  getActiveDay,
  listDays,
  parsePathFile,
  saveUploadedPath,
  setActiveDay,
} from '../shared/day-history.js';

function makeFile(name, type, content) {
  return {
    name,
    type,
    async text() {
      return content;
    },
  };
}

test('GPX parse returns non-empty LineString feature collection', () => {
  __resetDayHistoryForTests();
  const gpx = `<?xml version="1.0"?>
  <gpx version="1.1">
    <trk><name>Track</name><trkseg>
      <trkpt lat="40.701" lon="-73.99"></trkpt>
      <trkpt lat="40.702" lon="-73.98"></trkpt>
      <trkpt lat="40.703" lon="-73.97"></trkpt>
    </trkseg></trk>
  </gpx>`;

  const parsed = parsePathFile(gpx, 'route.gpx');
  assert.equal(parsed.type, 'FeatureCollection');
  assert.ok(parsed.features.length >= 1);
  assert.equal(parsed.features[0].geometry.type, 'LineString');
  assert.ok(parsed.features[0].geometry.coordinates.length >= 2);
});

test('KML parse returns non-empty LineString feature collection', () => {
  __resetDayHistoryForTests();
  const kml = `<?xml version="1.0"?>
  <kml><Document>
    <Placemark><LineString><coordinates>
      -73.99,40.701,0 -73.98,40.702,0 -73.97,40.703,0
    </coordinates></LineString></Placemark>
  </Document></kml>`;

  const parsed = parsePathFile(kml, 'route.kml');
  assert.equal(parsed.type, 'FeatureCollection');
  assert.ok(parsed.features.length >= 1);
  assert.equal(parsed.features[0].geometry.type, 'LineString');
  assert.ok(parsed.features[0].geometry.coordinates.length >= 2);
});

test('GeoJSON LineString parse succeeds', () => {
  __resetDayHistoryForTests();
  const geojson = JSON.stringify({
    type: 'LineString',
    coordinates: [
      [-73.99, 40.701],
      [-73.98, 40.702],
      [-73.97, 40.703],
    ],
  });

  const parsed = parsePathFile(geojson, 'route.geojson');
  assert.equal(parsed.type, 'FeatureCollection');
  assert.equal(parsed.features.length, 1);
  assert.equal(parsed.features[0].geometry.type, 'LineString');
});

test('Unsupported or invalid path file throws deterministic errors', () => {
  __resetDayHistoryForTests();
  assert.throws(
    () => parsePathFile('not a map path', 'notes.txt'),
    /Unsupported path file format\. Use GPX, KML, or GeoJSON\./,
  );
  assert.throws(() => parsePathFile('  ', 'empty.gpx'), /Path file is empty\./);
});

test('Fixed tabs remain first and uploaded day appears after save with map href', async () => {
  __resetDayHistoryForTests();

  const geojson = JSON.stringify({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-73.99, 40.701],
        [-73.98, 40.702],
      ],
    },
    properties: {},
  });

  const file = makeFile('iphone-day.geojson', 'application/geo+json', geojson);
  const saved = await saveUploadedPath(file, { date: '2026-02-15', title: 'Sunday' });
  const tabs = listDays();

  assert.equal(tabs[0].id, 'friday');
  assert.equal(tabs[1].id, 'saturday');
  assert.equal(tabs[2].id, 'sunday');
  assert.ok(tabs.slice(3).some((day) => day.id === saved.day.id));

  const uploaded = tabs.find((day) => day.id === saved.day.id);
  assert.equal(uploaded.kind, 'uploaded');
  assert.match(uploaded.href, /^\/\?day=/);
});

test('Active day switches correctly', async () => {
  __resetDayHistoryForTests();

  const geojson = JSON.stringify({
    type: 'LineString',
    coordinates: [
      [-73.99, 40.701],
      [-73.98, 40.702],
    ],
  });
  const file = makeFile('day.geojson', 'application/json', geojson);
  const saved = await saveUploadedPath(file, { date: '2026-02-16', title: 'Monday' });

  assert.equal(getActiveDay(), saved.day.id);
  setActiveDay('friday');
  assert.equal(getActiveDay(), 'friday');
});
