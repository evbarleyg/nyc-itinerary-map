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
    '71 pineapple st, brooklyn, ny 11201': [40.695694, -73.994334],
    '219 w 49th st, new york, ny 10019': [40.76047, -73.983921],
    'bryant park, new york, ny 10018': [40.753597, -73.983233],
    '11 south st, new york, ny 10004': [40.703245, -74.005938],
    vineapple: [40.695694, -73.994334],
    'new york comedy club - midtown': [40.739145, -73.983551],
    frank: [40.727595, -73.987719],
    'the river': [40.715962, -73.998309],
    'peking duck house': [40.714686, -73.998527],
    'fao schwarz': [40.75874, -73.978674],
    'aldo sohm wine bar': [40.761815, -73.981924],
    'roosevelt island tramway (manhattan tramway plaza)': [40.761558, -73.964783],
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
  };
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
      const stopId = `${stepId}-stop-${locationIndex + 1}`;
      const note =
        normalizeText(location.notes) ||
        item.notes ||
        (item.status === 'tentative' ? 'Tentative plan.' : 'Planned stop.');

      stops.push({
        id: stopId,
        name: location.name || stepTitle,
        time,
        address: resolveLocationAddress(location, safeDay),
        note,
        markerColor: color,
        fallback: getLocationFallback(location),
        stepIds: [stepId],
      });

      stopIds.push(stopId);
    });

    stepStops.push({
      stepId,
      stepTitle,
      stepType: item.type,
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

  const parkWaypoints = getParkWaypoints(safeDay.date, centralParkStepId);
  const zones = getZones(safeDay.date, stepByTitle);
  const googleMapsUrl = buildGoogleMapsUrl(stops);
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
    routes,
    zones,
  };
}
