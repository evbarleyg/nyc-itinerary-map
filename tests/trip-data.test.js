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

    assert.ok(stepTitles.includes('Roosevelt Island via Tram'));
    assert.ok(stopNames.includes('Frank'));
  });
});

test('Sunday tentative split and open-ended dinner are retained', async () => {
  await withMockedFetch(async () => {
    const trip = await loadTripData();
    const sunday = getDayById(trip, 'sunday');
    assert.ok(sunday, 'Missing Sunday day');

    const tentativeTwoPm = sunday.items.filter((item) => item.start_time === '14:00');
    assert.equal(tentativeTwoPm.length, 2);
    assert.ok(tentativeTwoPm.every((item) => item.status === 'tentative'));

    const dinner = sunday.items.find((item) => item.title === 'Dinner after (tentative)');
    assert.ok(dinner, 'Missing tentative dinner item');
    assert.equal(dinner.end_time, null);

    const config = buildMapConfigFromDay(sunday, trip);
    const stepMeta = config.steps.map((step) => step.meta).join(' | ');
    assert.match(stepMeta, /Tentative/);
  });
});
