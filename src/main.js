import 'leaflet/dist/leaflet.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import L from 'leaflet';
import mapboxgl from 'mapbox-gl';
import html2canvas from 'html2canvas';
import {
  FINAL_GOOGLE_MAPS_URL,
  FINALIZED_ITINERARY_PATCH,
  ITINERARY_DATE,
  getGoogleMapsUrl,
} from './itinerary.js';
import {
  getActiveDay,
  getDayPathGeoJSON,
  listDays,
  loadDayHistory,
  saveUploadedPath,
  setActiveDay,
} from '../shared/day-history.js';
import './styles.css';

const MAPBOX_TOKEN = (import.meta.env.MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN || '').trim();
const STORAGE_KEY = 'nyc-itinerary-update-patch-v2';
const UPLOADED_PATH_COLOR = '#8c3f13';

const DEFAULT_ITINERARY = {
  weatherNote:
    'Cold but sunny day. Central Park route prioritizes scenic interior paths to reduce wind exposure.',
  steps: [
    {
      id: 'step1',
      time: '9:30-10:30',
      title: 'Central Park scenic walk to UES',
      meta: "Hotel -> The Pond -> Mall -> Bethesda -> east exit -> EJ's",
      color: '#3b7a57',
    },
    {
      id: 'step2',
      time: '10:30-11:30',
      title: "Breakfast at EJ's Luncheonette",
      meta: 'Upper East Side diner stop',
      color: '#d98a3e',
    },
    {
      id: 'step3',
      time: '11:45-1:15',
      title: 'The Frick Collection',
      meta: 'Museum visit block',
      color: '#4e6fae',
    },
    {
      id: 'step4',
      time: '2:00',
      title: 'Transit/Ride to Ci Siamo',
      meta: 'Not walking (subway/ride)',
      color: '#2f5d8a',
    },
    {
      id: 'step5',
      time: '3:30-4:30',
      title: 'High Line southbound walk',
      meta: 'Hudson Yards area -> Chelsea/Meatpacking',
      color: '#2b9aa0',
    },
    {
      id: 'step6',
      time: '5:00+',
      title: 'Drinks zone (flexible)',
      meta: 'Chelsea or Meatpacking',
      color: '#b95f3c',
    },
  ],
  stops: [
    {
      id: 'hotel',
      name: 'Park Thompson Central Park',
      time: 'Before 9:30',
      address: '119 W 56th St, New York, NY',
      note: 'Start point. Walk east to the southeast park entrance.',
      markerColor: '#2f6c59',
      fallback: [40.7643285, -73.978572],
      stepIds: ['step1'],
    },
    {
      id: 'ej',
      name: "EJ's Luncheonette",
      time: '10:30-11:30',
      address: '1271 3rd Ave, New York, NY 10021',
      note: 'Warm diner breakfast.',
      markerColor: '#d98a3e',
      fallback: [40.7704393, -73.9597626],
      stepIds: ['step1', 'step2', 'step3'],
    },
    {
      id: 'frick',
      name: 'The Frick Collection',
      time: '11:45-1:15',
      address: '1 E 70th St, New York, NY 10021',
      note: 'Frick: 60-90 min loop.',
      markerColor: '#4e6fae',
      fallback: [40.7712536, -73.9670961],
      stepIds: ['step3', 'step4'],
    },
    {
      id: 'cisiamo',
      name: 'Ci Siamo',
      time: '2:00 lunch',
      address: '440 W 33rd St, New York, NY 10001',
      note: 'Lunch at Manhattan West.',
      markerColor: '#2f5d8a',
      fallback: [40.75331, -73.998415],
      stepIds: ['step4'],
    },
  ],
  staticPoints: [
    {
      id: 'highlineStart',
      name: 'High Line access (Hudson Yards side)',
      time: '3:30-4:30',
      address: 'Near W 34th St & 12th Ave, New York, NY',
      note: 'Enter around Hudson Yards and walk south.',
      markerColor: '#2b9aa0',
      coord: [40.75386, -74.00674],
      stepIds: ['step5'],
    },
    {
      id: 'highlineEnd',
      name: 'High Line south end (Meatpacking)',
      time: '3:30-4:30',
      address: 'Near Gansevoort St, New York, NY',
      note: 'Southbound finish near Chelsea/Meatpacking.',
      markerColor: '#2b9aa0',
      coord: [40.73958, -74.00899],
      stepIds: ['step5'],
    },
  ],
  parkWaypoints: [
    {
      id: 'cp-entrance',
      label: 'Park Entrance',
      note: 'Enter at Grand Army Plaza (near 59th St & 5th Ave).',
      coord: [40.76459, -73.97361],
      stepIds: ['step1'],
    },
    {
      id: 'cp-pond',
      label: 'The Pond',
      note: 'Sheltered water views just inside the southeast corner.',
      coord: [40.76681, -73.97332],
      stepIds: ['step1'],
    },
    {
      id: 'cp-mall',
      label: 'The Mall',
      note: 'Tree-lined promenade on Literary Walk.',
      coord: [40.7714, -73.97383],
      stepIds: ['step1'],
    },
    {
      id: 'cp-bethesda',
      label: 'Bethesda Terrace',
      note: 'Fountain and arcade; good scenic midpoint.',
      coord: [40.77404, -73.97012],
      stepIds: ['step1'],
    },
    {
      id: 'cp-bowbridge',
      label: 'Bow Bridge',
      note: 'Short optional scenic detour before heading east.',
      coord: [40.77544, -73.97158],
      stepIds: ['step1'],
    },
    {
      id: 'cp-exit',
      label: 'East Side Exit',
      note: 'Exit around E 72nd St / 5th Ave to approach 3rd Ave efficiently.',
      coord: [40.77274, -73.96615],
      stepIds: ['step1'],
    },
  ],
  routes: [
    {
      id: 'routeA',
      name: 'Central Park interior walk',
      time: '9:30-10:30',
      note: "Scenic route via interior paths (Pond, Mall, Bethesda, Bow Bridge), then east exit to EJ's.",
      stepIds: ['step1'],
      color: '#3b7a57',
      dashed: false,
    },
    {
      id: 'routeB',
      name: "Walk: EJ's to The Frick",
      time: '11:30-11:45',
      note: 'Short Upper East Side walk west toward Fifth Avenue.',
      stepIds: ['step3'],
      color: '#4e6fae',
      dashed: false,
    },
    {
      id: 'routeC',
      name: 'Transit/Ride: Frick to Ci Siamo',
      time: '1:15-2:00',
      note: 'Recommended as subway/ride transfer (not walking).',
      stepIds: ['step4'],
      color: '#2f5d8a',
      dashed: true,
    },
    {
      id: 'routeD',
      name: 'High Line southbound walk',
      time: '3:30-4:30',
      note: 'Reasonable southbound segment from Hudson Yards area into Meatpacking.',
      stepIds: ['step5'],
      color: '#2b9aa0',
      dashed: false,
    },
  ],
  zones: [
    {
      id: 'highLineZone',
      name: 'High Line focus zone',
      time: '3:30-4:30',
      note: 'Flexible entry points near Hudson Yards; route continues south.',
      stepIds: ['step5'],
      color: '#2b9aa0',
      coords: [
        [40.75475, -74.0078],
        [40.7541, -74.00385],
        [40.74862, -74.00353],
        [40.74332, -74.00538],
        [40.73901, -74.00874],
        [40.73902, -74.01124],
        [40.74298, -74.00847],
        [40.74833, -74.00625],
      ],
    },
    {
      id: 'drinksZone',
      name: 'Drinks area (flexible)',
      time: '5:00+',
      note: 'Chelsea/Meatpacking cluster; pick venue based on mood and crowd.',
      stepIds: ['step6'],
      color: '#b95f3c',
      coords: [
        [40.7449, -74.01015],
        [40.7449, -73.99772],
        [40.73522, -73.99772],
        [40.73522, -74.01062],
      ],
    },
  ],
};

