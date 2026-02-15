const META_STORAGE_KEY = 'nyc_day_history_meta_v1';
const PATH_DB_NAME = 'nyc_day_history_paths_v1';
const PATH_STORE_NAME = 'paths';
const META_VERSION = 1;

const DEFAULT_ACTIVE_DAY = 'friday';
const DEFAULT_FIXED_DAYS = Object.freeze([
  {
    id: 'friday',
    title: 'Friday',
    date: '2026-02-13',
    kind: 'fixed',
    href: '/',
    hasPath: false,
  },
  {
    id: 'saturday',
    title: 'Saturday',
    date: '2026-02-14',
    kind: 'fixed',
    href: '/?day=saturday',
    hasPath: false,
  },
  {
    id: 'sunday',
    title: 'Sunday',
    date: '2026-02-15',
    kind: 'fixed',
    href: '/?day=sunday',
    hasPath: false,
  },
]);

let fixedDays = DEFAULT_FIXED_DAYS.map((day) => ({ ...day }));
let memoryMeta = null;
let memoryPathStore = new Map();

function getStorage() {
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      return globalThis.localStorage;
    }
  } catch {
    // Ignore when browser storage is restricted.
  }
  return null;
}

function isIsoDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function slugify(value) {
  const slug = normalizeText(value)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
  return slug || 'day';
}

function sortUploadedDays(days) {
  return [...days].sort((a, b) => {
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
  });
}

