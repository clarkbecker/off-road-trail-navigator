'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Polyline as LeafletPolyline, Marker as LeafletMarker, TileLayer } from 'leaflet';
import { Crosshair, Layers } from 'lucide-react';
import { Trail, Waypoint, BreadcrumbPoint } from '@/types/trail';

interface TrailMapProps {
  currentPosition: GeolocationCoordinates | null;
  recordedPoints: BreadcrumbPoint[];
  trails: Trail[];
  waypoints: Waypoint[];
  activeTrailId: string | null;
  onSelectWaypoint?: (wp: Waypoint) => void;
  onMapClickAddWaypoint?: (coords: { lat: number; lng: number }) => void;
  isAddingWaypointMode?: boolean;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const MAP_LAYERS = [
  ...(MAPBOX_TOKEN
    ? [
        {
          name: 'Mapbox Outdoors (HD)',
          url: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
          attribution: '© Mapbox © OpenStreetMap',
          maxZoom: 22,
          tileSize: 512,
          zoomOffset: -1,
        },
        {
          name: 'Mapbox Satellite Streets (HD)',
          url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
          attribution: '© Mapbox © Maxar',
          maxZoom: 22,
          tileSize: 512,
          zoomOffset: -1,
        },
      ]
    : []),
  {
    name: 'Topo / Outdoors (OpenTopoMap)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap contributors',
    maxZoom: 17,
    tileSize: 256,
    zoomOffset: 0,
  },
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    tileSize: 256,
    zoomOffset: 0,
  },
  {
    name: 'Satellite / Imagery (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
    tileSize: 256,
    zoomOffset: 0,
  },
];

