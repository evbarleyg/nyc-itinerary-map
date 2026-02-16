import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
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
  setFixedDays,
  setActiveDay,
} from '../shared/day-history.js';
import {
  buildMapConfigFromDay,
  getDayById,
  getFixedDaysFromTrip,
  loadTripData,
} from '../shared/trip-data.js';
import './styles.css';

const STORAGE_KEY = 'nyc-itinerary-update-patch-v2';
const FULL_DAY_VIEW_STORAGE_KEY = 'nyc-itinerary-full-day-view-v1';
const UPLOADED_PATH_COLOR = '#8c3f13';
const APP_BASE_URL = ensureTrailingSlash(import.meta.env.BASE_URL || '/');

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

const SATURDAY_GOOGLE_MAPS_URL =
  'https://www.google.com/maps/dir/?api=1&origin=Thompson+Central+Park+New+York,+119+W+56th+St,+New+York,+NY+10019&destination=Frank,+88+2nd+Ave,+New+York,+NY+10003&waypoints=Brooklyn+Bridge+Pedestrian+Walkway+Entrance+near+City+Hall,+New+York,+NY|Pier+11+Wall+St,+11+South+St,+New+York,+NY+10004|The+Ten+Bells,+247+Broome+St,+New+York,+NY+10002|Thompson+Central+Park+New+York,+119+W+56th+St,+New+York,+NY+10019|New+York+Comedy+Club+Midtown,+241+E+24th+St,+New+York,+NY+10010&travelmode=transit';