const BASE_ITINERARY = applyPatchToConfig(DEFAULT_ITINERARY, FINALIZED_ITINERARY_PATCH);

let activeConfig = deepClone(BASE_ITINERARY);
let activeRenderer = null;
let activeStepId = null;
let renderNonce = 0;
let activeDayId = null;
let activeDayPathGeoJSON = null;

class LeafletRenderer {
  constructor(containerId) {
    this.mode = 'leaflet';
    this.map = L.map(containerId, {
      zoomControl: true,
      preferCanvas: true,
    }).setView([40.764, -73.975], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(this.map);

    this.featureRegistry = [];
    this.featuresByStep = new Map();
    this.bounds = L.latLngBounds([]);
  }

  whenReady() {
    return Promise.resolve();
  }

  destroy() {
    if (this.map) {
      this.map.remove();
    }
    this.featureRegistry = [];
    this.featuresByStep.clear();
  }

  registerFeature(stepIds, feature) {
    this.featureRegistry.push(feature);

    for (const stepId of stepIds || []) {
      if (!this.featuresByStep.has(stepId)) this.featuresByStep.set(stepId, []);
      this.featuresByStep.get(stepId).push(feature);
    }
  }

  extendBounds(coord) {
    if (isValidCoord(coord)) {
      this.bounds.extend(coord);
    }
  }

  addStop(stepIds, stop) {
    const layer = L.circleMarker(stop.coord, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: stop.markerColor || '#4a6279',
      fillOpacity: 0.95,
      opacity: 1,
    }).addTo(this.map);

    layer.bindPopup(buildStopPopup(stop));
    this.extendBounds(stop.coord);

    const feature = {
      setState: (state) => {
        if (state === 'active') {
          layer.setRadius(10);
          layer.setStyle({ opacity: 1, fillOpacity: 1, weight: 3 });
        } else if (state === 'dim') {
          layer.setRadius(6);
          layer.setStyle({ opacity: 0.35, fillOpacity: 0.35, weight: 1 });
        } else {
          layer.setRadius(7);
          layer.setStyle({ opacity: 1, fillOpacity: 0.95, weight: 2 });
        }
      },
    };

    this.registerFeature(stepIds, feature);
  }

  addWaypoint(stepIds, waypoint) {
    const layer = L.circleMarker(waypoint.coord, {
      radius: 4,
      color: '#2f5f4f',
      weight: 1,
      fillColor: '#e9f7ef',
      fillOpacity: 1,
      opacity: 1,
    }).addTo(this.map);

    layer.bindTooltip(waypoint.label, {
      permanent: true,
      direction: 'top',
      className: 'waypoint-label',
      offset: [0, -2],
    });
    layer.bindPopup(buildWaypointPopup(waypoint));

    this.extendBounds(waypoint.coord);

    const feature = {
      setState: (state) => {
        if (state === 'active') {
          layer.setStyle({ opacity: 1, fillOpacity: 1, radius: 5 });
        } else if (state === 'dim') {
          layer.setStyle({ opacity: 0.3, fillOpacity: 0.3, radius: 3 });
        } else {
          layer.setStyle({ opacity: 1, fillOpacity: 1, radius: 4 });
        }
      },
    };

    this.registerFeature(stepIds, feature);
  }

