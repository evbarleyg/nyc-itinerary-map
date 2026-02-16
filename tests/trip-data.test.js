import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildMapConfigFromDay,
  getDayById,
  getFixedDaysFromTrip,
  loadTripData,
} from '../shared/trip-data.js';

const tripJson = fs.readFileSync(new URL('../public/nyc_trip_final.json', import.meta.url), 'utf8');

async function withMockedFetch(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return JSON.parse(tripJson);
    },
  });

  try {
    return await handler();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('loadTripData reads trip JSON payload', async () => {
  await withMockedFetch(async () => {
    const trip = await loadTripData();
    assert.equal(Array.isArray(trip.days), true);
    assert.ok(trip.days.length >= 3);
  });
});

test('fixed day extraction includes Friday, Saturday, and Sunday', async () => {
  await withMockedFetch(async () => {
    const trip = await loadTripData();
    const fixedDays = getFixedDaysFromTrip(trip);
    const ids = fixedDays.map((day) => day.id);
    assert.deepEqual(ids, ['friday', 'saturday', 'sunday']);
  });
});

test('Saturday resolves to Roosevelt Island actuals in map config', async () => {
  await withMockedFetch(async () => {
    const trip = await loadTripData();
    const saturday = getDayById(trip, 'saturday');
    assert.ok(saturday, 'Missing Saturday day');

    const config = buildMapConfigFromDay(saturday, trip);
    const stepTitles = config.steps.map((step) => step.title);
    const stopNames = config.stops.map((stop) => stop.name);

    assert.ok(stepTitles.includes('Walk to Roosevelt Island Tramway from hotel'));
    assert.ok(stepTitles.includes('Roosevelt Island via Tram'));
    assert.ok(stopNames.includes('Frank'));
    assert.ok(config.routes.some((route) => /Walk: Hotel -> Tramway/.test(route.name)));

    const stopIds = config.stops.map((stop) => stop.id);
    assert.ok(stopIds.length < config.steps.length + 2, 'Expected stop dedupe across repeated locations');
    assert.equal(
      config.routes.some((route) => /Arrive for show -> Comedy show/.test(route.name)),
      false,
      'Should not draw zero-length route between identical comedy locations',
    );
  });
});

test('Sunday completed actuals are retained with ordered map routing', async () => {
  await withMockedFetch(async () => {
    const trip = await loadTripData();
    const sunday = getDayById(trip, 'sunday');
    assert.ok(sunday, 'Missing Sunday day');

    assert.ok(sunday.items.every((item) => item.status === 'completed'));
    assert.ok(sunday.items.some((item) => item.title === 'Subway: Thompson Central Park -> Vineapple'));
    assert.ok(sunday.items.some((item) => item.title === "Watch Summer House at Nathaniel + Lindsay's apartment"));

    const dinner = sunday.items.find((item) => item.title === 'Joined the girls at Pastis');
    assert.ok(dinner, 'Missing Pastis meetup item');
    assert.equal(dinner.locations?.[0]?.address, '52 Gansevoort St, New York, NY 10014');

    const config = buildMapConfigFromDay(sunday, trip);
    const stepMeta = config.steps.map((step) => step.meta).join(' | ');
    assert.match(stepMeta, /Completed/);
    assert.ok(
      config.routes.some((route) => /Brunch at Vineapple -> Walk Brooklyn Heights Promenade to Brooklyn Bridge/.test(route.name)),
    );
    assert.ok(config.routes.some((route) => /Subway: Thompson Central Park -> Vineapple/.test(route.name)));
    assert.ok(
      config.routes.some((route) => /Joined the girls at Pastis -> Walked to Nathaniel \+ Lindsay's apartment/.test(route.name)),
    );
    assert.ok(
      config.routes.some(
        (route) => /Watch Summer House at Nathaniel \+ Lindsay's apartment -> Ubered back to hotel/.test(route.name),
      ),
    );
  });
});
