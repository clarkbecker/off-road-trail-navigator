'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Polyline as LeafletPolyline, Marker as LeafletMarker, TileLayer } from 'leaflet';
import { AlertTriangle, Crosshair, Layers, Camera } from 'lucide-react';
import { Trail, Waypoint, BreadcrumbPoint, HazardReport, TransportMode } from '@/types/trail';
import MapLegend from '@/components/MapLegend';

interface TrailMapProps {
  currentPosition: GeolocationCoordinates | null;
  recordedPoints: BreadcrumbPoint[];
  trails: Trail[];
  waypoints: Waypoint[];
  hazards?: HazardReport[];
  transportMode?: TransportMode;
  activeTrailId: string | null;
  onSelectTrail?: (trailId: string | null) => void;
  onSelectWaypoint?: (wp: Waypoint) => void;
  onSelectHazard?: (hazard: HazardReport) => void;
  onMapClickAddWaypoint?: (coords: { lat: number; lng: number }) => void;
  isAddingWaypointMode?: boolean;
  onReportHazard?: () => void;
  onQuickCamera?: () => void;
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
  hazards = [],
  transportMode = 'utv',
  activeTrailId,
  onSelectTrail,
  onSelectWaypoint,
  onSelectHazard,
  onMapClickAddWaypoint,
  isAddingWaypointMode = false,
  onReportHazard,
  onQuickCamera,
}: TrailMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const isInitializingRef = useRef(false);
  const userMarkerRef = useRef<LeafletMarker | null>(null);
  const recordingPolylineRef = useRef<LeafletPolyline | null>(null);
  const trailsGroupRef = useRef<any>(null);
  const waypointsGroupRef = useRef<any>(null);
  const hazardsGroupRef = useRef<any>(null);
  const currentTileLayerRef = useRef<TileLayer | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);

  // Initialize Map
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      if (mapInstanceRef.current || isInitializingRef.current) return;
      isInitializingRef.current = true;

      try {
        const L = (await import('leaflet')).default;
        if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) {
          isInitializingRef.current = false;
          return;
        }

        const container = mapContainerRef.current as any;
        if (container._leaflet_id) {
          container._leaflet_id = null;
        }

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

        const map = L.map(container, {
          center: [initialLat, initialLng],
          zoom: initialZoom,
          zoomControl: false,
        });

        if (!isMounted) {
          map.remove();
          return;
        }

        mapInstanceRef.current = map;

        const baseTile = L.tileLayer(MAP_LAYERS[0].url, {
          attribution: MAP_LAYERS[0].attribution,
          maxZoom: MAP_LAYERS[0].maxZoom,
          tileSize: MAP_LAYERS[0].tileSize,
          zoomOffset: MAP_LAYERS[0].zoomOffset,
        }).addTo(map);

        currentTileLayerRef.current = baseTile;
        trailsGroupRef.current = L.layerGroup().addTo(map);
        waypointsGroupRef.current = L.layerGroup().addTo(map);
        hazardsGroupRef.current = L.layerGroup().addTo(map);

        // Active recording line with mode-based initial styling
        const initialTrackColor =
          transportMode === 'utv' ? '#c084fc' : transportMode === 'mtb' ? '#06b6d4' : '#10b981';

        recordingPolylineRef.current = L.polyline([], {
          color: initialTrackColor,
          weight: 6,
          opacity: 0.95,
          dashArray: transportMode === 'utv' ? '6, 8' : undefined,
        }).addTo(map);

        // Map click handler for dropping waypoint
        map.on('click', (e) => {
          if (onMapClickAddWaypoint) {
            onMapClickAddWaypoint({ lat: e.latlng.lat, lng: e.latlng.lng });
          }
        });

        if (isMounted) {
          setIsMapReady(true);
        }
      } catch (err) {
        console.error('Leaflet initialization error:', err);
      } finally {
        isInitializingRef.current = false;
      }
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
        (mapContainerRef.current as any)._leaflet_id = null;
      }
      userMarkerRef.current = null;
      recordingPolylineRef.current = null;
      trailsGroupRef.current = null;
      waypointsGroupRef.current = null;
      hazardsGroupRef.current = null;
      currentTileLayerRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  // Switch Layer
  useEffect(() => {
    async function updateTile() {
      if (!mapInstanceRef.current || !isMapReady) return;
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
  }, [activeLayerIndex, isMapReady]);

  // Update User GPS Marker
  useEffect(() => {
    async function updateUserMarker() {
      if (!mapInstanceRef.current || !currentPosition || !isMapReady) return;
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
  }, [currentPosition, hasCenteredOnce, isMapReady]);

  // Update Recorded Breadcrumb Line & Styling
  useEffect(() => {
    if (!recordingPolylineRef.current) return;
    const latlngs: [number, number][] = recordedPoints.map((p) => [p.lat, p.lng]);
    recordingPolylineRef.current.setLatLngs(latlngs);

    const trackColor =
      transportMode === 'utv' ? '#c084fc' : transportMode === 'mtb' ? '#06b6d4' : '#10b981';
    recordingPolylineRef.current.setStyle({
      color: trackColor,
      dashArray: transportMode === 'utv' ? '6, 8' : undefined,
    });
  }, [recordedPoints, transportMode]);

  // Render Saved Trails
  useEffect(() => {
    async function updateTrails() {
      if (!trailsGroupRef.current || !isMapReady) return;
      const L = (await import('leaflet')).default;
      trailsGroupRef.current.clearLayers();

      trails.forEach((trail) => {
        const coords: [number, number][] = trail.points.map((p) => [p.lat, p.lng]);
        const isActive = trail.id === activeTrailId;
        const isClosed = trail.officialStatus === 'closed';
        const isRoadRoute = trail.routeType === 'road_route' || trail.routeType === 'street_legal_city';

        // Dynamic styling:
        // Closed -> Red dashed
        // Road Route -> Amber dashed
        // Bike/MTB -> Emerald green
        // Hike -> Sky blue
        // UTV/4x4 -> Vibrant orange
        let color = trail.color || '#f97316';
        let dashArray: string | undefined = undefined;

        if (isClosed) {
          color = '#ef4444';
          dashArray = '8, 8';
        } else if (isRoadRoute) {
          color = '#f59e0b';
          dashArray = '6, 6';
        } else if (trail.costMtb != null && trail.costMtb <= 0.5 && (!trail.costUtv || trail.costUtv > 0.6)) {
          color = '#10b981';
        } else if (trail.costHike != null && trail.costHike <= 0.5 && (!trail.costUtv || trail.costUtv > 0.8)) {
          color = '#0ea5e9';
        } else {
          color = '#f97316';
        }

        if (isActive) {
          color = '#38bdf8';
        }

        const line = L.polyline(coords, {
          color,
          weight: isActive ? 6 : isRoadRoute ? 3.5 : 4.5,
          opacity: isActive ? 1 : isClosed ? 0.95 : 0.85,
          dashArray,
        });

        const statusBadge = isClosed ? '🔴 CLOSED' : trail.officialStatus === 'caution' ? '⚠️ CAUTION' : '🟢 OPEN';
        const typeBadge = isRoadRoute ? '🛣️ ATV Road Route' : '🌲 Off-Road Trail';
        const jurisdictionBadge = trail.jurisdictionName ? `<br/><span style="color:#94a3b8; font-size:11px;">Authority: ${trail.jurisdictionName}</span>` : '';
        const conditionBadge = trail.statusHeadline ? `<br/><span style="color:${isClosed ? '#f87171' : '#fbbf24'}; font-size:11px; font-weight:600;">${trail.statusHeadline}</span>` : '';
        const allowedVehicles = [
          trail.allowedUtv ? 'UTV' : null,
          trail.allowedAtv ? 'ATV' : null,
          trail.allowedDirtbike ? 'Dirt Bike' : null,
          trail.allowed4x4 ? '4x4' : null,
          trail.allowedMtb ? 'MTB' : null,
          trail.allowedHiking ? 'Hike' : null,
        ].filter(Boolean).join(' • ');

        line.bindTooltip(
          `<div style="font-family:system-ui,-apple-system,sans-serif; min-width:160px;">
            <div style="font-weight:700; font-size:13px; color:#f8fafc;">${trail.name}</div>
            <div style="font-size:11px; margin-top:2px;">${statusBadge} • ${typeBadge}</div>
            ${conditionBadge}
            ${jurisdictionBadge}
            <div style="font-size:10px; color:#cbd5e1; margin-top:3px;">Allowed: ${allowedVehicles || 'Multi-Use'}</div>
            <div style="font-size:10px; color:#94a3b8;">${trail.distanceKm} km • ${trail.difficulty}</div>
          </div>`,
          { sticky: true }
        );

        if (onSelectTrail) {
          line.on('click', () => {
            onSelectTrail(isActive ? null : trail.id);
          });
        }

        line.addTo(trailsGroupRef.current);
      });
    }
    updateTrails();
  }, [trails, activeTrailId, isMapReady, transportMode, onSelectTrail]);

  // Auto-zoom and frame map around active trail whenever selected
  useEffect(() => {
    if (!mapInstanceRef.current || !activeTrailId || !isMapReady) return;
    const activeTrail = trails.find((t) => t.id === activeTrailId);
    if (activeTrail && activeTrail.points && activeTrail.points.length > 0) {
      const coords: [number, number][] = activeTrail.points.map((p) => [p.lat, p.lng]);
      try {
        mapInstanceRef.current.fitBounds(coords, {
          padding: [60, 60],
          maxZoom: 15,
          animate: true,
        });
      } catch (err) {
        console.warn('Could not fit bounds to active trail:', err);
      }
    }
  }, [activeTrailId, trails, isMapReady]);

  // Render Waypoints
  useEffect(() => {
    async function updateWaypoints() {
      if (!waypointsGroupRef.current || !isMapReady) return;
      const L = (await import('leaflet')).default;
      waypointsGroupRef.current.clearLayers();

      waypoints.forEach((wp) => {
        const isScenic = wp.category === 'scenic';
        const hasMedia = Boolean(wp.mediaUrl);

        const marker = L.circleMarker([wp.lat, wp.lng], {
          radius: hasMedia ? 9 : 8,
          fillColor:
            wp.category === 'hazard'
              ? '#ef4444'
              : wp.category === 'campsite'
              ? '#10b981'
              : isScenic
              ? '#06b6d4'
              : '#f59e0b',
          color: hasMedia ? '#38bdf8' : '#ffffff',
          weight: hasMedia ? 3 : 2,
          opacity: 1,
          fillOpacity: 0.92,
        });

        const mediaHtml = wp.mediaUrl
          ? wp.mediaType === 'video'
            ? `<div style="margin-top:6px;"><video src="${wp.mediaUrl}" controls style="max-width:200px; border-radius:8px; display:block;" /></div>`
            : `<div style="margin-top:6px;"><img src="${wp.mediaUrl}" alt="${wp.name}" style="max-width:200px; max-height:140px; object-fit:cover; border-radius:8px; display:block;" /></div>`
          : '';

        const popupContent = `
          <div style="font-family:system-ui,-apple-system,sans-serif; min-width:140px; color:#0f172a;">
            <div style="font-weight:700; font-size:13px;">${wp.name}</div>
            <div style="font-size:11px; color:#64748b; text-transform:capitalize;">${wp.category}${wp.mediaType ? ` • 📷 ${wp.mediaType}` : ''}</div>
            ${wp.notes ? `<div style="font-size:12px; margin-top:4px; color:#334155;">${wp.notes}</div>` : ''}
            ${mediaHtml}
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.bindTooltip(`<b>${wp.name}</b> (${wp.category})${hasMedia ? ' 📷' : ''}`);
        marker.on('click', () => {
          if (onSelectWaypoint) onSelectWaypoint(wp);
        });

        marker.addTo(waypointsGroupRef.current);
      });
    }
    updateWaypoints();
  }, [waypoints, onSelectWaypoint, isMapReady]);

  // Render Hazard Alerts (V7 Spec)
  useEffect(() => {
    async function updateHazards() {
      if (!hazardsGroupRef.current || !isMapReady) return;
      const L = (await import('leaflet')).default;
      hazardsGroupRef.current.clearLayers();

      hazards.forEach((hazard) => {
        if (!hazard.active) return;

        const hazardColor =
          hazard.hazardType === 'trail_impassable'
            ? '#ef4444'
            : hazard.hazardType === 'washout_rut'
            ? '#f59e0b'
            : '#f97316';

        const marker = L.circleMarker([hazard.lat, hazard.lng], {
          radius: 10,
          fillColor: hazardColor,
          color: '#ffffff',
          weight: 2.5,
          opacity: 1,
          fillOpacity: 0.95,
        });

        marker.bindTooltip(`⚠️ <b>${hazard.title}</b><br/>${hazard.description || 'Hazard alert'}`);
        marker.on('click', () => {
          if (onSelectHazard) onSelectHazard(hazard);
        });

        marker.addTo(hazardsGroupRef.current);
      });
    }
    updateHazards();
  }, [hazards, onSelectHazard, isMapReady]);

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

      {/* Floating Action Buttons Column (Right Side - Unified Stack: Layers, Recenter, Hazard) */}
      <div className="absolute right-3 sm:right-4 bottom-28 sm:bottom-30 z-30 flex flex-col items-center gap-2.5">
        {/* Layer Selector */}
        <button
          onClick={() => setActiveLayerIndex((prev) => (prev + 1) % MAP_LAYERS.length)}
          className="w-12 h-12 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-xl hover:bg-slate-800 text-slate-200 transition-all active:scale-95 flex items-center justify-center"
          title={`Layer: ${MAP_LAYERS[activeLayerIndex].name}`}
        >
          <Layers className="w-5 h-5 text-orange-400" />
        </button>

        {/* Center GPS */}
        <button
          onClick={handleCenterOnUser}
          className="w-12 h-12 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-xl hover:bg-slate-800 text-slate-200 transition-all active:scale-95 flex items-center justify-center"
          title="Recenter on vehicle"
        >
          <Crosshair className="w-5 h-5 text-emerald-400" />
        </button>

        {/* Quick Camera Shutter FAB (Tablet Rear Camera) */}
        {onQuickCamera && (
          <button
            onClick={onQuickCamera}
            className="w-12 h-12 bg-slate-900/90 backdrop-blur-md border border-cyan-500/50 rounded-2xl shadow-xl hover:bg-slate-800 text-slate-200 transition-all active:scale-95 flex items-center justify-center group"
            title="Quick Photo / Video (Rear Camera)"
          >
            <Camera className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
          </button>
        )}

        {/* Oversized Glove-Friendly "Report Hazard" FAB (Min 60x60px - Master Spec V7) */}
        {onReportHazard && (
          <button
            onClick={onReportHazard}
            className="w-16 h-16 sm:w-18 sm:h-18 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-full shadow-2xl shadow-rose-950/70 border-2 border-rose-400/80 flex flex-col items-center justify-center gap-0.5 transition-all select-none mt-1"
            title="Report Trail Hazard"
          >
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            <span className="text-[9px] font-extrabold uppercase tracking-tight">Hazard</span>
          </button>
        )}
      </div>

      {/* Map Legend Overlay Button (Upper Left, below HUD) */}
      <div className="absolute left-3 sm:left-4 top-28 sm:top-24 z-20">
        <MapLegend />
      </div>

      {/* Layer tag pill */}
      <div className="absolute left-3 sm:left-4 bottom-28 sm:bottom-30 z-20 bg-slate-900/80 backdrop-blur border border-slate-800 px-3 py-1 rounded-full text-[11px] text-slate-400 font-medium pointer-events-none shadow-lg">
        Layer: <span className="text-orange-400">{MAP_LAYERS[activeLayerIndex].name}</span>
      </div>
    </div>
  );
}