  addRoute(stepIds, route) {
    const layer = L.polyline(route.coords, {
      color: route.color,
      weight: route.dashed ? 4 : 4.5,
      opacity: 0.82,
      dashArray: route.dashed ? '10 8' : null,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(this.map);

    layer.bindPopup(buildRoutePopup(route));

    for (const coord of route.coords) this.extendBounds(coord);

    const feature = {
      setState: (state) => {
        if (state === 'active') {
          layer.setStyle({ opacity: 1, weight: route.dashed ? 6 : 6.5 });
        } else if (state === 'dim') {
          layer.setStyle({ opacity: 0.18, weight: route.dashed ? 3 : 3.5 });
        } else {
          layer.setStyle({ opacity: 0.82, weight: route.dashed ? 4 : 4.5 });
        }
      },
    };

    this.registerFeature(stepIds, feature);
  }

  addZone(stepIds, zone) {
    const layer = L.polygon(zone.coords, {
      color: zone.color,
      weight: 1.5,
      fillColor: zone.color,
      fillOpacity: 0.2,
      opacity: 0.85,
    }).addTo(this.map);

    layer.bindPopup(buildZonePopup(zone));

    for (const coord of zone.coords) this.extendBounds(coord);

    const feature = {
      setState: (state) => {
        if (state === 'active') {
          layer.setStyle({ fillOpacity: 0.34, opacity: 1, weight: 2.5 });
        } else if (state === 'dim') {
          layer.setStyle({ fillOpacity: 0.06, opacity: 0.28, weight: 1 });
        } else {
          layer.setStyle({ fillOpacity: 0.2, opacity: 0.85, weight: 1.5 });
        }
      },
    };

    this.registerFeature(stepIds, feature);
  }

  setActiveStep(stepId) {
    const active = new Set(this.featuresByStep.get(stepId) || []);
    const hasActive = active.size > 0;

    for (const feature of this.featureRegistry) {
      feature.setState(hasActive ? 'dim' : 'default');
    }
    for (const feature of active) {
      feature.setState('active');
    }
  }

  fitToData() {
    if (this.bounds.isValid()) {
      this.map.fitBounds(this.bounds.pad(0.08));
    }
  }
}

class MapboxRenderer {
  constructor(containerId, token) {
    this.mode = 'mapbox';
    mapboxgl.accessToken = token;

    this.map = new mapboxgl.Map({
      container: containerId,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-73.975, 40.764],
      zoom: 12.5,
      preserveDrawingBuffer: true,
    });

    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    this.featureRegistry = [];
    this.featuresByStep = new Map();
    this.bounds = new mapboxgl.LngLatBounds();
    this.sourceCounter = 0;

    this.readyPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Mapbox load timeout')), 10000);

      this.map.on('load', () => {
        clearTimeout(timer);
        resolve();
      });

      this.map.once('error', (evt) => {
        if (!this.map.isStyleLoaded()) {
          clearTimeout(timer);
          reject(evt.error || new Error('Mapbox failed to initialize'));
        }
      });
    });
  }

  whenReady() {
    return this.readyPromise;
  }

  destroy() {
    if (this.map) {
      this.map.remove();
    }
    this.featureRegistry = [];
    this.featuresByStep.clear();
  }

  registerFeature(stepIds, feature) {
    this.featureRegistry.push(feature);

    for (const stepId of stepIds || []) {
      if (!this.featuresByStep.has(stepId)) this.featuresByStep.set(stepId, []);
      this.featuresByStep.get(stepId).push(feature);
    }
  }

  extendBounds(coord) {
    if (isValidCoord(coord)) {
      this.bounds.extend([coord[1], coord[0]]);
    }
  }

  addStop(stepIds, stop) {
    const el = document.createElement('div');
    el.className = 'mb-stop-marker';
    el.style.background = stop.markerColor || '#4a6279';

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([stop.coord[1], stop.coord[0]])
      .setPopup(new mapboxgl.Popup({ offset: 14, maxWidth: '300px' }).setHTML(buildStopPopup(stop)))
      .addTo(this.map);

    this.extendBounds(stop.coord);

    const feature = {
      setState: (state) => {
        el.classList.remove('is-active', 'is-dim');
        if (state === 'active') {
          el.classList.add('is-active');
        } else if (state === 'dim') {
          el.classList.add('is-dim');
        }
      },
      cleanup: () => marker.remove(),
    };

    this.registerFeature(stepIds, feature);
  }

  addWaypoint(stepIds, waypoint) {
    const el = document.createElement('div');
    el.className = 'mb-waypoint';
    el.innerHTML = '<span class="dot"></span><span class="label"></span>';
    el.querySelector('.label').textContent = waypoint.label;

    const marker = new mapboxgl.Marker({ element: el, anchor: 'left', offset: [4, 0] })
      .setLngLat([waypoint.coord[1], waypoint.coord[0]])
      .setPopup(new mapboxgl.Popup({ offset: 10, maxWidth: '280px' }).setHTML(buildWaypointPopup(waypoint)))
      .addTo(this.map);

    this.extendBounds(waypoint.coord);

    const feature = {
      setState: (state) => {
        el.classList.remove('is-active', 'is-dim');
        if (state === 'active') {
          el.classList.add('is-active');
        } else if (state === 'dim') {
          el.classList.add('is-dim');
        }
      },
      cleanup: () => marker.remove(),
    };

    this.registerFeature(stepIds, feature);
  }

  addRoute(stepIds, route) {
    const sourceId = `route-src-${this.sourceCounter}`;
    const layerId = `route-lyr-${this.sourceCounter}`;
    this.sourceCounter += 1;

    const coordinates = route.coords.map((coord) => [coord[1], coord[0]]);

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    });

    const paint = {
      'line-color': route.color,
      'line-width': route.dashed ? 4 : 4.5,
      'line-opacity': 0.82,
    };

    if (route.dashed) {
      paint['line-dasharray'] = [2, 1.4];
    }

    this.map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });

    this.map.on('click', layerId, (evt) => {
      if (!evt.lngLat) return;
      new mapboxgl.Popup({ maxWidth: '300px' }).setLngLat(evt.lngLat).setHTML(buildRoutePopup(route)).addTo(this.map);
    });

    this.map.on('mouseenter', layerId, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', layerId, () => {
      this.map.getCanvas().style.cursor = '';
    });

    for (const coord of route.coords) this.extendBounds(coord);

    const feature = {
      setState: (state) => {
        if (state === 'active') {
          this.map.setPaintProperty(layerId, 'line-opacity', 1);
          this.map.setPaintProperty(layerId, 'line-width', route.dashed ? 6 : 6.5);
        } else if (state === 'dim') {
          this.map.setPaintProperty(layerId, 'line-opacity', 0.18);
          this.map.setPaintProperty(layerId, 'line-width', route.dashed ? 3 : 3.5);
        } else {
          this.map.setPaintProperty(layerId, 'line-opacity', 0.82);
          this.map.setPaintProperty(layerId, 'line-width', route.dashed ? 4 : 4.5);
        }
      },
      cleanup: () => {
        if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
        if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
      },
    };

    this.registerFeature(stepIds, feature);
  }

  addZone(stepIds, zone) {
    const sourceId = `zone-src-${this.sourceCounter}`;
    const fillLayerId = `zone-fill-${this.sourceCounter}`;
    const lineLayerId = `zone-line-${this.sourceCounter}`;
    this.sourceCounter += 1;

    const coordinates = closeRing(zone.coords.map((coord) => [coord[1], coord[0]]));

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      },
    });

    this.map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': zone.color,
        'fill-opacity': 0.2,
      },
    });

    this.map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': zone.color,
        'line-opacity': 0.85,
        'line-width': 1.5,
      },
    });

    this.map.on('click', fillLayerId, (evt) => {
      if (!evt.lngLat) return;
      new mapboxgl.Popup({ maxWidth: '320px' }).setLngLat(evt.lngLat).setHTML(buildZonePopup(zone)).addTo(this.map);
    });

    this.map.on('mouseenter', fillLayerId, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', fillLayerId, () => {
      this.map.getCanvas().style.cursor = '';
    });

    for (const coord of zone.coords) this.extendBounds(coord);

    const feature = {
      setState: (state) => {
        if (state === 'active') {
          this.map.setPaintProperty(fillLayerId, 'fill-opacity', 0.34);
          this.map.setPaintProperty(lineLayerId, 'line-opacity', 1);
          this.map.setPaintProperty(lineLayerId, 'line-width', 2.5);
        } else if (state === 'dim') {
          this.map.setPaintProperty(fillLayerId, 'fill-opacity', 0.06);
          this.map.setPaintProperty(lineLayerId, 'line-opacity', 0.26);
          this.map.setPaintProperty(lineLayerId, 'line-width', 1);
        } else {
          this.map.setPaintProperty(fillLayerId, 'fill-opacity', 0.2);
          this.map.setPaintProperty(lineLayerId, 'line-opacity', 0.85);
          this.map.setPaintProperty(lineLayerId, 'line-width', 1.5);
        }
      },
      cleanup: () => {
        if (this.map.getLayer(fillLayerId)) this.map.removeLayer(fillLayerId);
        if (this.map.getLayer(lineLayerId)) this.map.removeLayer(lineLayerId);
        if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
      },
    };

    this.registerFeature(stepIds, feature);
  }

  setActiveStep(stepId) {
    const active = new Set(this.featuresByStep.get(stepId) || []);
    const hasActive = active.size > 0;

    for (const feature of this.featureRegistry) {
      feature.setState(hasActive ? 'dim' : 'default');
    }
    for (const feature of active) {
      feature.setState('active');
    }
  }

  fitToData() {
    if (!this.bounds.isEmpty()) {
      this.map.fitBounds(this.bounds, {
        padding: 70,
        duration: 0,
      });
    }
  }
}

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(baseValue, patchValue) {
  if (patchValue === undefined) {
    return deepClone(baseValue);
  }

  if (Array.isArray(patchValue)) {
    return deepClone(patchValue);
  }

  if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
    const merged = deepClone(baseValue);
    for (const key of Object.keys(patchValue)) {
      merged[key] = deepMerge(baseValue[key], patchValue[key]);
    }
    return merged;
  }

  if (isPlainObject(patchValue)) {
    return deepClone(patchValue);
  }

  return patchValue;
}

