# NYC Itinerary Interactive Map

Single-page map app for today's NYC itinerary with:
- Geocoded fixed stops (hotel, EJ's, Frick, Ci Siamo)
- Color-coded itinerary routes
- Scenic Central Park interior path annotations
- High Line and drinks flexible zones
- Click-to-highlight itinerary steps
- PNG export of current map view

## Run

```bash
npm install
npm start
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Optional Mapbox

Mapbox GL JS is used when `MAPBOX_TOKEN` is set; otherwise the app falls back to Leaflet + OpenStreetMap tiles.

```bash
export MAPBOX_TOKEN=your_token_here
npm start
```

If Mapbox fails to initialize, the app automatically falls back to Leaflet.

## Export PNG

1. Pan/zoom to your preferred view.
2. Click `Download Map (PNG)` in the left panel.
3. The app saves `nyc-itinerary-map-YYYY-MM-DD.png`.

## One-Tap Directions

Use `Open in Google Maps` in the left panel to launch the full multi-stop route.

## Validate

```bash
npm run lint
npm test
npm run build
```

## Coordinate sources

- Primary: runtime geocoding via Mapbox Geocoding API (if token present) or Nominatim (OpenStreetMap)
- Fallback coordinates in code are from Nominatim lookups on 2026-02-13.
