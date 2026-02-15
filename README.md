# NYC Itinerary Interactive Map

Single-page map app for today's NYC itinerary with:
- Geocoded fixed stops (hotel, EJ's, Frick, Ci Siamo)
- Color-coded itinerary routes
- Scenic Central Park interior path annotations
- High Line and drinks flexible zones
- Click-to-highlight itinerary steps
- PNG export of current map view
- Shared day tabs across `/` and `/saturday/`
- iPhone day-path upload (`GPX`, `KML`, `GeoJSON`) with local-only persistence
- Single-page day selectors on `/` (Friday, Saturday, uploaded days)

## Run

```bash
npm install
npm start
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Favicon

Global EBG favicon files are included at project root and in `public/`:
- `favicon.ico`
- `favicon.svg`

HTML head snippet used:

```html
<link rel="icon" type="image/x-icon" href="./favicon.ico" />
<link rel="icon" type="image/svg+xml" sizes="any" href="./favicon.svg" />
<link rel="shortcut icon" href="./favicon.ico" />
```

## Export PNG

1. Pan/zoom to your preferred view.
2. Click `Download Map (PNG)` in the left panel.
3. The app saves `nyc-itinerary-map-YYYY-MM-DD.png`.

## One-Tap Directions

Use `Open in Google Maps` in the left panel to launch the full multi-stop route.

## Day Tabs + iPhone Path Upload

- Top tabs always include fixed `Friday` and `Saturday`, plus any uploaded days.
- Upload from iPhone Files using `Upload Day Path` (`.gpx`, `.kml`, `.geojson`, `.json`).
- Uploaded path geometry is stored locally on your device/browser:
  - metadata/order/active day in `localStorage` key `nyc_day_history_meta_v1`
  - path geometry in IndexedDB `nyc_day_history_paths_v1`
- Open an uploaded day directly on map with `/?day=<dayId>`.
- If site data is cleared in Safari/browser settings, uploaded day history is removed.

## Validate

```bash
npm run lint
npm test
npm run build
```

## Coordinate sources

- Primary: runtime geocoding via Nominatim (OpenStreetMap)
- Fallback coordinates in code are from Nominatim lookups on 2026-02-13.