function mergeArrayById(baseArray, patchArray) {
  if (!Array.isArray(baseArray)) return [];
  if (!Array.isArray(patchArray)) return deepClone(baseArray);

  const merged = baseArray.map((item) => deepClone(item));
  const indexById = new Map();

  merged.forEach((item, idx) => {
    if (item && item.id) indexById.set(item.id, idx);
  });

  for (const patchItem of patchArray) {
    if (!isPlainObject(patchItem) || !patchItem.id) continue;

    if (indexById.has(patchItem.id)) {
      const idx = indexById.get(patchItem.id);
      merged[idx] = deepMerge(merged[idx], patchItem);
    } else {
      merged.push(deepClone(patchItem));
      indexById.set(patchItem.id, merged.length - 1);
    }
  }

  const patchOrder = patchArray.filter((item) => isPlainObject(item) && item.id).map((item) => item.id);
  const patchOrderSet = new Set(patchOrder);

  const ordered = [];
  for (const id of patchOrder) {
    const idx = indexById.get(id);
    if (idx !== undefined) ordered.push(merged[idx]);
  }

  for (const item of merged) {
    if (!item?.id || !patchOrderSet.has(item.id)) {
      ordered.push(item);
    }
  }

  return ordered;
}

function normalizeCoord(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return null;

  const lat = Number(coord[0]);
  const lng = Number(coord[1]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return [lat, lng];
}

function normalizeCoordList(coords) {
  if (!Array.isArray(coords)) return [];
  return coords.map((coord) => normalizeCoord(coord)).filter((coord) => Boolean(coord));
}

function isValidCoord(coord) {
  return Boolean(normalizeCoord(coord));
}

function closeRing(coords) {
  if (coords.length === 0) return coords;

  const first = coords[0];
  const last = coords[coords.length - 1];

  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

function buildDefaultPatchTemplate(config) {
  return {
    googleMapsUrl: config.googleMapsUrl || FINAL_GOOGLE_MAPS_URL,
    weatherNote: config.weatherNote,
    steps: config.steps.map((step) => ({
      id: step.id,
      time: step.time,
      title: step.title,
      meta: step.meta,
      color: step.color,
    })),
    stops: config.stops.map((stop) => ({
      id: stop.id,
      name: stop.name,
      time: stop.time,
      address: stop.address,
      note: stop.note,
      markerColor: stop.markerColor,
      stepIds: stop.stepIds,
      hidden: Boolean(stop.hidden),
    })),
    staticPoints: config.staticPoints.map((point) => ({
      id: point.id,
      name: point.name,
      time: point.time,
      address: point.address,
      note: point.note,
      markerColor: point.markerColor,
      coord: point.coord,
      stepIds: point.stepIds,
      hidden: Boolean(point.hidden),
    })),
    parkWaypoints: config.parkWaypoints.map((waypoint) => ({
      id: waypoint.id,
      label: waypoint.label,
      note: waypoint.note,
      coord: waypoint.coord,
      stepIds: waypoint.stepIds,
      hidden: Boolean(waypoint.hidden),
    })),
    routes: config.routes.map((route) => ({
      id: route.id,
      name: route.name,
      time: route.time,
      note: route.note,
      color: route.color,
      dashed: Boolean(route.dashed),
      stepIds: route.stepIds,
      coords: route.coords,
      hidden: Boolean(route.hidden),
    })),
    zones: config.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      time: zone.time,
      note: zone.note,
      color: zone.color,
      coords: zone.coords,
      stepIds: zone.stepIds,
      hidden: Boolean(zone.hidden),
    })),
  };
}

function applyPatchToConfig(baseConfig, patch) {
  const next = deepClone(baseConfig);

  if (!isPlainObject(patch)) return next;

  if (typeof patch.weatherNote === 'string') {
    next.weatherNote = patch.weatherNote;
  }

  if (Array.isArray(patch.steps)) {
    next.steps = mergeArrayById(next.steps, patch.steps);
  }

  if (Array.isArray(patch.stops)) {
    next.stops = mergeArrayById(next.stops, patch.stops);
  }

  if (Array.isArray(patch.staticPoints)) {
    next.staticPoints = mergeArrayById(next.staticPoints, patch.staticPoints);
  }

  if (Array.isArray(patch.parkWaypoints)) {
    next.parkWaypoints = mergeArrayById(next.parkWaypoints, patch.parkWaypoints);
  }

  if (Array.isArray(patch.routes)) {
    next.routes = mergeArrayById(next.routes, patch.routes);
  }

  if (Array.isArray(patch.zones)) {
    next.zones = mergeArrayById(next.zones, patch.zones);
  }

  return sanitizeConfig(next);
}

