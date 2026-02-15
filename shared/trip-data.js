const TRIP_DATA_FILE = 'nyc_trip_final.json';

const DATE_TO_DAY_ID = Object.freeze({
  '2026-02-13': 'friday',
  '2026-02-14': 'saturday',
  '2026-02-15': 'sunday',
});

const DAY_ID_TO_DATE = Object.freeze({
  friday: '2026-02-13',
  saturday: '2026-02-14',
  sunday: '2026-02-15',
});

const FIXED_DAY_TITLES = Object.freeze({
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
});

const TYPE_COLOR = Object.freeze({
  start: '#2f6c59',
  shopping: '#8d6f46',
  sightseeing: '#3b7a57',
  dining: '#9b643f',
  museum: '#4e6fae',
  walk: '#2b9aa0',
  drinks: '#86543a',
  rest: '#54758a',
  transit: '#2f5d8a',
  social: '#5e6f87',
  event: '#6d4d8f',
});

const FALLBACK_COLORS = Object.freeze([
  '#2f6c59',
  '#3b7a57',
  '#4e6fae',
  '#2f5d8a',
  '#2b9aa0',
  '#86543a',
  '#9b643f',
  '#5e6f87',
]);

const KNOWN_COORDS = new Map(
  Object.entries({
    '119 w 56th st, new york, ny 10019': [40.7643285, -73.978572],
    '225 w 57th st, new york, ny 10019': [40.7663896, -73.9809959],
    'central park south & 6th avenue, new york, ny 10019': [40.7660004, -73.976709],
    'e 79th st & 5th ave, new york, ny 10075': [40.776782, -73.9639664],
    '1271 3rd ave, new york, ny 10021': [40.7704584, -73.9597573],
    '1 e 70th st, new york, ny 10021': [40.7712536, -73.9670961],
    '440 w 33rd st, new york, ny 10001': [40.75331, -73.998415],
    'w 34th st & 10th ave, new york, ny 10199': [40.7542573, -73.9985956],
    'gansevoort st & washington st, new york, ny 10014': [40.7392395, -74.0081111],
    '102 bayard st, new york, ny 10013': [40.715962, -73.998309],
    '28 mott st, new york, ny 10013': [40.714686, -73.998527],
    'e 59th st & 2nd ave, new york, ny 10022': [40.761558, -73.964783],
    'roosevelt island, new york, ny 10044': [40.761596, -73.949723],
    '30 rockefeller plaza, new york, ny 10112': [40.75874, -73.978674],
    '151 w 51st st, new york, ny 10019': [40.761815, -73.981924],
    '241 e 24th st, new york, ny 10010': [40.739145, -73.983551],
    '88 2nd ave, new york, ny 10003': [40.727595, -73.987719],
    'brooklyn bridge pedestrian walkway entrance near city hall, new york, ny': [40.712628, -74.00528],
    'brooklyn bridge city hall station, new york, ny 10007': [40.713065, -74.004131],
    '334 furman st, brooklyn, ny 11201': [40.699216, -73.997027],
    '71 pineapple st, brooklyn, ny 11201': [40.695694, -73.994334],
    '515 w 23rd st, new york, ny 10011': [40.748063, -74.004774],
    '219 w 49th st, new york, ny 10019': [40.76047, -73.983921],
    'bryant park, new york, ny 10018': [40.753597, -73.983233],
    '52 gansevoort st, new york, ny 10014': [40.739908, -74.005786],
    'theater district, new york, ny 10036': [40.7594, -73.9851],
    '11 south st, new york, ny 10004': [40.703245, -74.005938],
    vineapple: [40.695694, -73.994334],
    'new york comedy club - midtown': [40.739145, -73.983551],
    frank: [40.727595, -73.987719],
    'the river': [40.715962, -73.998309],
    'peking duck house': [40.714686, -73.998527],
    'fao schwarz': [40.75874, -73.978674],
    'aldo sohm wine bar': [40.761815, -73.981924],
    'roosevelt island tramway (manhattan tramway plaza)': [40.761558, -73.964783],
    pastis: [40.739908, -74.005786],
  }),
);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function isIsoDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function copyCoord(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return null;
  const lat = Number(coord[0]);
  const lng = Number(coord[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return [lat, lng];
}

function getBaseUrl() {
  const base =
    typeof import.meta !== 'undefined' &&
    import.meta &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/';
  return base.endsWith('/') ? base : `${base}/`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeLocation(location) {
  if (!location || typeof location !== 'object') return null;
  const name = normalizeText(location.name);
  const address = normalizeText(location.address);
  const notes = normalizeText(location.notes);
  if (!name && !address) return null;
  return { ...location, name, address, notes };
}

function sanitizeItem(item) {
  if (!item || typeof item !== 'object') return null;

  const locations = asArray(item.locations).map((location) => sanitizeLocation(location)).filter(Boolean);
  return {
    ...item,
    title: normalizeText(item.title),
    type: normalizeText(item.type),
    start_time: normalizeText(item.start_time),
    end_time: item.end_time === null ? null : normalizeText(item.end_time),
    notes: normalizeText(item.notes),
    status: normalizeText(item.status),
    locations,
  };
}

function sanitizeDay(day) {
  if (!day || typeof day !== 'object') return null;
  const date = normalizeText(day.date);
  if (!isIsoDay(date)) return null;

  return {
    ...day,
    date,
    title: normalizeText(day.title),
    base_location: normalizeText(day.base_location),
    items: asArray(day.items).map((item) => sanitizeItem(item)).filter(Boolean),
  };
}

function sanitizeTrip(rawTrip) {
  const trip = rawTrip && typeof rawTrip === 'object' ? rawTrip : {};
  return {
    ...trip,
    trip_name: normalizeText(trip.trip_name),
    timezone: normalizeText(trip.timezone),
    last_updated: normalizeText(trip.last_updated),
    days: asArray(trip.days).map((day) => sanitizeDay(day)).filter(Boolean),
  };
}

function titleCase(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function shorten(value, maxChars = 96) {
  const text = normalizeText(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trim()}...`;
}

function formatStepTime(item) {
  const start = normalizeText(item.start_time);
  const end = item.end_time === null ? null : normalizeText(item.end_time);

  if (start && end && end !== start) return `${start}-${end}`;
  if (start && end === start) return start;
  if (start && end === null) return `${start}+`;
  if (start) return start;
  if (end) return `Until ${end}`;
  return 'Time TBD';
}

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'tentative') return 'Tentative';
  return '';
}

function buildStepMeta(item, locations) {
  const bits = [];
  const status = statusLabel(item.status);
  if (status) bits.push(status);
  const type = titleCase(item.type);
  if (type) bits.push(type);
  if (locations.length > 0) {
    const names = locations
      .map((location) => location.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(' -> ');
    if (names) bits.push(names);
  }
  if (item.notes) bits.push(shorten(item.notes));

  return bits.join(' - ');
}

function getColorForItem(item, index) {
  return TYPE_COLOR[item.type] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function getLocationFallback(location) {
  const byAddress = KNOWN_COORDS.get(normalizeKey(location.address));
  if (byAddress) return copyCoord(byAddress);
  const byName = KNOWN_COORDS.get(normalizeKey(location.name));
  if (byName) return copyCoord(byName);
  return null;
}

function resolveLocationAddress(location, day) {
  if (location.address) return location.address;
  if (day.base_location) return day.base_location;
  return 'New York, NY';
}

function ensureLocations(item, day) {
  const locations = asArray(item.locations).map((location) => sanitizeLocation(location)).filter(Boolean);
  if (locations.length > 0) return locations;

  return [
    {
      name: item.title || 'Stop',
      address: day.base_location || 'New York, NY',
      notes: '',
    },
  ];
}

function toMapsQuery(value) {
  return encodeURIComponent(normalizeText(value));
}

function buildGoogleMapsUrl(stops) {
  const points = stops
    .map((stop) => normalizeText(stop.address) || normalizeText(stop.name))
    .filter(Boolean);

  if (points.length < 2) {
    return 'https://www.google.com/maps';
  }

  const origin = toMapsQuery(points[0]);
  const destination = toMapsQuery(points[points.length - 1]);
  const waypoints = points.slice(1, -1).map((point) => toMapsQuery(point));
  const waypointQuery = waypoints.length ? `&waypoints=${waypoints.join('|')}` : '';

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointQuery}&travelmode=walking`;
}

function makeRoute({
  id,
  name,
  time,
  note,
  stepId,
  color,
  dashed,
  fromStopId,
  toStopId,
  viaStopIds = [],
  coords = [],
}) {
  return {
    id,
    name,
    time,
    note,
    stepIds: [stepId],
    color,
    dashed: Boolean(dashed),
    fromStopId,
    toStopId,
    viaStopIds,
    coords,
  };
}

function findStepByTitle(stepStops, pattern) {
  return stepStops.find((step) => pattern.test(normalizeText(step.stepTitle).toLowerCase())) || null;
}

function firstStopId(step) {
  return step?.stopIds?.[0] || '';
}

function lastStopId(step) {
  const stopIds = asArray(step?.stopIds);
  return stopIds[stopIds.length - 1] || '';
}

function buildSaturdayCuratedRoutes(stepStops) {
  const tramStep = findStepByTitle(stepStops, /roosevelt island via tram/);
  const faoStep = findStepByTitle(stepStops, /jellycat stop|fao schwarz/);
  const wineStep = findStepByTitle(stepStops, /aldo sohm|midtown wine bar/);
  const hotelStep = findStepByTitle(stepStops, /hotel reset/);
  const arriveStep = findStepByTitle(stepStops, /arrive for show/);
  const comedyStep = findStepByTitle(stepStops, /comedy show/);
  const dinnerStep = findStepByTitle(stepStops, /late dinner|frank/);

  const routes = [];

  if (tramStep && firstStopId(tramStep) && lastStopId(tramStep)) {
    routes.push(
      makeRoute({
        id: 'saturday-curated-tram',
        name: 'Roosevelt Island Tram',
        time: tramStep.time,
        note: 'Tram ride and Roosevelt Island promenade segment.',
        stepId: tramStep.stepId,
        color: tramStep.color,
        dashed: false,
        fromStopId: firstStopId(tramStep),
        toStopId: lastStopId(tramStep),
        coords: [
          [40.761558, -73.964783],
          [40.7609, -73.9587],
          [40.761596, -73.949723],
        ],
      }),
    );
  }

  if (tramStep && faoStep && lastStopId(tramStep) && firstStopId(faoStep)) {
    routes.push(
      makeRoute({
        id: 'saturday-curated-tram-to-fao',
        name: 'Transfer: Roosevelt Island -> FAO Schwarz',
        time: `${tramStep.time} -> ${faoStep.time}`,
        note: 'Return by tram then Midtown transfer.',
        stepId: faoStep.stepId,
        color: faoStep.color,
        dashed: true,
        fromStopId: lastStopId(tramStep),
        toStopId: firstStopId(faoStep),
        coords: [
          [40.761596, -73.949723],
          [40.761558, -73.964783],
          [40.75874, -73.978674],
        ],
      }),
    );
  }

  if (faoStep && wineStep && firstStopId(faoStep) && firstStopId(wineStep)) {
    routes.push(
      makeRoute({
        id: 'saturday-curated-fao-to-wine',
        name: 'Transfer: FAO Schwarz -> Aldo Sohm Wine Bar',
        time: `${faoStep.time} -> ${wineStep.time}`,
        note: 'Short Midtown walk.',
        stepId: wineStep.stepId,
        color: wineStep.color,
        dashed: false,
        fromStopId: firstStopId(faoStep),
        toStopId: firstStopId(wineStep),
        coords: [
          [40.75874, -73.978674],
          [40.76045, -73.98035],
          [40.761815, -73.981924],
        ],
      }),
    );
  }

  if (wineStep && hotelStep && firstStopId(wineStep) && firstStopId(hotelStep)) {
    routes.push(
      makeRoute({
        id: 'saturday-curated-wine-to-hotel',
        name: 'Transfer: Aldo Sohm Wine Bar -> Hotel reset',
        time: `${wineStep.time} -> ${hotelStep.time}`,
        note: 'Return to hotel to reset.',
        stepId: hotelStep.stepId,
        color: hotelStep.color,
        dashed: false,
        fromStopId: firstStopId(wineStep),
        toStopId: firstStopId(hotelStep),
        coords: [
          [40.761815, -73.981924],
          [40.76315, -73.98015],
          [40.7643285, -73.978572],
        ],
      }),
    );
  }

  if (hotelStep && arriveStep && firstStopId(hotelStep) && firstStopId(arriveStep)) {
    routes.push(
      makeRoute({
        id: 'saturday-curated-hotel-to-nycc',
        name: 'Transfer: Hotel -> Comedy Club arrival',
        time: `${hotelStep.time} -> ${arriveStep.time}`,
        note: 'Evening transfer to NYCC Midtown.',
        stepId: arriveStep.stepId,
        color: arriveStep.color,
        dashed: true,
        fromStopId: firstStopId(hotelStep),
        toStopId: firstStopId(arriveStep),
        coords: [
          [40.7643285, -73.978572],
          [40.7558, -73.986],
          [40.739145, -73.983551],
        ],
      }),
    );
  }

  if (comedyStep && dinnerStep && firstStopId(comedyStep) && firstStopId(dinnerStep)) {
    routes.push(
      makeRoute({
        id: 'saturday-curated-comedy-to-dinner',
        name: 'Transfer: Comedy -> Frank',
        time: `${comedyStep.time} -> ${dinnerStep.time}`,
        note: 'Post-show walk to dinner.',
        stepId: dinnerStep.stepId,
        color: dinnerStep.color,
        dashed: false,
        fromStopId: firstStopId(comedyStep),
        toStopId: firstStopId(dinnerStep),
        coords: [
          [40.739145, -73.983551],
          [40.7348, -73.9857],
          [40.727595, -73.987719],
        ],
      }),
    );
  }

  return routes;
}

function buildSundayCuratedRoutes(stepStops) {
  const subwayStep = findStepByTitle(stepStops, /subway to brooklyn bridge/);
  const bridgeOutStep = findStepByTitle(stepStops, /walk brooklyn bridge.*manhattan.*brooklyn/);
  const brunchStep = findStepByTitle(stepStops, /brunch/);
  const bridgeBackStep = findStepByTitle(stepStops, /walk brooklyn bridge.*brooklyn.*manhattan/);
  const chelseaStep = findStepByTitle(stepStops, /transit to chelsea/);
  const nathanielStep = findStepByTitle(stepStops, /nathaniel/);
  const dinnerStep = findStepByTitle(stepStops, /pastis|meet lindsay and maci|dinner/);

  const routes = [];

  if (subwayStep && bridgeOutStep && firstStopId(subwayStep) && firstStopId(bridgeOutStep)) {
    routes.push(
      makeRoute({
        id: 'sunday-curated-subway-to-bridge',
        name: 'Transfer: Subway -> Brooklyn Bridge entrance',
        time: `${subwayStep.time} -> ${bridgeOutStep.time}`,
        note: 'Short handoff from station to bridge walkway.',
        stepId: bridgeOutStep.stepId,
        color: bridgeOutStep.color,
        dashed: true,
        fromStopId: firstStopId(subwayStep),
        toStopId: firstStopId(bridgeOutStep),
        coords: [
          [40.713065, -74.004131],
          [40.712628, -74.00528],
        ],
      }),
    );
  }

  if (bridgeOutStep && firstStopId(bridgeOutStep) && lastStopId(bridgeOutStep)) {
    routes.push(
      makeRoute({
        id: 'sunday-curated-bridge-to-brooklyn',
        name: 'Walk: Brooklyn Bridge (to Brooklyn)',
        time: bridgeOutStep.time,
        note: 'Curated Manhattan-to-Brooklyn bridge walking line.',
        stepId: bridgeOutStep.stepId,
        color: bridgeOutStep.color,
        dashed: false,
        fromStopId: firstStopId(bridgeOutStep),
        toStopId: lastStopId(bridgeOutStep),
        coords: [
          [40.712628, -74.00528],
          [40.70675, -74.00371],
          [40.70402, -73.99943],
          [40.699216, -73.997027],
        ],
      }),
    );
  }

  if (bridgeOutStep && brunchStep && lastStopId(bridgeOutStep) && firstStopId(brunchStep)) {
    routes.push(
      makeRoute({
        id: 'sunday-curated-bridge-to-brunch',
        name: 'Transfer: Bridge -> Vineapple',
        time: `${bridgeOutStep.time} -> ${brunchStep.time}`,
        note: 'Short DUMBO to brunch transfer.',
        stepId: brunchStep.stepId,
        color: brunchStep.color,
        dashed: false,
        fromStopId: lastStopId(bridgeOutStep),
        toStopId: firstStopId(brunchStep),
        coords: [
          [40.699216, -73.997027],
          [40.69785, -73.9958],
          [40.695694, -73.994334],
        ],
      }),
    );
  }

  if (brunchStep && bridgeBackStep && firstStopId(brunchStep) && firstStopId(bridgeBackStep)) {
    routes.push(
      makeRoute({
        id: 'sunday-curated-brunch-to-bridge-return',
        name: 'Transfer: Vineapple -> Brooklyn Bridge return',
        time: `${brunchStep.time} -> ${bridgeBackStep.time}`,
        note: 'Head back to the bridge from brunch.',
        stepId: bridgeBackStep.stepId,
        color: bridgeBackStep.color,
        dashed: false,
        fromStopId: firstStopId(brunchStep),
        toStopId: firstStopId(bridgeBackStep),
        coords: [
          [40.695694, -73.994334],
          [40.69785, -73.9958],
          [40.699216, -73.997027],
        ],
      }),
    );
  }

  if (bridgeBackStep && firstStopId(bridgeBackStep) && lastStopId(bridgeBackStep)) {
    routes.push(
      makeRoute({
        id: 'sunday-curated-bridge-to-manhattan',
        name: 'Walk: Brooklyn Bridge (back to Manhattan)',
        time: bridgeBackStep.time,
        note: 'Curated Brooklyn-to-Manhattan bridge walking line.',
        stepId: bridgeBackStep.stepId,
        color: bridgeBackStep.color,
        dashed: false,
        fromStopId: firstStopId(bridgeBackStep),
        toStopId: lastStopId(bridgeBackStep),
        coords: [
          [40.699216, -73.997027],
          [40.70402, -73.99943],
          [40.70675, -74.00371],
          [40.712628, -74.00528],
        ],
      }),
    );
  }

  if (bridgeBackStep && chelseaStep && lastStopId(bridgeBackStep) && firstStopId(chelseaStep)) {
    routes.push(
      makeRoute({
        id: 'sunday-curated-bridge-to-chelsea',
        name: 'Transfer: Brooklyn Bridge -> Chelsea',
        time: `${bridgeBackStep.time} -> ${chelseaStep.time}`,
        note: 'Subway/ride transfer to West Chelsea.',
        stepId: chelseaStep.stepId,
        color: chelseaStep.color,
        dashed: true,
        fromStopId: lastStopId(bridgeBackStep),
        toStopId: firstStopId(chelseaStep),
        coords: [
          [40.712628, -74.00528],
          [40.7192, -74.0026],
          [40.7324, -74.0037],
          [40.7413, -74.0043],
          [40.748063, -74.004774],
        ],
      }),
    );
  }

  if (nathanielStep && dinnerStep && firstStopId(nathanielStep) && firstStopId(dinnerStep)) {
    routes.push(
      makeRoute({
        id: 'sunday-curated-chelsea-to-pastis',
        name: 'Transfer: Chelsea -> Pastis dinner',
        time: `${nathanielStep.time} -> ${dinnerStep.time}`,
        note: 'Meet back up for dinner.',
        stepId: dinnerStep.stepId,
        color: dinnerStep.color,
        dashed: false,
        fromStopId: firstStopId(nathanielStep),
        toStopId: firstStopId(dinnerStep),
        coords: [
          [40.748063, -74.004774],
          [40.7448, -74.0049],
          [40.7443, -74.0016],
          [40.739908, -74.005786],
        ],
      }),
    );
  }

  return routes;
}

function getCuratedRoutes(dayDate, stepStops) {
  if (dayDate === '2026-02-14') return buildSaturdayCuratedRoutes(stepStops);
  if (dayDate === '2026-02-15') return buildSundayCuratedRoutes(stepStops);
  return [];
}

function getParkWaypoints(dayDate, centralParkStepId) {
  if (dayDate !== '2026-02-13' || !centralParkStepId) return [];
  return [
    {
      id: 'cp-entrance',
      label: 'Park Entrance (59th & 6th)',
      note: 'Enter Central Park near 59th Street & 6th Avenue.',
      coord: [40.7660004, -73.976709],
      stepIds: [centralParkStepId],
    },
    {
      id: 'cp-pond',
      label: 'The Pond',
      note: 'Scenic first segment.',
      coord: [40.76681, -73.97332],
      stepIds: [centralParkStepId],
    },
    {
      id: 'cp-mall',
      label: 'The Mall',
      note: 'Tree-lined interior promenade.',
      coord: [40.7714, -73.97383],
      stepIds: [centralParkStepId],
    },
    {
      id: 'cp-bethesda',
      label: 'Bethesda Terrace',
      note: 'Iconic Central Park midpoint.',
      coord: [40.77404, -73.97012],
      stepIds: [centralParkStepId],
    },
    {
      id: 'cp-exit',
      label: 'Park Exit (79th & 5th)',
      note: 'Exit toward the Upper East Side.',
      coord: [40.776782, -73.9639664],
      stepIds: [centralParkStepId],
    },
  ];
}

function getZones(dayDate, stepByTitle) {
  if (dayDate !== '2026-02-13') return [];
  const highLineStepId = stepByTitle.get('high line walk southbound');
  const drinksStepId = stepByTitle.get('drinks anchor (chelsea/meatpacking)');
  const zones = [];

  if (highLineStepId) {
    zones.push({
      id: 'high-line-zone',
      name: 'High Line corridor',
      time: '15:30-17:00',
      note: 'Hudson Yards to Meatpacking focus zone.',
      stepIds: [highLineStepId],
      color: '#2b9aa0',
      coords: [
        [40.7549, -73.9993],
        [40.7549, -74.0079],
        [40.7391, -74.0094],
        [40.7391, -74.0075],
        [40.7484, -74.0048],
        [40.7537, -74.0029],
      ],
    });
  }

  if (drinksStepId) {
    zones.push({
      id: 'drinks-zone',
      name: 'Drinks anchor area',
      time: '17:00',
      note: 'Chelsea/Meatpacking anchor area.',
      stepIds: [drinksStepId],
      color: '#b95f3c',
      coords: [
        [40.7402, -74.00865],
        [40.7402, -74.00745],
        [40.7387, -74.00745],
        [40.7387, -74.00865],
      ],
    });
  }

  return zones;
}

function toDayId(dayDate) {
  return DATE_TO_DAY_ID[dayDate] || '';
}

function getDayTitle(dayId, day) {
  return FIXED_DAY_TITLES[dayId] || normalizeText(day?.title) || 'Day';
}

export async function loadTripData() {
  const tripUrl = `${getBaseUrl()}${TRIP_DATA_FILE}`;
  const response = await fetch(tripUrl, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Trip data request failed (${response.status}).`);
  }

  return sanitizeTrip(await response.json());
}

export function getFixedDaysFromTrip(trip) {
  const safeTrip = sanitizeTrip(trip);
  const dayByDate = new Map(safeTrip.days.map((day) => [day.date, day]));

  return ['friday', 'saturday', 'sunday'].map((dayId) => {
    const date = DAY_ID_TO_DATE[dayId];
    const day = dayByDate.get(date);
    return {
      id: dayId,
      title: getDayTitle(dayId, day),
      date,
      kind: 'fixed',
      href: `/?day=${encodeURIComponent(dayId)}`,
      hasPath: false,
    };
  });
}

export function getDayById(trip, dayId) {
  const safeTrip = sanitizeTrip(trip);
  const id = normalizeText(dayId).toLowerCase();
  const targetDate = DAY_ID_TO_DATE[id] || (isIsoDay(id) ? id : '');
  if (!targetDate) return null;
  return safeTrip.days.find((day) => day.date === targetDate) || null;
}

export function buildMapConfigFromDay(day, trip) {
  const safeTrip = sanitizeTrip(trip);
  const safeDay = sanitizeDay(day);
  if (!safeDay) return null;

  const dayId = toDayId(safeDay.date);
  const steps = [];
  const stops = [];
  const routes = [];
  const stepStops = [];
  const stepByTitle = new Map();
  const stopByLocationKey = new Map();
  const stopRecordById = new Map();
  const orderedMapStops = [];
  let centralParkStepId = '';

  safeDay.items.forEach((item, index) => {
    const stepId = `${dayId || 'day'}-step-${index + 1}`;
    const color = getColorForItem(item, index);
    const locations = ensureLocations(item, safeDay);
    const time = formatStepTime(item);
    const stepTitle = item.title || `Stop ${index + 1}`;
    const meta = buildStepMeta(item, locations);

    steps.push({
      id: stepId,
      time,
      title: stepTitle,
      meta,
      color,
    });

    stepByTitle.set(stepTitle.toLowerCase(), stepId);
    if (/central park walk/i.test(stepTitle)) {
      centralParkStepId = stepId;
    }

    const stopIds = [];
    locations.forEach((location, locationIndex) => {
      const address = resolveLocationAddress(location, safeDay);
      const locationName = location.name || stepTitle;
      const locationKey = `${normalizeKey(locationName)}|${normalizeKey(address)}`;
      const note =
        normalizeText(location.notes) ||
        item.notes ||
        (item.status === 'tentative' ? 'Tentative plan.' : 'Planned stop.');

      orderedMapStops.push({
        name: locationName,
        address,
      });

      const existingStopId = stopByLocationKey.get(locationKey);
      if (existingStopId) {
        const existing = stopRecordById.get(existingStopId);
        if (existing && !existing.stepIds.includes(stepId)) {
          existing.stepIds.push(stepId);
        }
        stopIds.push(existingStopId);
        return;
      }

      const stopId = `${stepId}-stop-${locationIndex + 1}`;
      const stopRecord = {
        id: stopId,
        name: locationName,
        time,
        address,
        note,
        markerColor: color,
        fallback: getLocationFallback(location),
        stepIds: [stepId],
      };

      stops.push(stopRecord);
      stopRecordById.set(stopId, stopRecord);
      stopByLocationKey.set(locationKey, stopId);

      stopIds.push(stopId);
    });

    stepStops.push({
      stepId,
      stepTitle,
      stepType: item.type,
      startTime: item.start_time,
      endTime: item.end_time,
      time,
      color,
      stopIds,
      status: item.status,
    });

    if (stopIds.length > 1) {
      routes.push(
        makeRoute({
          id: `${stepId}-route`,
          name: stepTitle,
          time,
          note: item.notes || 'In-step movement.',
          stepId,
          color,
          dashed: item.type === 'transit',
          fromStopId: stopIds[0],
          toStopId: stopIds[stopIds.length - 1],
          viaStopIds: stopIds.slice(1, -1),
        }),
      );
    }
  });

  for (let i = 0; i < stepStops.length - 1; i += 1) {
    const current = stepStops[i];
    const next = stepStops[i + 1];
    const fromStopId = current.stopIds[current.stopIds.length - 1];
    const toStopId = next.stopIds[0];
    if (!fromStopId || !toStopId) continue;
    if (fromStopId === toStopId) continue;
    if (
      normalizeText(current.startTime) &&
      normalizeText(next.startTime) &&
      normalizeText(current.startTime) === normalizeText(next.startTime)
    ) {
      continue;
    }

    const transferName = `Transfer: ${current.stepTitle} -> ${next.stepTitle}`;
    const isTransitLike = ['transit', 'rest', 'event'].includes(next.stepType);
    routes.push(
      makeRoute({
        id: `${current.stepId}-to-${next.stepId}`,
        name: transferName,
        time: `${current.time} -> ${next.time}`,
        note: isTransitLike ? 'Transit/ride segment.' : 'Walking segment.',
        stepId: next.stepId,
        color: next.color,
        dashed: isTransitLike,
        fromStopId,
        toStopId,
      }),
    );
  }

  const curatedRoutes = getCuratedRoutes(safeDay.date, stepStops);
  const effectiveRoutes = curatedRoutes.length > 0 ? curatedRoutes : routes;

  const parkWaypoints = getParkWaypoints(safeDay.date, centralParkStepId);
  const zones = getZones(safeDay.date, stepByTitle);
  const googleMapsUrl = buildGoogleMapsUrl(orderedMapStops.length > 0 ? orderedMapStops : stops);
  const dayTitle = getDayTitle(dayId, safeDay);
  const tentativeCount = safeDay.items.filter((item) => item.status === 'tentative').length;
  const weatherNote =
    tentativeCount > 0
      ? `${dayTitle} plan loaded from trip JSON. ${tentativeCount} tentative block(s) are marked in the timeline.`
      : `${dayTitle} timeline loaded from trip JSON.`;

  return {
    weatherNote,
    googleMapsUrl,
    steps,
    stops,
    staticPoints: [],
    parkWaypoints,
    routes: effectiveRoutes,
    zones,
  };
}
