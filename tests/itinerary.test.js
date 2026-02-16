import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FINAL_GOOGLE_MAPS_URL,
  FINALIZED_ITINERARY_PATCH,
  FINALIZED_STOP_ORDER,
  getGoogleMapsUrl,
} from '../src/itinerary.js';

const tripData = JSON.parse(fs.readFileSync(new URL('../public/nyc_trip_final.json', import.meta.url), 'utf8'));
const appHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('finalized stop order matches the expected sequence', () => {
  const stopIds = FINALIZED_ITINERARY_PATCH.stops.map((stop) => stop.id);
  assert.deepEqual(stopIds, FINALIZED_STOP_ORDER);
});

test('key time blocks are explicit and precise', () => {
  const timeByStep = new Map(FINALIZED_ITINERARY_PATCH.steps.map((step) => [step.id, step.time]));

  assert.equal(timeByStep.get('step1'), '09:30');
  assert.equal(timeByStep.get('step2'), '09:35-09:50 (15 min)');
  assert.equal(timeByStep.get('step3'), '10:00-11:00 (60 min)');
  assert.equal(timeByStep.get('step4'), '11:15-12:15 (60 min)');
  assert.equal(timeByStep.get('step5'), '12:30-13:45 (75 min)');
  assert.equal(timeByStep.get('step6'), '14:00');
  assert.equal(timeByStep.get('step7'), '15:30+');
  assert.equal(timeByStep.get('step8'), '17:00');
  assert.equal(timeByStep.get('step9'), '19:15-20:45');
  assert.equal(timeByStep.get('step10'), '21:00-22:25');
  assert.equal(timeByStep.get('step11'), '22:30-23:05');
});

test('google maps one-tap url is the finalized multi-stop URL', () => {
  assert.equal(getGoogleMapsUrl(FINALIZED_ITINERARY_PATCH), FINAL_GOOGLE_MAPS_URL);
  assert.match(FINAL_GOOGLE_MAPS_URL, /origin=Thompson\+Central\+Park\+New\+York/);
  assert.match(FINAL_GOOGLE_MAPS_URL, /destination=Thompson\+Central\+Park\+New\+York/);
  assert.match(FINAL_GOOGLE_MAPS_URL, /waypoints=Nordstrom/);
  assert.match(FINAL_GOOGLE_MAPS_URL, /The\+River/);
  assert.match(FINAL_GOOGLE_MAPS_URL, /Peking\+Duck\+House/);
});

test('friday includes Chinatown evening stops', () => {
  const friday = tripData.days.find((day) => day.date === '2026-02-13');
  assert.ok(friday, 'Missing Friday day');

  const titles = friday.items.map((item) => item.title);
  assert.ok(titles.includes('Drinks at The River'));
  assert.ok(titles.includes('Dinner at Peking Duck House'));
});

test('saturday includes Roosevelt Island actuals and Frank dinner', () => {
  const saturday = tripData.days.find((day) => day.date === '2026-02-14');
  assert.ok(saturday, 'Missing Saturday day');

  const titles = saturday.items.map((item) => item.title);
  assert.ok(titles.includes('Roosevelt Island via Tram'));
  assert.ok(titles.includes('Late dinner'));

  const frankItem = saturday.items.find((item) => item.title === 'Late dinner');
  const frankAddress = frankItem?.locations?.[0]?.address || '';
  assert.match(frankAddress, /88 2nd Ave, New York, NY 10003/);
});

test('sunday includes completed actuals sequence', () => {
  const sunday = tripData.days.find((day) => day.date === '2026-02-15');
  assert.ok(sunday, 'Missing Sunday day');

  assert.match(sunday.title, /Sunday actuals/i);
  const titles = sunday.items.map((item) => item.title);
  assert.ok(titles.includes('Subway: Thompson Central Park -> Vineapple'));
  assert.ok(titles.includes('Brunch at Vineapple'));
  assert.ok(titles.includes('Walk Brooklyn Heights Promenade to Brooklyn Bridge'));
  assert.ok(titles.includes('Walk across Brooklyn Bridge to Forgetmenot'));
  assert.ok(titles.includes('Lure Fishbar for oysters'));
  assert.ok(titles.includes('Joined the girls at Pastis'));
  assert.ok(titles.includes("Walked to Nathaniel + Lindsay's apartment"));
  assert.ok(titles.includes("Watch Summer House at Nathaniel + Lindsay's apartment"));
  assert.ok(titles.includes('Ubered back to hotel'));
  assert.ok(sunday.items.every((item) => item.status === 'completed'));
});

test('root page includes full-day path toggle control', () => {
  assert.match(appHtml, /id="show-full-day-toggle"/);
  assert.match(appHtml, /id="reset-view-mode-btn"/);
  assert.match(appHtml, /Show full day path/);
});