function sanitizeConfig(config) {
  const next = deepClone(config);

  next.steps = (Array.isArray(next.steps) ? next.steps : [])
    .filter((step) => isPlainObject(step) && step.id)
    .map((step) => ({
      ...step,
      stepIds: Array.isArray(step.stepIds) ? step.stepIds : undefined,
      color: typeof step.color === 'string' ? step.color : '#597081',
    }));

  next.stops = (Array.isArray(next.stops) ? next.stops : [])
    .filter((stop) => isPlainObject(stop) && stop.id)
    .map((stop) => ({
      ...stop,
      stepIds: Array.isArray(stop.stepIds) ? stop.stepIds : [],
      hidden: Boolean(stop.hidden),
      markerColor: typeof stop.markerColor === 'string' ? stop.markerColor : '#4a6279',
      fallback: normalizeCoord(stop.fallback) || normalizeCoord(stop.coord) || null,
    }));

  next.staticPoints = (Array.isArray(next.staticPoints) ? next.staticPoints : [])
    .filter((point) => isPlainObject(point) && point.id)
    .map((point) => ({
      ...point,
      stepIds: Array.isArray(point.stepIds) ? point.stepIds : [],
      hidden: Boolean(point.hidden),
      markerColor: typeof point.markerColor === 'string' ? point.markerColor : '#4a6279',
      coord: normalizeCoord(point.coord),
    }))
    .filter((point) => Boolean(point.coord));

  next.parkWaypoints = (Array.isArray(next.parkWaypoints) ? next.parkWaypoints : [])
    .filter((waypoint) => isPlainObject(waypoint) && waypoint.id)
    .map((waypoint) => ({
      ...waypoint,
      stepIds: Array.isArray(waypoint.stepIds) ? waypoint.stepIds : ['step1'],
      hidden: Boolean(waypoint.hidden),
      coord: normalizeCoord(waypoint.coord),
    }))
    .filter((waypoint) => Boolean(waypoint.coord));

  next.routes = (Array.isArray(next.routes) ? next.routes : [])
    .filter((route) => isPlainObject(route) && route.id)
    .map((route) => ({
      ...route,
      stepIds: Array.isArray(route.stepIds) ? route.stepIds : [],
      hidden: Boolean(route.hidden),
      dashed: Boolean(route.dashed),
      color: typeof route.color === 'string' ? route.color : '#557083',
    }));

  next.zones = (Array.isArray(next.zones) ? next.zones : [])
    .filter((zone) => isPlainObject(zone) && zone.id)
    .map((zone) => ({
      ...zone,
      stepIds: Array.isArray(zone.stepIds) ? zone.stepIds : [],
      hidden: Boolean(zone.hidden),
      color: typeof zone.color === 'string' ? zone.color : '#667281',
      coords: normalizeCoordList(zone.coords),
    }))
    .filter((zone) => zone.coords.length >= 3);

  next.googleMapsUrl =
    typeof next.googleMapsUrl === 'string' && next.googleMapsUrl.trim()
      ? next.googleMapsUrl.trim()
      : FINAL_GOOGLE_MAPS_URL;

  if (typeof next.weatherNote !== 'string') {
    next.weatherNote = DEFAULT_ITINERARY.weatherNote;
  }

  return next;
}

function buildStopPopup(stop) {
  return `
    <div>
      <h3 class="popup-title">${escapeHtml(stop.name)}</h3>
      <div class="popup-time">${escapeHtml(stop.time)}</div>
      <div class="popup-address">${escapeHtml(stop.address)}</div>
      <p class="popup-note">${escapeHtml(stop.note)}</p>
    </div>
  `;
}

function buildWaypointPopup(waypoint) {
  return `
    <div>
      <h3 class="popup-title">${escapeHtml(waypoint.label)}</h3>
      <p class="popup-note">${escapeHtml(waypoint.note)}</p>
    </div>
  `;
}

function buildRoutePopup(route) {
  return `
    <div>
      <h3 class="popup-title">${escapeHtml(route.name)}</h3>
      <div class="popup-time">${escapeHtml(route.time)}</div>
      <p class="popup-note">${escapeHtml(route.note)}</p>
    </div>
  `;
}

function buildZonePopup(zone) {
  return `
    <div>
      <h3 class="popup-title">${escapeHtml(zone.name)}</h3>
      <div class="popup-time">${escapeHtml(zone.time)}</div>
      <p class="popup-note">${escapeHtml(zone.note)}</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
}

function setEngineBadge(message) {
  const badge = document.getElementById('engine-badge');
  badge.textContent = message;
}

function setWeatherNote(message) {
  const weather = document.getElementById('weather-note');
  weather.textContent = message;
}

function getItineraryCompletionInfo() {
  const itineraryEnd = new Date(`${ITINERARY_DATE}T23:59:59`);
  const now = new Date();
  const completed = now.getTime() > itineraryEnd.getTime();

  const absoluteDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${ITINERARY_DATE}T12:00:00`));

  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startItinerary = new Date(`${ITINERARY_DATE}T00:00:00`);
  const dayDiff = Math.round((startNow.getTime() - startItinerary.getTime()) / 86400000);

  if (completed && dayDiff === 1) {
    return {
      completed: true,
      message: `Completed yesterday (${absoluteDate})`,
    };
  }

  if (completed) {
    return {
      completed: true,
      message: `Completed on ${absoluteDate}`,
    };
  }

  return {
    completed: false,
    message: `Planned for ${absoluteDate}`,
  };
}

function setTripStatus(info) {
  const el = document.getElementById('trip-status');
  el.textContent = `Status: ${info.message}`;
  el.classList.toggle('upcoming', !info.completed);
}

function setGoogleMapsLink(url) {
  const link = document.getElementById('google-maps-link');
  link.href = getGoogleMapsUrl({ googleMapsUrl: url });
}

function isIsoDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function getRootDayHref(day) {
  if (day.kind === 'uploaded') {
    return `/?day=${encodeURIComponent(day.id)}`;
  }
  return day.href || '/';
}

