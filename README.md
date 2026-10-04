# Off-Road Trail Navigator (PWA)

A Progressive Web App designed for overlanding, rock crawling, and off-road GPS navigation with offline capabilities.

## Key Features

1. **PWA & Offline Ready**:
   - Web App Manifest configured for full-screen standalone installation on iOS and Android.
   - Service worker caching map tiles (`trailnav-tiles-v1`) and application shell.
   - Client-side IndexedDB persistence for all recorded trails and waypoints.

2. **Off-Road Navigation & Mapping**:
   - Interactive Leaflet topographic and satellite map tiles (OpenTopoMap, OpenStreetMap, Esri Satellite).
   - Real-time GPS location tracking with speed (km/h) and altitude HUD.
   - Vehicle heading compass.

3. **Vehicle Dynamics & Safety**:
   - Integrated Inclinometer (Pitch & Roll sensor) utilizing device gyroscope/orientation.
   - Warning thresholds (warning and critical danger highlights) for off-camber lines and steep inclines.

4. **Trail Recording & Breadcrumbs**:
   - Live breadcrumb tracking with point-to-point Haversine distance calculations.
   - Trail recording timer, point count, and summary metrics.

5. **Waypoints & Obstacles**:
   - Mark points of interest: *Obstacle / Rock Crawl*, *Hazard*, *Campsite*, *Water Crossing*, *Fuel / Staging Area*, *Scenic Viewpoint*.
   - Tap-on-map placement mode or quick-drop at current GPS coordinates.
   - Line notes & driving advice storage.

6. **GPX Import & Export**:
   - Import standard GPX files from Gaia GPS, OnX Offroad, Garmin, or AllTrails.
   - Export your custom recorded trails to `.gpx` for backup or sharing.

## Getting Started

```bash
cd off-road-trail-navigator
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) on your mobile browser or desktop. Tap **Add to Home Screen** on your phone for full-screen PWA mode.