function normalizeUploadedDay(day) {
  if (!day || typeof day !== 'object') return null;

  const id = normalizeText(day.id);
  if (!id || getFixedDayIds().has(id)) return null;

  const date = isIsoDay(day.date) ? day.date : '';
  const title = normalizeText(day.title) || (date ? `Day ${date}` : 'Uploaded Day');

  return {
    id,
    title,
    date,
    kind: 'uploaded',
    sourceFile: normalizeText(day.sourceFile),
    hasPath: Boolean(day.hasPath),
    createdAt: normalizeText(day.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(day.updatedAt) || new Date().toISOString(),
  };
}

function createDefaultMeta() {
  return {
    version: META_VERSION,
    activeDayId: DEFAULT_ACTIVE_DAY,
    uploadedDays: [],
  };
}

function normalizeFixedDay(day) {
  if (!day || typeof day !== 'object') return null;

  const id = normalizeText(day.id);
  if (!id) return null;

  const title = normalizeText(day.title) || id;
  const date = isIsoDay(day.date) ? day.date : '';
  const href = normalizeText(day.href) || `/?day=${encodeURIComponent(id)}`;

  return {
    id,
    title,
    date,
    kind: 'fixed',
    href,
    hasPath: false,
  };
}

function cloneFixedDays(days) {
  const source = Array.isArray(days) ? days : DEFAULT_FIXED_DAYS;
  const normalized = [];
  const seen = new Set();

  for (const day of source) {
    const fixed = normalizeFixedDay(day);
    if (!fixed || seen.has(fixed.id)) continue;
    seen.add(fixed.id);
    normalized.push(fixed);
  }

  if (normalized.length === 0) {
    return DEFAULT_FIXED_DAYS.map((day) => ({ ...day }));
  }

  return normalized;
}

function getFixedDayIds() {
  return new Set(fixedDays.map((day) => day.id));
}

function sanitizeMeta(meta) {
  const base = createDefaultMeta();
  const safe = meta && typeof meta === 'object' ? meta : {};
  const uploadedRaw = Array.isArray(safe.uploadedDays) ? safe.uploadedDays : [];
  const uploadedDays = sortUploadedDays(uploadedRaw.map((item) => normalizeUploadedDay(item)).filter(Boolean));

  const availableIds = new Set([...fixedDays.map((day) => day.id), ...uploadedDays.map((day) => day.id)]);
  const requestedActive = normalizeText(safe.activeDayId);
  const fallbackActiveId =
    availableIds.has(DEFAULT_ACTIVE_DAY) ? DEFAULT_ACTIVE_DAY : (fixedDays[0]?.id || DEFAULT_ACTIVE_DAY);
  const activeDayId = availableIds.has(requestedActive) ? requestedActive : fallbackActiveId;

  return {
    version: META_VERSION,
    ...base,
    activeDayId,
    uploadedDays,
  };
}

function readMeta() {
  const storage = getStorage();
  if (!storage) {
    if (!memoryMeta) memoryMeta = createDefaultMeta();
    return sanitizeMeta(memoryMeta);
  }

  try {
    const raw = storage.getItem(META_STORAGE_KEY);
    if (!raw) {
      const fallback = createDefaultMeta();
      storage.setItem(META_STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }

    return sanitizeMeta(JSON.parse(raw));
  } catch {
    const fallback = createDefaultMeta();
    try {
      storage.setItem(META_STORAGE_KEY, JSON.stringify(fallback));
    } catch {
      // Ignore storage failures.
    }
    return fallback;
  }
}

function writeMeta(meta) {
  const next = sanitizeMeta(meta);
  const storage = getStorage();
  if (!storage) {
    memoryMeta = next;
    return next;
  }

  try {
    storage.setItem(META_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
  return next;
}

function getAllDayIds(meta = readMeta()) {
  const ids = new Set(fixedDays.map((item) => item.id));
  for (const day of meta.uploadedDays) ids.add(day.id);
  return ids;
}

function getUploadedDays(meta = readMeta()) {
  return sortUploadedDays(meta.uploadedDays).map((day) => ({
    ...day,
    kind: 'uploaded',
    href: `/?day=${encodeURIComponent(day.id)}`,
  }));
}

function getTabs(meta = readMeta()) {
  const fixed = fixedDays.map((day) => ({ ...day }));
  return [...fixed, ...getUploadedDays(meta)];
}

function hasIndexedDb() {
  return typeof globalThis.indexedDB !== 'undefined';
}

function openPathDb() {
  if (!hasIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(PATH_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PATH_STORE_NAME)) {
        db.createObjectStore(PATH_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

async function readPath(dayId) {
  if (!dayId) return null;

  if (!hasIndexedDb()) {
    return memoryPathStore.get(dayId) || null;
  }

  try {
    const db = await openPathDb();
    if (!db) return memoryPathStore.get(dayId) || null;

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PATH_STORE_NAME, 'readonly');
      const store = tx.objectStore(PATH_STORE_NAME);
      const request = store.get(dayId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('IndexedDB read failed.'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    return memoryPathStore.get(dayId) || null;
  }
}

async function writePath(dayId, featureCollection) {
  if (!dayId) return;
  memoryPathStore.set(dayId, featureCollection);

  if (!hasIndexedDb()) return;

  try {
    const db = await openPathDb();
    if (!db) return;

    await new Promise((resolve, reject) => {
      const tx = db.transaction(PATH_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PATH_STORE_NAME);
      const request = store.put(featureCollection, dayId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('IndexedDB write failed.'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    // In-memory fallback already captured.
  }
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeLngLat(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return null;

  const lng = toNumber(coord[0]);
  const lat = toNumber(coord[1]);
  if (lng === null || lat === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return [lng, lat];
}

function normalizeLine(coords) {
  if (!Array.isArray(coords)) return [];

  const normalized = coords
    .map((coord) => normalizeLngLat(coord))
    .filter((coord) => Boolean(coord));

  if (normalized.length < 2) return [];

  const deduped = [normalized[0]];
  for (let i = 1; i < normalized.length; i += 1) {
    const prev = deduped[deduped.length - 1];
    const current = normalized[i];
    if (prev[0] !== current[0] || prev[1] !== current[1]) {
      deduped.push(current);
    }
  }

  return deduped.length >= 2 ? deduped : [];
}

function lineToFeature(line, source) {
  return {
    type: 'Feature',
    properties: { source },
    geometry: {
      type: 'LineString',
      coordinates: line,
    },
  };
}

function parseGpxTrackPoints(block) {
  const points = [];
  const pointRegex = /<trkpt\b([^>]*)>/gi;
  let match = pointRegex.exec(block);

  while (match) {
    const attrs = match[1] || '';
    const latMatch = attrs.match(/\blat\s*=\s*["']([^"']+)["']/i);
    const lonMatch = attrs.match(/\blon\s*=\s*["']([^"']+)["']/i);

    const lat = toNumber(latMatch?.[1]);
    const lon = toNumber(lonMatch?.[1]);
    if (lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      points.push([lon, lat]);
    }

    match = pointRegex.exec(block);
  }

  return normalizeLine(points);
}

function parseGpx(text) {
  const lines = [];
  const segRegex = /<trkseg\b[\s\S]*?<\/trkseg>/gi;
  let segMatch = segRegex.exec(text);

  while (segMatch) {
    const line = parseGpxTrackPoints(segMatch[0]);
    if (line.length >= 2) lines.push(line);
    segMatch = segRegex.exec(text);
  }

  if (lines.length === 0) {
    const fallback = parseGpxTrackPoints(text);
    if (fallback.length >= 2) lines.push(fallback);
  }

  return lines.map((line) => lineToFeature(line, 'gpx'));
}

function parseKmlCoordinates(rawCoordinates) {
  const entries = rawCoordinates.trim().split(/\s+/);
  const coords = [];

  for (const entry of entries) {
    const [lngRaw, latRaw] = entry.split(',');
    const lng = toNumber(lngRaw);
    const lat = toNumber(latRaw);
    if (lng === null || lat === null) continue;
    coords.push([lng, lat]);
  }

  return normalizeLine(coords);
}

function parseKml(text) {
  const lines = [];
  const lineRegex = /<LineString\b[\s\S]*?<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/gi;
  let lineMatch = lineRegex.exec(text);

  while (lineMatch) {
    const line = parseKmlCoordinates(lineMatch[1] || '');
    if (line.length >= 2) lines.push(line);
    lineMatch = lineRegex.exec(text);
  }

  return lines.map((line) => lineToFeature(line, 'kml'));
}

function extractGeoJsonLines(geometry) {
  if (!geometry || typeof geometry !== 'object') return [];

  if (geometry.type === 'LineString') {
    const line = normalizeLine(geometry.coordinates);
    return line.length >= 2 ? [line] : [];
  }

  if (geometry.type === 'MultiLineString') {
    return (Array.isArray(geometry.coordinates) ? geometry.coordinates : [])
      .map((line) => normalizeLine(line))
      .filter((line) => line.length >= 2);
  }

  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.flatMap((item) => extractGeoJsonLines(item));
  }

  return [];
}

function parseGeoJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid GeoJSON: unable to parse JSON.');
  }

  const lines = [];

  if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    for (const feature of parsed.features) {
      lines.push(...extractGeoJsonLines(feature?.geometry));
    }
  } else if (parsed?.type === 'Feature') {
    lines.push(...extractGeoJsonLines(parsed.geometry));
  } else {
    lines.push(...extractGeoJsonLines(parsed));
  }

  return lines.map((line) => lineToFeature(line, 'geojson'));
}

function detectFormat(fileText, fileNameOrMime) {
  const hint = normalizeText(fileNameOrMime).toLowerCase();
  const trimmed = fileText.trim();
  const lowered = trimmed.slice(0, 240).toLowerCase();

  if (
    hint.endsWith('.geojson') ||
    hint.endsWith('.json') ||
    hint.includes('geo+json') ||
    hint.includes('application/json') ||
    trimmed.startsWith('{')
  ) {
    return 'geojson';
  }

  if (hint.endsWith('.gpx') || hint.includes('gpx') || lowered.includes('<gpx')) {
    return 'gpx';
  }

  if (hint.endsWith('.kml') || hint.includes('kml') || lowered.includes('<kml') || lowered.includes('<linestring')) {
    return 'kml';
  }

  return '';
}

function featureCollectionFrom(features) {
  return {
    type: 'FeatureCollection',
    features,
  };
}

export function parsePathFile(fileText, fileNameOrMime = '') {
  const text = typeof fileText === 'string' ? fileText.trim() : '';
  if (!text) {
    throw new Error('Path file is empty.');
  }

  const format = detectFormat(text, fileNameOrMime);
  let features = [];

  if (format === 'geojson') {
    features = parseGeoJson(text);
  } else if (format === 'gpx') {
    features = parseGpx(text);
  } else if (format === 'kml') {
    features = parseKml(text);
  } else {
    throw new Error('Unsupported path file format. Use GPX, KML, or GeoJSON.');
  }

  if (!features.length) {
    throw new Error('No valid path coordinates found in file.');
  }

  return featureCollectionFrom(features);
}

function readFileText(file) {
  if (typeof file === 'string') {
    return Promise.resolve(file);
  }

  if (!file || typeof file !== 'object') {
    return Promise.reject(new Error('No file provided.'));
  }

  if (typeof file.text === 'function') {
    return file.text();
  }

  return Promise.reject(new Error('File reader not supported.'));
}

function buildUploadedDayId(meta, requestedId, date, title) {
  const existingIds = getAllDayIds(meta);

  if (normalizeText(requestedId) && !existingIds.has(requestedId)) {
    return requestedId;
  }

  const dateSlug = isIsoDay(date) ? `day-${date}` : '';
  if (dateSlug && !existingIds.has(dateSlug)) return dateSlug;

  let idx = 1;
  const base = `${dateSlug || 'day'}-${slugify(title || 'uploaded')}`;
  let candidate = base;
  while (existingIds.has(candidate)) {
    idx += 1;
    candidate = `${base}-${idx}`;
  }
  return candidate;
}

function normalizeSaveOptions(options) {
  const safe = options && typeof options === 'object' ? options : {};
  const title = normalizeText(safe.title);
  const date = normalizeText(safe.date);
  return {
    title,
    date: isIsoDay(date) ? date : '',
    dayId: normalizeText(safe.dayId),
    sourceFile: normalizeText(safe.sourceFile),
  };
}

export async function saveUploadedPath(file, options = {}) {
  const fileText = await readFileText(file);
  const formatHint = typeof file === 'object' ? `${file.name || ''} ${file.type || ''}` : '';
  const featureCollection = parsePathFile(fileText, formatHint);

  const meta = readMeta();
  const opts = normalizeSaveOptions(options);
  const sourceFile = opts.sourceFile || (typeof file === 'object' ? normalizeText(file.name) : '');

  const existingByDate =
    opts.date && meta.uploadedDays.find((day) => day.date === opts.date);
  const existingById =
    opts.dayId && meta.uploadedDays.find((day) => day.id === opts.dayId);
  const existing = existingById || existingByDate || null;

  const now = new Date().toISOString();
  const dayId = existing?.id || buildUploadedDayId(meta, opts.dayId, opts.date, opts.title);
  const title = opts.title || existing?.title || (opts.date ? `Day ${opts.date}` : 'Uploaded Day');
  const date = opts.date || existing?.date || '';

  const dayRecord = {
    id: dayId,
    title,
    date,
    kind: 'uploaded',
    sourceFile,
    hasPath: true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const nextUploaded = meta.uploadedDays
    .filter((day) => day.id !== dayId)
    .filter((day) => !(existingByDate && day.id === existingByDate.id))
    .concat(dayRecord);

  const nextMeta = writeMeta({
    ...meta,
    activeDayId: dayId,
    uploadedDays: nextUploaded,
  });

  await writePath(dayId, featureCollection);

  const savedDay = getTabs(nextMeta).find((day) => day.id === dayId);
  return {
    day: savedDay,
    featureCollection,
  };
}

export function loadDayHistory() {
  const meta = writeMeta(readMeta());
  return {
    activeDayId: meta.activeDayId,
    days: getTabs(meta),
  };
}

export function setActiveDay(dayId) {
  const meta = readMeta();
  const available = getAllDayIds(meta);
  const requestedId = normalizeText(dayId);
  if (!available.has(requestedId)) {
    return meta.activeDayId;
  }

  const next = writeMeta({
    ...meta,
    activeDayId: requestedId,
  });
  return next.activeDayId;
}

export function getActiveDay() {
  return readMeta().activeDayId;
}

export function listDays() {
  return getTabs(readMeta());
}

export async function getDayPathGeoJSON(dayId) {
  const id = normalizeText(dayId);
  if (!id || getFixedDayIds().has(id)) return null;
  return readPath(id);
}

export function getFixedDays() {
  return fixedDays.map((day) => ({ ...day }));
}

export function setFixedDays(days) {
  fixedDays = cloneFixedDays(days);
  const nextMeta = writeMeta(readMeta());
  return getTabs(nextMeta);
}

export function __resetDayHistoryForTests() {
  fixedDays = DEFAULT_FIXED_DAYS.map((day) => ({ ...day }));
  memoryMeta = createDefaultMeta();
  memoryPathStore = new Map();
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(META_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }
}

export { META_STORAGE_KEY, PATH_DB_NAME };
