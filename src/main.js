import 'leaflet/dist/leaflet.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import L from 'leaflet';
import mapboxgl from 'mapbox-gl';
import html2canvas from 'html2canvas';
import './styles.css';

const MAPBOX_TOKEN = (import.meta.env.MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN || '').trim();

const FIXED_STOPS = [
  {
    id: 'hotel',
    name: 'Park Thompson Central Park',
    time: 'Before 9:30',
    address: '119 W 56th St, New York, NY',
    note: 'Start point. Walk east to the southeast park entrance.',
    markerColor: '#2f6c59',
    fallback: [40.7643285, -73.978572],
  },
  {
    id: 'ej',
    name: "EJ's Luncheonette",
    time: '10:30-11:30',
    address: '1271 3rd Ave, New York, NY 10021',
    note: 'Warm diner breakfast.',
    markerColor: '#d98a3e',
    fallback: [40.7704393, -73.9597626],
  },
  {
    id: 'frick',
    name: 'The Frick Collection',
    time: '11:45-1:15',
    address: '1 E 70th St, New York, NY 10021',
    note: 'Frick: 60-90 min loop.',
    markerColor: '#4e6fae',
    fallback: [40.7712536, -73.9670961],
  },
  {
    id: 'cisiamo',
    name: 'Ci Siamo',
    time: '2:00 lunch',
    address: '440 W 33rd St, New York, NY 10001',
    note: 'Lunch at Manhattan West.',
    markerColor: '#2f5d8a',
    fallback: [40.75331, -73.998415],
  },
];