function setDayHistoryStatus(message) {
  const status = document.getElementById('day-history-status');
  if (status) status.textContent = message;
}

function renderDayTabs() {
  const container = document.getElementById('day-tabs');
  if (!container) return;

  const days = listDays();
  container.innerHTML = '';

  for (const day of days) {
    const link = document.createElement('a');
    link.className = 'day-tab';
    if (day.id === activeDayId) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }

    link.href = getRootDayHref(day);
    link.textContent = day.title;

    link.addEventListener('click', (evt) => {
      if (day.kind === 'uploaded') {
        evt.preventDefault();
        setActiveDay(day.id);
        window.location.href = getRootDayHref(day);
      } else if (day.id === 'friday') {
        evt.preventDefault();
        setActiveDay('friday');
        window.location.href = '/';
      } else if (day.id === 'saturday') {
        setActiveDay('saturday');
      }
    });

    container.appendChild(link);
  }
}

async function refreshActiveDayPath() {
  if (!activeDayId || activeDayId === 'friday' || activeDayId === 'saturday') {
    activeDayPathGeoJSON = null;
    return;
  }
  activeDayPathGeoJSON = await getDayPathGeoJSON(activeDayId);
}

function setDaySummaryStatus() {
  const days = listDays();
  const activeDay = days.find((day) => day.id === activeDayId);

  if (!activeDay) {
    setDayHistoryStatus('Day tabs loaded.');
    return;
  }

  if (activeDay.kind === 'uploaded' && activeDay.hasPath) {
    const dayLabel = activeDay.date ? `${activeDay.title} (${activeDay.date})` : activeDay.title;
    setDayHistoryStatus(`Active day: ${dayLabel}. Uploaded path overlay is enabled on the map.`);
    return;
  }

  setDayHistoryStatus(`Active day: ${activeDay.title}. Upload GPX/KML/GeoJSON to add a day path overlay.`);
}

async function handlePathUpload(file) {
  if (!file) return;

  const todayIso = new Date().toISOString().slice(0, 10);
  const requestedDate = window.prompt('Day date (YYYY-MM-DD)', todayIso);
  if (requestedDate === null) return;
  const trimmedDate = requestedDate.trim();
  if (trimmedDate && !isIsoDay(trimmedDate)) {
    setDayHistoryStatus('Upload failed: date must use YYYY-MM-DD format.');
    return;
  }

  const defaultTitle = trimmedDate ? `Day ${trimmedDate}` : file.name.replace(/\.[^.]+$/, '');
  const requestedTitle = window.prompt('Day label for tab', defaultTitle);
  if (requestedTitle === null) return;
  const trimmedTitle = requestedTitle.trim();

  try {
    setDayHistoryStatus(`Uploading ${file.name}...`);
    const saved = await saveUploadedPath(file, {
      date: trimmedDate || undefined,
      title: trimmedTitle || undefined,
    });

    activeDayId = setActiveDay(saved.day.id);
    await refreshActiveDayPath();
    renderDayTabs();
    setDaySummaryStatus();
    await renderMap(activeConfig);
  } catch (error) {
    setDayHistoryStatus(`Upload failed: ${error.message}`);
  }
}

function wireDayHistoryUi() {
  const uploadInput = document.getElementById('upload-day-path-input');
  const uploadButton = document.getElementById('upload-day-path-btn');

  uploadButton?.addEventListener('click', () => {
    uploadInput?.click();
  });

  uploadInput?.addEventListener('change', async () => {
    const [file] = uploadInput.files || [];
    await handlePathUpload(file);
    uploadInput.value = '';
  });
}

function getStepColor(config, stepId, fallback) {
  const step = config.steps.find((item) => item.id === stepId);
  if (step?.color) return step.color;
  return fallback || '#557083';
}

function getCoordById(itemMap, id) {
  const item = itemMap.get(id);
  return item?.coord || null;
}

function defaultRouteCoords(routeId, stopsById, staticPointsById, parkWaypointsById) {
  const wp = (id, fallback) => getCoordById(parkWaypointsById, id) || fallback;
  const stop = (id) => getCoordById(stopsById, id);
  const point = (id) => getCoordById(staticPointsById, id);

  if (routeId === 'routeA') {
    return normalizeCoordList([
      stop('hotel'),
      [40.76456, -73.97645],
      wp('cp-entrance', [40.76459, -73.97361]),
      wp('cp-pond', [40.76681, -73.97332]),
      [40.76842, -73.97326],
      wp('cp-mall', [40.7714, -73.97383]),
      [40.77293, -73.97228],
      wp('cp-bethesda', [40.77404, -73.97012]),
      wp('cp-bowbridge', [40.77544, -73.97158]),
      [40.77479, -73.96925],
      [40.77394, -73.96775],
      wp('cp-exit', [40.77274, -73.96615]),
      [40.77228, -73.96357],
      [40.77156, -73.96085],
      stop('ej'),
    ]);
  }

  if (routeId === 'routeB') {
    return normalizeCoordList([stop('ej'), [40.77042, -73.9632], [40.77077, -73.96588], stop('frick')]);
  }

  if (routeId === 'routeC') {
    return normalizeCoordList([
      stop('frick'),
      [40.76795, -73.97765],
      [40.7587, -73.98548],
      [40.75479, -73.99012],
      stop('cisiamo'),
    ]);
  }

  if (routeId === 'routeD') {
    return normalizeCoordList([
      point('highlineStart'),
      [40.7522, -74.00565],
      [40.74944, -74.00476],
      [40.74632, -74.00422],
      [40.7439, -74.00402],
      [40.74207, -74.00527],
      [40.74095, -74.00721],
      [40.73958, -74.00899],
      point('highlineEnd'),
    ]);
  }

  return [];
}