const SATURDAY_ITINERARY = {
  weatherNote:
    'Cold but sunny. Keep this day loose: bridge + ferry + LES stop, then hotel reset before comedy and dinner.',
  googleMapsUrl: SATURDAY_GOOGLE_MAPS_URL,
  steps: [
    {
      id: 'sat-step1',
      time: '2:30-ish',
      title: 'Brooklyn Bridge walk (Manhattan -> Brooklyn)',
      meta: 'Start near City Hall entrance',
      color: '#2f6c59',
    },
    {
      id: 'sat-step2',
      time: 'After crossing',
      title: 'NYC Ferry primary return to Wall St/Pier 11',
      meta: 'Fallback: walk back if ferry timing is bad',
      color: '#376f9f',
    },
    {
      id: 'sat-step3',
      time: '4:30-ish',
      title: 'The Ten Bells',
      meta: 'Wine + small plates (walk-in)',
      color: '#8a5a3d',
    },
    {
      id: 'sat-step4',
      time: '6:00-ish',
      title: 'Hotel reset',
      meta: 'Return to Thompson Central Park New York',
      color: '#54758a',
    },
    {
      id: 'sat-step5',
      time: '8:40 arrival (9:00 show)',
      title: 'New York Comedy Club - Midtown',
      meta: 'Hard commitment',
      color: '#6d4d8f',
    },
    {
      id: 'sat-step6',
      time: '10:45 reservation',
      title: 'Frank',
      meta: 'Dinner after comedy',
      color: '#ad5d3b',
    },
  ],
  stops: [
    {
      id: 'sat-hotel',
      name: 'Thompson Central Park New York',
      time: 'Start / reset point',
      address: '119 W 56th St, New York, NY 10019',
      note: 'Base for the day.',
      markerColor: '#54758a',
      fallback: [40.7643285, -73.978572],
      stepIds: ['sat-step1', 'sat-step4', 'sat-step5'],
    },
    {
      id: 'sat-bridge',
      name: 'Brooklyn Bridge Manhattan Entrance (City Hall side)',
      time: '2:30-ish',
      address: 'Brooklyn Bridge Pedestrian Walkway Entrance near City Hall, New York, NY',
      note: 'Walk Manhattan to Brooklyn.',
      markerColor: '#2f6c59',
      fallback: [40.712628, -74.00528],
      stepIds: ['sat-step1', 'sat-step2'],
    },
    {
      id: 'sat-ferry',
      name: 'Pier 11 / Wall St',
      time: 'After crossing',
      address: '11 South St, New York, NY 10004',
      note: 'Ferry destination in Manhattan.',
      markerColor: '#376f9f',
      fallback: [40.703245, -74.005938],
      stepIds: ['sat-step2', 'sat-step3'],
    },
    {
      id: 'sat-tenbells',
      name: 'The Ten Bells',
      time: '4:30-ish',
      address: '247 Broome St, New York, NY 10002',
      note: 'Wine + small plates, walk-in.',
      markerColor: '#8a5a3d',
      fallback: [40.717761, -73.989307],
      stepIds: ['sat-step3', 'sat-step4'],
    },
    {
      id: 'sat-comedy',
      name: 'New York Comedy Club - Midtown',
      time: '8:40 arrival (9:00 show)',
      address: '241 E 24th St, New York, NY 10010',
      note: 'Hard commitment: arrive early.',
      markerColor: '#6d4d8f',
      fallback: [40.739145, -73.983551],
      stepIds: ['sat-step5', 'sat-step6'],
    },
    {
      id: 'sat-frank',
      name: 'Frank',
      time: '10:45 reservation',
      address: '88 2nd Ave, New York, NY 10003',
      note: 'Dinner after comedy.',
      markerColor: '#ad5d3b',
      fallback: [40.727595, -73.987719],
      stepIds: ['sat-step6'],
    },
  ],
  staticPoints: [
    {
      id: 'sat-dumbo-ferry',
      name: 'DUMBO/Fulton Ferry departure area',
      time: 'After crossing',
      address: 'DUMBO/Fulton Ferry Landing, Brooklyn, NY',
      note: 'Likely departure context. Check live ferry status.',
      markerColor: '#376f9f',
      coord: [40.703373, -73.995955],
      stepIds: ['sat-step2'],
    },
  ],
  parkWaypoints: [],
  routes: [
    {
      id: 'sat-route1',
      name: 'Transit: Hotel -> Brooklyn Bridge entrance',
      time: '2:30-ish',
      note: 'Subway-first or direct ride.',
      stepIds: ['sat-step1'],
      color: '#2f6c59',
      dashed: true,
      coords: [
        [40.7643285, -73.978572],
        [40.742, -73.996],
        [40.712628, -74.00528],
      ],
    },
    {
      id: 'sat-route2',
      name: 'Walk: Brooklyn Bridge Manhattan -> Brooklyn',
      time: '2:30-ish',
      note: 'Scenic crossing, exposed wind on span.',
      stepIds: ['sat-step1'],
      color: '#2f6c59',
      dashed: false,
      coords: [
        [40.712628, -74.00528],
        [40.70675, -74.00371],
        [40.70402, -73.99943],
        [40.703373, -73.995955],
      ],
    },
    {
      id: 'sat-route3',
      name: 'Ferry primary: DUMBO/Fulton Ferry -> Pier 11 / Wall St',
      time: 'After crossing',
      note: 'Primary return option; fallback is walking back.',
      stepIds: ['sat-step2'],
      color: '#376f9f',
      dashed: true,
      coords: [
        [40.703373, -73.995955],
        [40.702655, -74.001628],
        [40.703245, -74.005938],
      ],
    },
    {
      id: 'sat-route4',
      name: 'Transit/Walk: Pier 11 -> The Ten Bells',
      time: '4:00-4:30-ish',
      note: 'Lower Manhattan to LES transfer.',
      stepIds: ['sat-step3'],
      color: '#8a5a3d',
      dashed: true,
      coords: [
        [40.703245, -74.005938],
        [40.7139, -73.9972],
        [40.717761, -73.989307],
      ],
    },
    {
      id: 'sat-route5',
      name: 'Transit: The Ten Bells -> Hotel reset',
      time: '6:00-ish',
      note: 'Return uptown to reset.',
      stepIds: ['sat-step4'],
      color: '#54758a',
      dashed: true,
      coords: [
        [40.717761, -73.989307],
        [40.739, -73.987],
        [40.7643285, -73.978572],
      ],
    },
    {
      id: 'sat-route6',
      name: 'Transit: Hotel -> NYCC Midtown',
      time: '8:05-8:40',
      note: 'If running late, choose direct ride.',
      stepIds: ['sat-step5'],
      color: '#6d4d8f',
      dashed: true,
      coords: [
        [40.7643285, -73.978572],
        [40.748, -73.985],
        [40.739145, -73.983551],
      ],
    },
    {
      id: 'sat-route7',
      name: 'Comedy -> Frank',
      time: '10:30-10:45',
      note: 'Walk about 20-25 minutes or short ride.',
      stepIds: ['sat-step6'],
      color: '#ad5d3b',
      dashed: false,
      coords: [
        [40.739145, -73.983551],
        [40.7343, -73.9867],
        [40.727595, -73.987719],
      ],
    },
  ],
  zones: [],
};