export default function TrailMap({
  currentPosition,
  recordedPoints,
  trails,
  waypoints,
  activeTrailId,
  onSelectWaypoint,
  onMapClickAddWaypoint,
  isAddingWaypointMode = false,
}: TrailMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const userMarkerRef = useRef<LeafletMarker | null>(null);
  const recordingPolylineRef = useRef<LeafletPolyline | null>(null);
  const trailsGroupRef = useRef<any>(null);
  const waypointsGroupRef = useRef<any>(null);
  const currentTileLayerRef = useRef<TileLayer | null>(null);

  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);

  // Initialize Map
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;

      // Fix default Leaflet icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const initialLat = currentPosition?.latitude || 37.7749;
      const initialLng = currentPosition?.longitude || -122.4194;
      const initialZoom = currentPosition ? 14 : 11;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: false,
      });

      const baseTile = L.tileLayer(MAP_LAYERS[0].url, {
        attribution: MAP_LAYERS[0].attribution,
        maxZoom: MAP_LAYERS[0].maxZoom,
        tileSize: MAP_LAYERS[0].tileSize,
        zoomOffset: MAP_LAYERS[0].zoomOffset,
      }).addTo(map);

      currentTileLayerRef.current = baseTile;
      trailsGroupRef.current = L.layerGroup().addTo(map);
      waypointsGroupRef.current = L.layerGroup().addTo(map);

      // Active recording line
      recordingPolylineRef.current = L.polyline([], {
        color: '#ef4444',
        weight: 5,
        opacity: 0.9,
        dashArray: '4, 8',
      }).addTo(map);

      // Map click handler for dropping waypoint
      map.on('click', (e) => {
        if (onMapClickAddWaypoint) {
          onMapClickAddWaypoint({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      mapInstanceRef.current = map;
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Switch Layer
  useEffect(() => {
    async function updateTile() {
      if (!mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;
      if (currentTileLayerRef.current) {
        mapInstanceRef.current.removeLayer(currentTileLayerRef.current);
      }
      const selected = MAP_LAYERS[activeLayerIndex];
      const newLayer = L.tileLayer(selected.url, {
        attribution: selected.attribution,
        maxZoom: selected.maxZoom,
        tileSize: selected.tileSize,
        zoomOffset: selected.zoomOffset,
      }).addTo(mapInstanceRef.current);
      currentTileLayerRef.current = newLayer;
    }
    updateTile();
  }, [activeLayerIndex]);

  // Update User GPS Marker
  useEffect(() => {
    async function updateUserMarker() {
      if (!mapInstanceRef.current || !currentPosition) return;
      const L = (await import('leaflet')).default;

      const pos: [number, number] = [currentPosition.latitude, currentPosition.longitude];

      if (!userMarkerRef.current) {
        const vehicleIcon = L.divIcon({
          className: 'custom-vehicle-marker',
          html: `
            <div class="relative flex items-center justify-center w-8 h-8">
              <span class="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-ping"></span>
              <div class="relative flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 border-2 border-white shadow-lg text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        userMarkerRef.current = L.marker(pos, { icon: vehicleIcon }).addTo(mapInstanceRef.current);
      } else {
        userMarkerRef.current.setLatLng(pos);
      }

      if (!hasCenteredOnce) {
        mapInstanceRef.current.setView(pos, 15);
        setHasCenteredOnce(true);
      }
    }
    updateUserMarker();
  }, [currentPosition, hasCenteredOnce]);

  // Update Recorded Breadcrumb Line
  useEffect(() => {
    if (!recordingPolylineRef.current) return;
    const latlngs: [number, number][] = recordedPoints.map((p) => [p.lat, p.lng]);
    recordingPolylineRef.current.setLatLngs(latlngs);
  }, [recordedPoints]);

  // Render Saved Trails
  useEffect(() => {
    async function updateTrails() {
      if (!trailsGroupRef.current) return;
      const L = (await import('leaflet')).default;
      trailsGroupRef.current.clearLayers();

      trails.forEach((trail) => {
        const coords: [number, number][] = trail.points.map((p) => [p.lat, p.lng]);
        const isActive = trail.id === activeTrailId;
        const line = L.polyline(coords, {
          color: isActive ? '#38bdf8' : trail.color || '#f97316',
          weight: isActive ? 6 : 4,
          opacity: isActive ? 1 : 0.8,
        });

        line.bindTooltip(`<b>${trail.name}</b><br/>${trail.distanceKm} km • ${trail.difficulty}`, {
          sticky: true,
        });

        line.addTo(trailsGroupRef.current);
      });
    }
    updateTrails();
  }, [trails, activeTrailId]);

  // Render Waypoints
  useEffect(() => {
    async function updateWaypoints() {
      if (!waypointsGroupRef.current) return;
      const L = (await import('leaflet')).default;
      waypointsGroupRef.current.clearLayers();

      waypoints.forEach((wp) => {
        const marker = L.circleMarker([wp.lat, wp.lng], {
          radius: 8,
          fillColor: wp.category === 'hazard' ? '#ef4444' : wp.category === 'campsite' ? '#10b981' : '#f59e0b',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        });

        marker.bindTooltip(`<b>${wp.name}</b> (${wp.category})`);
        marker.on('click', () => {
          if (onSelectWaypoint) onSelectWaypoint(wp);
        });

        marker.addTo(waypointsGroupRef.current);
      });
    }
    updateWaypoints();
  }, [waypoints, onSelectWaypoint]);

  const handleCenterOnUser = () => {
    if (mapInstanceRef.current && currentPosition) {
      mapInstanceRef.current.setView([currentPosition.latitude, currentPosition.longitude], 16);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Adding Waypoint Overlay Banner */}
      {isAddingWaypointMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-500/90 text-slate-950 font-semibold px-4 py-1.5 rounded-full shadow-lg border border-amber-300 text-xs flex items-center gap-2 animate-pulse">
          <span>Tap anywhere on the map to place a waypoint</span>
        </div>
      )}

      {/* Map Control Floating Buttons */}
      <div className="absolute right-4 bottom-24 z-20 flex flex-col gap-2">
        {/* Layer Selector */}
        <button
          onClick={() => setActiveLayerIndex((prev) => (prev + 1) % MAP_LAYERS.length)}
          className="p-3 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-2xl shadow-xl hover:bg-slate-800 text-slate-200 transition-all active:scale-95 flex items-center justify-center"
          title={`Layer: ${MAP_LAYERS[activeLayerIndex].name}`}
        >
          <Layers className="w-5 h-5 text-orange-400" />
        </button>

        {/* Center GPS */}
        <button
          onClick={handleCenterOnUser}
          className="p-3 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-2xl shadow-xl hover:bg-slate-800 text-slate-200 transition-all active:scale-95 flex items-center justify-center"
          title="Recenter on vehicle"
        >
          <Crosshair className="w-5 h-5 text-emerald-400" />
        </button>
      </div>

      {/* Layer tag pill */}
      <div className="absolute left-4 bottom-24 z-20 bg-slate-900/80 backdrop-blur border border-slate-800 px-3 py-1 rounded-full text-[11px] text-slate-400 font-medium">
        Layer: <span className="text-orange-400">{MAP_LAYERS[activeLayerIndex].name}</span>
      </div>
    </div>
  );
}
