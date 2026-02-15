# Saturday Online Guide

## Open locally

Option 1:
1. Open `/Users/evanbarley-greenfield/Downloads/untitled folder/saturday/index.html` directly in a browser.

Option 2 (local server):
```bash
cd "/Users/evanbarley-greenfield/Downloads/untitled folder"
python3 -m http.server 8000
```
Then open `http://localhost:8000/saturday/`.

## Quick edits

1. Open `/Users/evanbarley-greenfield/Downloads/untitled folder/saturday/index.html`.
2. Edit stop content in the `Stops` card block (name, address, time, notes).
3. Edit transport language in `Transit by major leg`.
4. Update the consolidated route URL in the `Consolidated map` section (anchor with `id="all-stops-link"`).
5. Day tabs/upload UI is near the top (`id="day-tabs"` and `id="upload-day-path-btn"`). Uploaded days link back to `/?day=<dayId>` on the root map page.

## iPhone upload notes

1. Export your track to Files as `GPX`, `KML`, or `GeoJSON`.
2. Open `/saturday/` on iPhone Safari.
3. Tap `Upload Day Path` and choose the file from Files/iCloud Drive.
4. Enter day date + tab label when prompted.
5. Tap the uploaded day tab or `View on map` to jump to `/?day=<dayId>`.

Storage is local-only (`localStorage` + `IndexedDB`) and can be cleared by browser/site data reset.

## Sources

- NYC Ferry routes and landing names:
  - [NYC Ferry East River](https://www.ferry.nyc/routes-and-schedules/route/east-river/)
  - [NYC Ferry South Brooklyn](https://www.ferry.nyc/routes-and-schedules/route/south-brooklyn/)
- NYC Ferry app/live status guidance:
  - [NYC Ferry System Map / App links](https://www.ferry.nyc/nycferry-goes-mobile/)
- New York Comedy Club locations:
  - [NY Comedy Club Locations](https://newyorkcomedyclub.com/pages/locations)
- The Ten Bells address:
  - [The Ten Bells](https://www.tenbellsnyc.com/)
- Frank address:
  - [Frank Restaurant](https://frankrestaurant.com/)