const SATURDAY_ACTUALS_FALLBACK_ITINERARY = {
  weatherNote: 'Saturday actuals: Roosevelt Island tram, Midtown stops, comedy, and Frank dinner.',
  googleMapsUrl:
    'https://www.google.com/maps/dir/?api=1&origin=Thompson+Central+Park+New+York,+119+W+56th+St,+New+York,+NY+10019&destination=Frank,+88+2nd+Ave,+New+York,+NY+10003&waypoints=Roosevelt+Island+Tramway+Manhattan+Plaza,+E+59th+St+%26+2nd+Ave,+New+York,+NY|FAO+Schwarz,+30+Rockefeller+Plaza,+New+York,+NY+10112|Aldo+Sohm+Wine+Bar,+151+W+51st+St,+New+York,+NY+10019|Thompson+Central+Park+New+York,+119+W+56th+St,+New+York,+NY+10019|New+York+Comedy+Club+Midtown,+241+E+24th+St,+New+York,+NY+10010&travelmode=transit',
  steps: [
    { id: 'sat-act-step1', time: '14:45-16:15', title: 'Roosevelt Island via Tram', meta: 'Completed', color: '#3b7a57' },
    { id: 'sat-act-step2', time: '16:15-16:45', title: 'Jellycat stop (FAO Schwarz)', meta: 'Completed', color: '#8d6f46' },
    { id: 'sat-act-step3', time: '17:00-18:00', title: 'Aldo Sohm Wine Bar', meta: 'Completed', color: '#86543a' },
    { id: 'sat-act-step4', time: '18:30-20:15', title: 'Hotel reset', meta: 'Completed', color: '#54758a' },
    { id: 'sat-act-step5', time: '20:40-21:00', title: 'Arrive for show', meta: 'Completed', color: '#2f5d8a' },
    { id: 'sat-act-step6', time: '21:00-22:30', title: 'Comedy show', meta: 'Completed', color: '#6d4d8f' },
    { id: 'sat-act-step7', time: '22:45-23:59', title: 'Late dinner at Frank', meta: 'Completed', color: '#ad5d3b' },
  ],
  stops: [
    {
      id: 'sat-act-tram',
      name: 'Roosevelt Island Tramway (Manhattan Tramway Plaza)',
      time: '14:45',
      address: 'E 59th St & 2nd Ave, New York, NY 10022',
      note: 'Tram departure point.',
      markerColor: '#3b7a57',
      fallback: [40.761558, -73.964783],
      stepIds: ['sat-act-step1'],
    },
    {
      id: 'sat-act-ri',
      name: 'Roosevelt Island',
      time: '15:00-16:15',
      address: 'Roosevelt Island, New York, NY 10044',
      note: 'Promenade walk after tram.',
      markerColor: '#3b7a57',
      fallback: [40.761596, -73.949723],
      stepIds: ['sat-act-step1', 'sat-act-step2'],
    },
    {
      id: 'sat-act-fao',
      name: 'FAO Schwarz',
      time: '16:15-16:45',
      address: '30 Rockefeller Plaza, New York, NY 10112',
      note: 'Jellycat stop.',
      markerColor: '#8d6f46',
      fallback: [40.75874, -73.978674],
      stepIds: ['sat-act-step2', 'sat-act-step3'],
    },
    {
      id: 'sat-act-aldo',
      name: 'Aldo Sohm Wine Bar',
      time: '17:00-18:00',
      address: '151 W 51st St, New York, NY 10019',
      note: 'Selected Midtown wine bar.',
      markerColor: '#86543a',
      fallback: [40.761815, -73.981924],
      stepIds: ['sat-act-step3', 'sat-act-step4'],
    },
    {
      id: 'sat-act-hotel',
      name: 'Thompson Central Park New York',
      time: '18:30-20:15',
      address: '119 W 56th St, New York, NY 10019',
      note: 'Reset before evening commitments.',
      markerColor: '#54758a',
      fallback: [40.7643285, -73.978572],
      stepIds: ['sat-act-step4', 'sat-act-step5'],
    },
    {
      id: 'sat-act-nycc',
      name: 'New York Comedy Club - Midtown',
      time: '21:00-22:30',
      address: '241 E 24th St, New York, NY 10010',
      note: 'Comedy show.',
      markerColor: '#6d4d8f',
      fallback: [40.739145, -73.983551],
      stepIds: ['sat-act-step5', 'sat-act-step6', 'sat-act-step7'],
    },
    {
      id: 'sat-act-frank',
      name: 'Frank',
      time: '22:45-23:59',
      address: '88 2nd Ave, New York, NY 10003',
      note: 'Late dinner after show.',
      markerColor: '#ad5d3b',
      fallback: [40.727595, -73.987719],
      stepIds: ['sat-act-step7'],
    },
  ],
  staticPoints: [],
  parkWaypoints: [],
  routes: [],
  zones: [],
};

