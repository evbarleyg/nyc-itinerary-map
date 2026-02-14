import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINAL_GOOGLE_MAPS_URL,
  FINALIZED_ITINERARY_PATCH,
  FINALIZED_STOP_ORDER,
  getGoogleMapsUrl,
} from '../src/itinerary.js';

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
});

test('google maps one-tap url is the finalized multi-stop URL', () => {
  assert.equal(getGoogleMapsUrl(FINALIZED_ITINERARY_PATCH), FINAL_GOOGLE_MAPS_URL);
  assert.match(FINAL_GOOGLE_MAPS_URL, /origin=Thompson\+Central\+Park\+New\+York/);
  assert.match(FINAL_GOOGLE_MAPS_URL, /destination=Gansevoort\+St\+%26\+Washington\+St/);
  assert.match(FINAL_GOOGLE_MAPS_URL, /waypoints=Nordstrom/);
});