function buildGeometry(config, stopsById, staticPointsById) {
  const parkWaypoints = config.parkWaypoints
    .filter((waypoint) => !waypoint.hidden)
    .map((waypoint) => ({
      ...waypoint,
      coord: normalizeCoord(waypoint.coord),
    }))
    .filter((waypoint) => Boolean(waypoint.coord));

  const parkWaypointsById = new Map(parkWaypoints.map((waypoint) => [waypoint.id, waypoint]));

  const routes = config.routes
    .filter((route) => !route.hidden)
    .map((route) => {
      const fallbackColor = getStepColor(config, route.stepIds?.[0], '#557083');
      const customCoords = normalizeCoordList(route.coords);
      const coords = customCoords.length >= 2
        ? customCoords
        : defaultRouteCoords(route.id, stopsById, staticPointsById, parkWaypointsById);

      if (coords.length < 2) return null;

      return {
        ...route,
        coords,
        color: route.color || fallbackColor,
      };
    })
    .filter((route) => Boolean(route));

  const zones = config.zones
    .filter((zone) => !zone.hidden)
    .map((zone) => {
      const coords = normalizeCoordList(zone.coords);
      if (coords.length < 3) return null;

      return {
        ...zone,
        coords,
        color: zone.color || getStepColor(config, zone.stepIds?.[0], '#667281'),
      };
    })
    .filter((zone) => Boolean(zone));

  return { parkWaypoints, routes, zones };
}

function extractLineCoordsFromGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') return [];

  if (geometry.type === 'LineString') {
    return [normalizeCoordList((geometry.coordinates || []).map((coord) => [coord[1], coord[0]]))];
  }

  if (geometry.type === 'MultiLineString') {
    return (Array.isArray(geometry.coordinates) ? geometry.coordinates : []).map((line) =>
      normalizeCoordList((line || []).map((coord) => [coord[1], coord[0]])),
    );
  }

  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.flatMap((item) => extractLineCoordsFromGeometry(item));
  }

  return [];
}

function buildUploadedPathRoutes(config, featureCollection) {
  if (!featureCollection || featureCollection.type !== 'FeatureCollection') return [];
  if (!Array.isArray(featureCollection.features)) return [];

  const stepIds = config.steps.map((step) => step.id);
  let index = 0;

  const routes = [];
  for (const feature of featureCollection.features) {
    const lines = extractLineCoordsFromGeometry(feature?.geometry);
    for (const line of lines) {
      if (line.length < 2) continue;

      routes.push({
        id: `uploaded-path-${index}`,
        name: 'Uploaded Day Path',
        time: '',
        note: 'Path uploaded from your phone file.',
        stepIds,
        color: UPLOADED_PATH_COLOR,
        dashed: true,
        coords: line,
      });
      index += 1;
    }
  }

  return routes;
}

function renderLegend(steps, hasUploadedPath = false) {
  const legend = document.getElementById('legend');
  const lines = steps
    .map((step) => {
      return `
      <div class="legend-row">
        <span class="legend-chip" style="background:${step.color}"></span>
        <span>${escapeHtml(step.time)} - ${escapeHtml(step.title)}</span>
      </div>
    `;
    })
    .join('');

  const uploadedLine = hasUploadedPath
    ? `
      <div class="legend-row">
        <span class="legend-chip" style="background:${UPLOADED_PATH_COLOR}"></span>
        <span>Uploaded day path</span>
      </div>
    `
    : '';

  legend.innerHTML = `<p class="legend-title">Itinerary Steps</p>${lines}${uploadedLine}`;
}

function renderItineraryList(steps, onSelect, completedView) {
  const list = document.getElementById('itinerary-list');
  list.innerHTML = '';

  for (const step of steps) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'itinerary-item';
    if (completedView) button.classList.add('completed');
    button.dataset.stepId = step.id;
    button.style.setProperty('--item-color', step.color || '#667281');
    button.innerHTML = `
      <span class="time">${escapeHtml(step.time || '')}</span>
      <span class="title">${escapeHtml(step.title || step.id)}</span>
      <span class="meta">${escapeHtml(step.meta || '')}</span>
    `;

    button.addEventListener('click', () => {
      onSelect(step.id);
    });

    li.appendChild(button);
    list.appendChild(li);
  }
}

function setActiveListItem(stepId) {
  const buttons = document.querySelectorAll('.itinerary-item');
  for (const button of buttons) {
    button.classList.toggle('active', button.dataset.stepId === stepId);
  }
}

function getStoredPatch() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storePatch(patch) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patch));
  } catch {
    // Ignore storage errors in private mode / restricted contexts.
  }
}

function setEditorPatch(patch) {
  const editor = document.getElementById('itinerary-editor');
  editor.value = JSON.stringify(patch, null, 2);
}

function readEditorPatch() {
  const editor = document.getElementById('itinerary-editor');
  const value = editor.value.trim();
  if (!value) {
    throw new Error('Editor is empty. Paste JSON before applying.');
  }

  const parsed = JSON.parse(value);
  if (!isPlainObject(parsed)) {
    throw new Error('JSON must be an object.');
  }

  return parsed;
}

async function geocodeStop(stop, useMapbox) {
  const embeddedCoord = normalizeCoord(stop.coord);
  if (embeddedCoord) {
    return { coord: embeddedCoord, source: 'Provided coordinate' };
  }

  if (useMapbox && stop.address) {
    const mapboxCoord = await geocodeWithMapbox(stop.address);
    if (mapboxCoord) {
      return { coord: mapboxCoord, source: 'Mapbox Geocoding API' };
    }
  }

  if (stop.address) {
    const nominatimCoord = await geocodeWithNominatim(stop.address);
    if (nominatimCoord) {
      return { coord: nominatimCoord, source: 'Nominatim (OpenStreetMap)' };
    }
  }

  const fallback = normalizeCoord(stop.fallback);
  if (fallback) {
    return {
      coord: fallback,
      source: 'Fallback coordinate (Nominatim lookup, 2026-02-13)',
    };
  }

  return null;
}