const FRIDAY_BASE_ITINERARY = applyPatchToConfig(DEFAULT_ITINERARY, FINALIZED_ITINERARY_PATCH);
const SATURDAY_BASE_ITINERARY = sanitizeConfig(SATURDAY_ACTUALS_FALLBACK_ITINERARY);
const FALLBACK_FIXED_DAY_CONFIGS = new Map([
  ['friday', FRIDAY_BASE_ITINERARY],
  ['saturday', SATURDAY_BASE_ITINERARY],
]);

let activeConfig = deepClone(FRIDAY_BASE_ITINERARY);
let activeRenderer = null;
let activeStepId = null;
let renderNonce = 0;
let activeDayId = null;
let activeDayPathGeoJSON = null;
let activeDayMeta = null;
let fridayPatch = null;
let runtimeTripData = null;
let fixedDayConfigById = new Map(FALLBACK_FIXED_DAY_CONFIGS);
let showFullDayPath = true;

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

function getStoredFullDayPathPreference() {
  try {
    const raw = localStorage.getItem(FULL_DAY_VIEW_STORAGE_KEY);
    if (raw === '0' || raw === 'false') return false;
    if (raw === '1' || raw === 'true') return true;
  } catch {
    // Ignore storage errors.
  }
  return true;
}

function storeFullDayPathPreference(enabled) {
  try {
    localStorage.setItem(FULL_DAY_VIEW_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore storage errors.
  }
}

function setEngineBadge(message) {
  const badge = document.getElementById('engine-badge');
  badge.textContent = message;
}

function setWeatherNote(message) {
  const weather = document.getElementById('weather-note');
  weather.textContent = message;
}

function getItineraryCompletionInfo(targetDate = ITINERARY_DATE) {
  const day = isIsoDay(targetDate) ? targetDate : ITINERARY_DATE;
  const itineraryEnd = new Date(`${day}T23:59:59`);
  const now = new Date();
  const completed = now.getTime() > itineraryEnd.getTime();

  const absoluteDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00`));

  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startItinerary = new Date(`${day}T00:00:00`);
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

function ensureTrailingSlash(value) {
  if (typeof value !== 'string' || !value.trim()) return '/';
  return value.endsWith('/') ? value : `${value}/`;
}

function isIsoDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function getRootDayHref(day) {
  return `${APP_BASE_URL}?day=${encodeURIComponent(day.id)}`;
}

function setPanelTitle(day) {
  const panelTitle = document.getElementById('panel-title');
  if (!panelTitle) return;

  if (!day) {
    panelTitle.textContent = 'NYC Day Itinerary';
    return;
  }

  const suffix = day.date ? `${day.title} (${day.date})` : day.title;
  panelTitle.textContent = `NYC Day Itinerary - ${suffix}`;
}

function buildUploadedDayConfig(day) {
  const title = day?.title || 'Uploaded Day';
  const date = day?.date ? ` (${day.date})` : '';

  return sanitizeConfig({
    weatherNote: `Uploaded day path${date}. Use this selector for your recorded route.`,
    googleMapsUrl: 'https://www.google.com/maps',
    steps: [
      {
        id: 'uploaded-step',
        time: day?.date || 'Any time',
        title: `${title} path`,
        meta: 'Phone-uploaded route overlay',
        color: UPLOADED_PATH_COLOR,
      },
    ],
    stops: [],
    staticPoints: [],
    parkWaypoints: [],
    routes: [],
    zones: [],
  });
}

function getFridayBaseConfig() {
  const fromRuntime = fixedDayConfigById.get('friday');
  return fromRuntime || FRIDAY_BASE_ITINERARY;
}

function getConfigForDay(dayId, dayMeta) {
  if (fixedDayConfigById.has(dayId)) {
    const base = fixedDayConfigById.get(dayId);
    if (dayId === 'friday') {
      return applyPatchToConfig(base, fridayPatch || buildDefaultPatchTemplate(base));
    }
    return deepClone(base);
  }
  if (dayId === 'friday') {
    const base = getFridayBaseConfig();
    return applyPatchToConfig(base, fridayPatch || buildDefaultPatchTemplate(base));
  }
  return buildUploadedDayConfig(dayMeta);
}

function syncEditorVisibility() {
  const editorPanel = document.querySelector('.editor-panel');
  if (!editorPanel) return;
  editorPanel.hidden = activeDayId !== 'friday';
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

    link.addEventListener('click', async (evt) => {
      evt.preventDefault();
      await selectDay(day.id);

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('day', day.id);
      window.history.replaceState({}, '', nextUrl.toString());
    });

    container.appendChild(link);
  }
}

async function refreshActiveDayPath() {
  if (!activeDayId || activeDayMeta?.kind === 'fixed') {
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

async function selectDay(dayId) {
  const days = listDays();
  const availableIds = new Set(days.map((day) => day.id));
  const resolvedDayId = availableIds.has(dayId) ? dayId : 'friday';

  activeDayId = setActiveDay(resolvedDayId);
  activeDayMeta = days.find((day) => day.id === activeDayId) || null;
  setPanelTitle(activeDayMeta);
  syncEditorVisibility();
  await refreshActiveDayPath();

  activeConfig = getConfigForDay(activeDayId, activeDayMeta);
  activeStepId = null;

  renderDayTabs();
  setDaySummaryStatus();
  await renderMap(activeConfig);
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

    await selectDay(saved.day.id);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('day', saved.day.id);
    window.history.replaceState({}, '', nextUrl.toString());
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

function wireViewModeUi() {
  const toggle = document.getElementById('show-full-day-toggle');
  const resetButton = document.getElementById('reset-view-mode-btn');
  syncViewModeUi();

  toggle?.addEventListener('change', () => {
    setFullDayPathMode(toggle.checked);
    if (showFullDayPath) {
      activeStepId = null;
      setActiveListItem(null);
      applyStepHighlightMode();
      setStatus('Full day path view enabled.');
      return;
    }
    setStatus('Step focus mode enabled. Click a time block to focus a segment.');
  });

  resetButton?.addEventListener('click', () => {
    setFullDayPathMode(true);
    activeStepId = null;
    setActiveListItem(null);
    applyStepHighlightMode();
    activeRenderer?.fitToData();
    setStatus('Reset to full day path view.');
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

  function getRouteStopCoords(route) {
    if (!route?.fromStopId || !route?.toStopId) return [];
    const from = getCoordById(stopsById, route.fromStopId);
    const to = getCoordById(stopsById, route.toStopId);
    if (!from || !to) return [];

    const vias = (Array.isArray(route.viaStopIds) ? route.viaStopIds : [])
      .map((stopId) => getCoordById(stopsById, stopId))
      .filter((coord) => Boolean(coord));

    return normalizeCoordList([from, ...vias, to]);
  }

  const routes = config.routes
    .filter((route) => !route.hidden)
    .map((route) => {
      const fallbackColor = getStepColor(config, route.stepIds?.[0], '#557083');
      const customCoords = normalizeCoordList(route.coords);
      const stopLinkCoords = getRouteStopCoords(route);
      const coords =
        customCoords.length >= 2
          ? customCoords
          : stopLinkCoords.length >= 2
            ? stopLinkCoords
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

  const styleNote = `
      <div class="legend-row">
        <span>Solid: on-foot. Dotted: transit/ride transfer (or uploaded path).</span>
      </div>
    `;

  legend.innerHTML = `<p class="legend-title">Itinerary Steps</p>${lines}${uploadedLine}${styleNote}`;
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

function syncViewModeUi() {
  const toggle = document.getElementById('show-full-day-toggle');
  if (toggle) toggle.checked = showFullDayPath;

  const label = document.getElementById('view-mode-label');
  if (!label) return;
  label.textContent = showFullDayPath ? 'Full day path shown' : 'Step focus mode';
}

function applyStepHighlightMode() {
  if (!activeRenderer) return;
  if (!activeStepId) {
    activeRenderer.setActiveStep(null);
    return;
  }
  activeRenderer.setActiveStep(activeStepId);
}

function setFullDayPathMode(enabled, persist = true) {
  showFullDayPath = Boolean(enabled);
  if (persist) {
    storeFullDayPathPreference(showFullDayPath);
  }
  syncViewModeUi();
  applyStepHighlightMode();
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

async function geocodeStop(stop) {
  const embeddedCoord = normalizeCoord(stop.coord);
  if (embeddedCoord) {
    return { coord: embeddedCoord, source: 'Provided coordinate' };
  }

  // Prefer local fallback points before network geocoding for faster loads.
  const fallback = normalizeCoord(stop.fallback);
  if (fallback) {
    return {
      coord: fallback,
      source: 'Fallback coordinate (Nominatim lookup, 2026-02-13)',
    };
  }

  if (stop.address) {
    const nominatimCoord = await geocodeWithNominatim(stop.address);
    if (nominatimCoord) {
      return { coord: nominatimCoord, source: 'Nominatim (OpenStreetMap)' };
    }
  }

  return null;
}

const nominatimCache = new Map();

async function geocodeWithNominatim(address) {
  const cacheKey = address.trim().toLowerCase();
  if (nominatimCache.has(cacheKey)) {
    return nominatimCache.get(cacheKey);
  }

  const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    address,
  )}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      nominatimCache.set(cacheKey, null);
      return null;
    }
    const json = await response.json();
    if (!Array.isArray(json) || json.length === 0) {
      nominatimCache.set(cacheKey, null);
      return null;
    }

    const coord = normalizeCoord([json[0].lat, json[0].lon]);
    nominatimCache.set(cacheKey, coord);
    return coord;
  } catch {
    nominatimCache.set(cacheKey, null);
    return null;
  }
}

async function createRenderer() {
  setEngineBadge('Map engine: Leaflet + OpenStreetMap');
  return new LeafletRenderer('map');
}

function setControlsDisabled(disabled) {
  document.getElementById('apply-updates-btn').disabled = disabled;
  document.getElementById('reset-updates-btn').disabled = disabled;
  document.getElementById('download-btn').disabled = disabled;
}

async function renderMap(config) {
  const nonce = ++renderNonce;
  const completionInfo = getItineraryCompletionInfo(activeDayMeta?.date || ITINERARY_DATE);
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
    const result = await geocodeStop(stop);
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
      if (activeStepId === stepId) {
        activeStepId = null;
        setFullDayPathMode(true, false);
        setActiveListItem(null);
        applyStepHighlightMode();
        setStatus('Full day path shown.');
        return;
      }

      activeStepId = stepId;
      setFullDayPathMode(false, false);
      setActiveListItem(stepId);
      applyStepHighlightMode();
    },
    completionInfo.completed,
  );

  activeStepId = null;
  setActiveListItem(null);
  setFullDayPathMode(true, false);
  applyStepHighlightMode();

  const sourceSummary = geocodedStops
    .map((stop) => `${stop.name}: ${stop.geocodeSource}`)
    .join(' | ');

  const uploadedSummary =
    uploadedPathRoutes.length > 0 ? ` | Uploaded path segments: ${uploadedPathRoutes.length}` : '';
  const sourceText = sourceSummary || 'none';
  setStatus(`Loaded. Geocode sources -> ${sourceText}${uploadedSummary}`);
  setControlsDisabled(false);
}

async function applyEditorPatch() {
  if (activeDayId !== 'friday') {
    setStatus('JSON editor currently applies to Friday. Switch to Friday to edit.');
    return;
  }

  try {
    const patch = readEditorPatch();
    const fridayBase = getFridayBaseConfig();
    fridayPatch = patch;
    activeConfig = applyPatchToConfig(fridayBase, fridayPatch);
    storePatch(patch);
    await renderMap(activeConfig);
    setStatus('Updates applied. Map redrawn from editor JSON.');
  } catch (error) {
    setStatus(`Update failed: ${error.message}`);
  }
}

async function resetEditorTemplate() {
  if (activeDayId !== 'friday') {
    setStatus('JSON editor currently applies to Friday. Switch to Friday to edit.');
    return;
  }

  const fridayBase = getFridayBaseConfig();
  const patch = buildDefaultPatchTemplate(fridayBase);
  setEditorPatch(patch);
  storePatch(patch);
  fridayPatch = patch;
  activeConfig = applyPatchToConfig(fridayBase, fridayPatch);
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
  wireViewModeUi();
}

function getFallbackFixedDays() {
  return [
    {
      id: 'friday',
      title: 'Friday',
      date: '2026-02-13',
      kind: 'fixed',
      href: '/?day=friday',
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
  ];
}

async function initializeTripFixedDays() {
  fixedDayConfigById = new Map(FALLBACK_FIXED_DAY_CONFIGS);

  try {
    runtimeTripData = await loadTripData();
    const fixedDays = getFixedDaysFromTrip(runtimeTripData);
    const runtimeConfigs = new Map();

    for (const fixedDay of fixedDays) {
      const tripDay = getDayById(runtimeTripData, fixedDay.id);
      const runtimeConfig = tripDay ? buildMapConfigFromDay(tripDay, runtimeTripData) : null;
      if (!runtimeConfig) continue;
      runtimeConfigs.set(fixedDay.id, sanitizeConfig(runtimeConfig));
    }

    fixedDayConfigById = new Map([...FALLBACK_FIXED_DAY_CONFIGS, ...runtimeConfigs]);
    const fixedTabs = fixedDays.filter((day) => fixedDayConfigById.has(day.id));
    setFixedDays(fixedTabs);
    return true;
  } catch (error) {
    runtimeTripData = null;
    fixedDayConfigById = new Map(FALLBACK_FIXED_DAY_CONFIGS);
    setFixedDays(getFallbackFixedDays());
    setDayHistoryStatus(`Trip JSON unavailable. Using fallback data: ${error.message}`);
    return false;
  }
}

async function init() {
  showFullDayPath = getStoredFullDayPathPreference();
  wireEvents();
  await initializeTripFixedDays();
  loadDayHistory();

  const storedPatch = getStoredPatch();
  const fridayBase = getFridayBaseConfig();
  fridayPatch = storedPatch || buildDefaultPatchTemplate(fridayBase);
  setEditorPatch(fridayPatch);

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

  await selectDay(activeDayId);
}

init().catch((error) => {
  setStatus(`Initialization failed: ${error.message}`);
  setControlsDisabled(false);
});