const STEP_CONFIG = [
  {
    id: 'step1',
    time: '9:30-10:30',
    title: 'Central Park scenic walk to UES',
    meta: 'Hotel -> The Pond -> Mall -> Bethesda -> east exit -> EJ\'s',
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
];

const STATIC_POINTS = {
  highlineStart: {
    id: 'highlineStart',
    name: 'High Line access (Hudson Yards side)',
    time: '3:30-4:30',
    address: 'Near W 34th St & 12th Ave, New York, NY',
    note: 'Enter around Hudson Yards and walk south.',
    markerColor: '#2b9aa0',
    coord: [40.75386, -74.00674],
  },
  highlineEnd: {
    id: 'highlineEnd',
    name: 'High Line south end (Meatpacking)',
    time: '3:30-4:30',
    address: 'Near Gansevoort St, New York, NY',
    note: 'Southbound finish near Chelsea/Meatpacking.',
    markerColor: '#2b9aa0',
    coord: [40.73958, -74.00899],
  },
};

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

  registerFeature(stepIds, feature) {
    this.featureRegistry.push(feature);
    for (const stepId of stepIds) {
      if (!this.featuresByStep.has(stepId)) this.featuresByStep.set(stepId, []);
      this.featuresByStep.get(stepId).push(feature);
    }
  }

  extendBounds(coord) {
    this.bounds.extend(coord);
  }

  addStop(stepIds, stop) {
    const layer = L.circleMarker(stop.coord, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: stop.markerColor,
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
    return layer;
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

  registerFeature(stepIds, feature) {
    this.featureRegistry.push(feature);
    for (const stepId of stepIds) {
      if (!this.featuresByStep.has(stepId)) this.featuresByStep.set(stepId, []);
      this.featuresByStep.get(stepId).push(feature);
    }
  }

  extendBounds(coord) {
    this.bounds.extend([coord[1], coord[0]]);
  }

  addStop(stepIds, stop) {
    const el = document.createElement('div');
    el.className = 'mb-stop-marker';
    el.style.background = stop.markerColor;

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
      new mapboxgl.Popup({ maxWidth: '300px' })
        .setLngLat(evt.lngLat)
        .setHTML(buildRoutePopup(route))
        .addTo(this.map);
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

    const coordinates = zone.coords.map((coord) => [coord[1], coord[0]]);
    const closed = closeRing(coordinates);

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [closed],
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
      new mapboxgl.Popup({ maxWidth: '320px' })
        .setLngLat(evt.lngLat)
        .setHTML(buildZonePopup(zone))
        .addTo(this.map);
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

function closeRing(coords) {
  if (coords.length === 0) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
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

async function geocodeStop(stop, useMapbox) {
  if (useMapbox) {
    const mapboxCoord = await geocodeWithMapbox(stop.address);
    if (mapboxCoord) {
      return { coord: mapboxCoord, source: 'Mapbox Geocoding API' };
    }
  }

  const nominatimCoord = await geocodeWithNominatim(stop.address);
  if (nominatimCoord) {
    return { coord: nominatimCoord, source: 'Nominatim (OpenStreetMap)' };
  }

  return {
    coord: stop.fallback,
    source: 'Fallback coordinate (Nominatim lookup, 2026-02-13)',
  };
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
    return [lat, lng];
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

    const lat = Number(json[0].lat);
    const lng = Number(json[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return [lat, lng];
  } catch {
    return null;
  }
}

function buildGeometry(stopsById) {
  const parkWaypoints = [
    {
      id: 'cp-entrance',
      label: 'Park Entrance',
      note: 'Enter at Grand Army Plaza (near 59th St & 5th Ave).',
      coord: [40.76459, -73.97361],
    },
    {
      id: 'cp-pond',
      label: 'The Pond',
      note: 'Sheltered water views just inside the southeast corner.',
      coord: [40.76681, -73.97332],
    },
    {
      id: 'cp-mall',
      label: 'The Mall',
      note: 'Tree-lined promenade on Literary Walk.',
      coord: [40.7714, -73.97383],
    },
    {
      id: 'cp-bethesda',
      label: 'Bethesda Terrace',
      note: 'Fountain and arcade; good scenic midpoint.',
      coord: [40.77404, -73.97012],
    },
    {
      id: 'cp-bowbridge',
      label: 'Bow Bridge',
      note: 'Short optional scenic detour before heading east.',
      coord: [40.77544, -73.97158],
    },
    {
      id: 'cp-exit',
      label: 'East Side Exit',
      note: 'Exit around E 72nd St / 5th Ave to approach 3rd Ave efficiently.',
      coord: [40.77274, -73.96615],
    },
  ];

  const routeA = {
    id: 'routeA',
    name: 'Central Park interior walk',
    time: '9:30-10:30',
    note: 'Scenic route via interior paths (Pond, Mall, Bethesda, Bow Bridge), then east exit to EJ\'s.',
    color: STEP_CONFIG[0].color,
    dashed: false,
    coords: [
      stopsById.hotel.coord,
      [40.76456, -73.97645],
      parkWaypoints[0].coord,
      parkWaypoints[1].coord,
      [40.76842, -73.97326],
      parkWaypoints[2].coord,
      [40.77293, -73.97228],
      parkWaypoints[3].coord,
      parkWaypoints[4].coord,
      [40.77479, -73.96925],
      [40.77394, -73.96775],
      parkWaypoints[5].coord,
      [40.77228, -73.96357],
      [40.77156, -73.96085],
      stopsById.ej.coord,
    ],
  };

  const routeB = {
    id: 'routeB',
    name: 'Walk: EJ\'s to The Frick',
    time: '11:30-11:45',
    note: 'Short Upper East Side walk west toward Fifth Avenue.',
    color: STEP_CONFIG[2].color,
    dashed: false,
    coords: [
      stopsById.ej.coord,
      [40.77042, -73.9632],
      [40.77077, -73.96588],
      stopsById.frick.coord,
    ],
  };

  const routeC = {
    id: 'routeC',
    name: 'Transit/Ride: Frick to Ci Siamo',
    time: '1:15-2:00',
    note: 'Recommended as subway/ride transfer (not walking).',
    color: STEP_CONFIG[3].color,
    dashed: true,
    coords: [
      stopsById.frick.coord,
      [40.76795, -73.97765],
      [40.7587, -73.98548],
      [40.75479, -73.99012],
      stopsById.cisiamo.coord,
    ],
  };

  const routeD = {
    id: 'routeD',
    name: 'High Line southbound walk',
    time: '3:30-4:30',
    note: 'Reasonable southbound segment from Hudson Yards area into Meatpacking.',
    color: STEP_CONFIG[4].color,
    dashed: false,
    coords: [
      STATIC_POINTS.highlineStart.coord,
      [40.7522, -74.00565],
      [40.74944, -74.00476],
      [40.74632, -74.00422],
      [40.7439, -74.00402],
      [40.74207, -74.00527],
      [40.74095, -74.00721],
      [40.73958, -74.00899],
      STATIC_POINTS.highlineEnd.coord,
    ],
  };

  const zones = {
    highLineZone: {
      id: 'highLineZone',
      name: 'High Line focus zone',
      time: '3:30-4:30',
      note: 'Flexible entry points near Hudson Yards; route continues south.',
      color: STEP_CONFIG[4].color,
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
    drinksZone: {
      id: 'drinksZone',
      name: 'Drinks area (flexible)',
      time: '5:00+',
      note: 'Chelsea/Meatpacking cluster; pick venue based on mood and crowd.',
      color: STEP_CONFIG[5].color,
      coords: [
        [40.7449, -74.01015],
        [40.7449, -73.99772],
        [40.73522, -73.99772],
        [40.73522, -74.01062],
      ],
    },
  };

  return { parkWaypoints, routes: { routeA, routeB, routeC, routeD }, zones };
}

function renderLegend() {
  const legend = document.getElementById('legend');
  const lines = STEP_CONFIG.map((step) => {
    return `
      <div class="legend-row">
        <span class="legend-chip" style="background:${step.color}"></span>
        <span>${escapeHtml(step.time)} - ${escapeHtml(step.title)}</span>
      </div>
    `;
  }).join('');

  legend.innerHTML = `<p class="legend-title">Itinerary Steps</p>${lines}`;
}

function renderItineraryList(onSelect) {
  const list = document.getElementById('itinerary-list');
  list.innerHTML = '';

  for (const step of STEP_CONFIG) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'itinerary-item';
    button.dataset.stepId = step.id;
    button.style.setProperty('--item-color', step.color);
    button.innerHTML = `
      <span class="time">${escapeHtml(step.time)}</span>
      <span class="title">${escapeHtml(step.title)}</span>
      <span class="meta">${escapeHtml(step.meta)}</span>
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
  } catch (error) {
    renderer.map.remove();
    setEngineBadge('Map engine: Leaflet + OpenStreetMap (Mapbox failed, fallback used)');
    return new LeafletRenderer('map');
  }
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

async function init() {
  setStatus('Geocoding fixed stops...');

  const renderer = await createRenderer();
  await renderer.whenReady();

  const geocodedStops = await Promise.all(
    FIXED_STOPS.map(async (stop) => {
      const result = await geocodeStop(stop, renderer.mode === 'mapbox');
      return {
        ...stop,
        coord: result.coord,
        geocodeSource: result.source,
      };
    }),
  );

  const stopsById = Object.fromEntries(geocodedStops.map((stop) => [stop.id, stop]));

  const { routes, parkWaypoints, zones } = buildGeometry(stopsById);

  const enrichedStops = {
    ...stopsById,
    highlineStart: STATIC_POINTS.highlineStart,
    highlineEnd: STATIC_POINTS.highlineEnd,
  };

  renderLegend();

  renderer.addRoute(['step1'], routes.routeA);
  renderer.addRoute(['step3'], routes.routeB);
  renderer.addRoute(['step4'], routes.routeC);
  renderer.addRoute(['step5'], routes.routeD);

  renderer.addZone(['step5'], zones.highLineZone);
  renderer.addZone(['step6'], zones.drinksZone);

  for (const waypoint of parkWaypoints) {
    renderer.addWaypoint(['step1'], waypoint);
  }

  renderer.addStop(['step1'], enrichedStops.hotel);
  renderer.addStop(['step1', 'step2', 'step3'], enrichedStops.ej);
  renderer.addStop(['step3', 'step4'], enrichedStops.frick);
  renderer.addStop(['step4'], enrichedStops.cisiamo);
  renderer.addStop(['step5'], enrichedStops.highlineStart);
  renderer.addStop(['step5'], enrichedStops.highlineEnd);

  renderer.fitToData();

  renderItineraryList((stepId) => {
    setActiveListItem(stepId);
    renderer.setActiveStep(stepId);
  });

  setActiveListItem('step1');
  renderer.setActiveStep('step1');

  const sourceSummary = geocodedStops
    .map((stop) => `${stop.name}: ${stop.geocodeSource}`)
    .join(' | ');

  setStatus(`Loaded. Geocode sources -> ${sourceSummary}`);

  document.getElementById('download-btn').addEventListener('click', exportMapImage);
}

init().catch((error) => {
  setStatus(`Initialization failed: ${error.message}`);
});