async function geocodeWithMapbox(address) {
  if (!MAPBOX_TOKEN) return null;

  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address,
  )}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,poi`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const json = await response.json();
    const feature = json.features?.[0];
    if (!feature?.center || feature.center.length < 2) return null;
    const [lng, lat] = feature.center;
    return normalizeCoord([lat, lng]);
  } catch {
    return null;
  }
}

async function geocodeWithNominatim(address) {
  const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    address,
  )}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;
    const json = await response.json();
    if (!Array.isArray(json) || json.length === 0) return null;

    return normalizeCoord([json[0].lat, json[0].lon]);
  } catch {
    return null;
  }
}

async function createRenderer() {
  if (!MAPBOX_TOKEN) {
    setEngineBadge('Map engine: Leaflet + OpenStreetMap (MAPBOX_TOKEN not set)');
    return new LeafletRenderer('map');
  }

  const renderer = new MapboxRenderer('map', MAPBOX_TOKEN);

  try {
    await renderer.whenReady();
    setEngineBadge('Map engine: Mapbox GL JS');
    return renderer;
  } catch {
    renderer.destroy();
    setEngineBadge('Map engine: Leaflet + OpenStreetMap (Mapbox failed, fallback used)');
    return new LeafletRenderer('map');
  }
}

function setControlsDisabled(disabled) {
  document.getElementById('apply-updates-btn').disabled = disabled;
  document.getElementById('reset-updates-btn').disabled = disabled;
  document.getElementById('download-btn').disabled = disabled;
}

async function renderMap(config) {
  const nonce = ++renderNonce;
  const completionInfo = getItineraryCompletionInfo();
  setControlsDisabled(true);
  setWeatherNote(config.weatherNote);
  setTripStatus(completionInfo);
  setGoogleMapsLink(config.googleMapsUrl);
  setStatus('Geocoding fixed stops...');

  if (activeRenderer) {
    activeRenderer.destroy();
    activeRenderer = null;
  }

  const mapContainer = document.getElementById('map');
  mapContainer.innerHTML = '';

  const renderer = await createRenderer();
  await renderer.whenReady();

  if (nonce !== renderNonce) {
    renderer.destroy();
    return;
  }

  const geocodedStops = [];

  for (const stop of config.stops) {
    if (stop.hidden) continue;
    const result = await geocodeStop(stop, renderer.mode === 'mapbox');
    if (nonce !== renderNonce) {
      renderer.destroy();
      return;
    }

    if (!result) continue;

    geocodedStops.push({
      ...stop,
      coord: result.coord,
      geocodeSource: result.source,
    });
  }

  const stopsById = new Map(geocodedStops.map((stop) => [stop.id, stop]));

  const staticPoints = config.staticPoints
    .filter((point) => !point.hidden)
    .map((point) => ({
      ...point,
      coord: normalizeCoord(point.coord),
      geocodeSource: 'Provided coordinate',
    }))
    .filter((point) => Boolean(point.coord));

  const staticPointsById = new Map(staticPoints.map((point) => [point.id, point]));

  const { parkWaypoints, routes, zones } = buildGeometry(config, stopsById, staticPointsById);
  const uploadedPathRoutes = buildUploadedPathRoutes(config, activeDayPathGeoJSON);
  const combinedRoutes = [...routes, ...uploadedPathRoutes];

  renderLegend(config.steps, uploadedPathRoutes.length > 0);

  for (const route of combinedRoutes) {
    renderer.addRoute(route.stepIds, route);
  }

  for (const zone of zones) {
    renderer.addZone(zone.stepIds, zone);
  }

  for (const waypoint of parkWaypoints) {
    renderer.addWaypoint(waypoint.stepIds, waypoint);
  }

  for (const stop of [...geocodedStops, ...staticPoints]) {
    renderer.addStop(stop.stepIds, stop);
  }

  renderer.fitToData();

  activeRenderer = renderer;

  renderItineraryList(
    config.steps,
    (stepId) => {
      activeStepId = stepId;
      setActiveListItem(stepId);
      activeRenderer?.setActiveStep(stepId);
    },
    completionInfo.completed,
  );

  const defaultStepId =
    activeStepId && config.steps.some((step) => step.id === activeStepId) ? activeStepId : config.steps[0]?.id;

  if (defaultStepId) {
    activeStepId = defaultStepId;
    setActiveListItem(defaultStepId);
    activeRenderer.setActiveStep(defaultStepId);
  }

  const sourceSummary = geocodedStops
    .map((stop) => `${stop.name}: ${stop.geocodeSource}`)
    .join(' | ');

  const uploadedSummary =
    uploadedPathRoutes.length > 0 ? ` | Uploaded path segments: ${uploadedPathRoutes.length}` : '';
  setStatus(`Loaded. Geocode sources -> ${sourceSummary}${uploadedSummary}`);
  setControlsDisabled(false);
}

async function applyEditorPatch() {
  try {
    const patch = readEditorPatch();
    const nextConfig = applyPatchToConfig(BASE_ITINERARY, patch);
    activeConfig = nextConfig;
    storePatch(patch);
    await renderMap(activeConfig);
    setStatus('Updates applied. Map redrawn from editor JSON.');
  } catch (error) {
    setStatus(`Update failed: ${error.message}`);
  }
}

async function resetEditorTemplate() {
  const patch = buildDefaultPatchTemplate(BASE_ITINERARY);
  setEditorPatch(patch);
  storePatch(patch);
  activeConfig = applyPatchToConfig(BASE_ITINERARY, patch);
  await renderMap(activeConfig);
  setStatus('Editor reset to default itinerary template.');
}

async function exportMapImage() {
  const button = document.getElementById('download-btn');
  button.disabled = true;
  setStatus('Rendering PNG...');

  try {
    const shell = document.getElementById('map-shell');
    const canvas = await html2canvas(shell, {
      useCORS: true,
      allowTaint: false,
      scale: 2,
      logging: false,
      backgroundColor: '#f7fafc',
    });

    const link = document.createElement('a');
    const dateText = new Date().toISOString().slice(0, 10);
    link.download = `nyc-itinerary-map-${dateText}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    setStatus('PNG downloaded.');
  } catch (error) {
    setStatus(`Export failed: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function wireEvents() {
  document.getElementById('download-btn').addEventListener('click', exportMapImage);
  document.getElementById('apply-updates-btn').addEventListener('click', applyEditorPatch);
  document.getElementById('reset-updates-btn').addEventListener('click', resetEditorTemplate);
  wireDayHistoryUi();
}

async function init() {
  wireEvents();
  loadDayHistory();

  const queryDay = new URLSearchParams(window.location.search).get('day')?.trim();
  const availableDayIds = new Set(listDays().map((day) => day.id));

  if (queryDay && availableDayIds.has(queryDay)) {
    activeDayId = setActiveDay(queryDay);
  } else {
    activeDayId = getActiveDay();
    if (!availableDayIds.has(activeDayId)) {
      activeDayId = setActiveDay('friday');
    }
  }

  await refreshActiveDayPath();
  renderDayTabs();
  setDaySummaryStatus();

  const storedPatch = getStoredPatch();
  const startingPatch = storedPatch || buildDefaultPatchTemplate(BASE_ITINERARY);
  setEditorPatch(startingPatch);

  activeConfig = applyPatchToConfig(BASE_ITINERARY, startingPatch);
  await renderMap(activeConfig);
}

init().catch((error) => {
  setStatus(`Initialization failed: ${error.message}`);
  setControlsDisabled(false);
});
