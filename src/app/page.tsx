'use client';

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  getAllTrails,
  getAllWaypoints,
  saveTrail,
  saveWaypoint,
  deleteTrail,
  deleteWaypoint,
} from '@/lib/db';
import { Trail, Waypoint, BreadcrumbPoint, VehicleIncline } from '@/types/trail';
import { calculateTotalTrailDistance } from '@/lib/gpx';
import Inclinometer from '@/components/Inclinometer';
import TrailDrawer from '@/components/TrailDrawer';
import WaypointModal from '@/components/WaypointModal';
import {
  Play,
  Square,
  MapPin,
  FolderOpen,
  Gauge,
  Compass,
  AlertTriangle,
  Download,
} from 'lucide-react';

// Dynamic import for Leaflet map to prevent SSR window issues
const TrailMap = dynamic(() => import('@/components/TrailMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium">Loading Terrain Maps...</span>
    </div>
  ),
});

export default function Home() {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [activeTrailId, setActiveTrailId] = useState<string | null>(null);

  // GPS & Vehicle State
  const [currentPosition, setCurrentPosition] = useState<GeolocationCoordinates | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [incline, setIncline] = useState<VehicleIncline>({ pitch: 0, roll: 0 });

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPoints, setRecordedPoints] = useState<BreadcrumbPoint[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // UI Modals
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddingWaypointMode, setIsAddingWaypointMode] = useState(false);
  const [selectedCoordsForWaypoint, setSelectedCoordsForWaypoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Load IndexedDB items on start & register Service Worker
  useEffect(() => {
    async function initData() {
      const savedTrails = await getAllTrails();
      const savedWaypoints = await getAllWaypoints();
      setTrails(savedTrails);
      setWaypoints(savedWaypoints);
    }
    initData();

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }, []);

  // Geolocation Watcher
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPosition(pos.coords);
        if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading);
        }
        if (pos.coords.speed !== null && !isNaN(pos.coords.speed)) {
          setSpeedKmh(Math.max(0, Math.round(pos.coords.speed * 3.6)));
        }

        // If recording, log breadcrumb
        if (isRecording) {
          const newPoint: BreadcrumbPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            elevation: pos.coords.altitude,
            speed: pos.coords.speed,
            timestamp: Date.now(),
          };
          setRecordedPoints((prev) => [...prev, newPoint]);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isRecording]);

  // Device Orientation (Pitch & Roll sensor)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // beta: front-to-back tilt (-180 to 180) -> Pitch
      // gamma: left-to-right tilt (-90 to 90) -> Roll
      if (e.beta !== null && e.gamma !== null) {
        setIncline({
          pitch: Math.round(e.beta * 10) / 10,
          roll: Math.round(e.gamma * 10) / 10,
        });
      }
      if (e.alpha !== null && heading === null) {
        setHeading(e.alpha);
      }
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, [heading]);

  // Recording Timer
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Handle Recording Toggle
  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordedPoints([]);
    setRecordingStartTime(Date.now());
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    if (recordedPoints.length < 2) {
      alert('Trail too short to save. Drive or walk a further distance.');
      setRecordedPoints([]);
      return;
    }

    const name = prompt('Name this recorded trail:', `Trail ${new Date().toLocaleDateString()}`);
    if (!name) {
      setRecordedPoints([]);
      return;
    }

    const dist = calculateTotalTrailDistance(recordedPoints);
    const newTrail: Trail = {
      id: 'trail_' + Date.now(),
      name: name.trim(),
      points: [...recordedPoints],
      distanceKm: parseFloat(dist.toFixed(2)),
      durationSeconds: elapsedSeconds,
      difficulty: 'Moderate',
      createdAt: Date.now(),
      color: '#f97316',
    };

    await saveTrail(newTrail);
    setTrails((prev) => [newTrail, ...prev]);
    setRecordedPoints([]);
    setActiveTrailId(newTrail.id);
  };

  // Add Waypoint
  const handleSaveWaypoint = async (wpData: Omit<Waypoint, 'id' | 'createdAt'>) => {
    const wp: Waypoint = {
      ...wpData,
      id: 'wp_' + Date.now(),
      createdAt: Date.now(),
    };
    await saveWaypoint(wp);
    setWaypoints((prev) => [wp, ...prev]);
    setIsAddingWaypointMode(false);
    setSelectedCoordsForWaypoint(null);
  };

  const handleMapClickAddWaypoint = (coords: { lat: number; lng: number }) => {
    if (isAddingWaypointMode) {
      setSelectedCoordsForWaypoint(coords);
    }
  };

  const handleQuickAddCurrentLocationWaypoint = () => {
    if (!currentPosition) {
      alert('Waiting for GPS lock...');
      return;
    }
    setSelectedCoordsForWaypoint({
      lat: currentPosition.latitude,
      lng: currentPosition.longitude,
    });
  };

  const currentDistanceKm = calculateTotalTrailDistance(recordedPoints);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <main className="relative w-screen h-screen flex flex-col bg-slate-950 select-none overflow-hidden font-sans">
      {/* Top HUD */}
      <header className="absolute top-0 left-0 right-0 z-30 p-3 flex items-center justify-between pointer-events-none">
        {/* Brand & Speed */}
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-3 py-1.5 shadow-xl">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-500">
              TrailNav
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black font-mono text-white leading-tight">
                {speedKmh}
              </span>
              <span className="text-[10px] text-slate-400 font-mono uppercase">km/h</span>
            </div>
          </div>
          {currentPosition?.altitude != null && (
            <>
              <div className="h-6 w-px bg-slate-800 ml-2" />
              <div className="flex flex-col ml-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                  ELEV
                </span>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {Math.round(currentPosition.altitude)}m
                </span>
              </div>
            </>
          )}
        </div>

        {/* Pitch, Roll & Compass Gauges */}
        <div className="pointer-events-auto">
          <Inclinometer incline={incline} heading={heading} />
        </div>
      </header>

      {/* Main Map Viewport */}
      <div className="flex-1 w-full h-full relative">
        <TrailMap
          currentPosition={currentPosition}
          recordedPoints={recordedPoints}
          trails={trails}
          waypoints={waypoints}
          activeTrailId={activeTrailId}
          onMapClickAddWaypoint={handleMapClickAddWaypoint}
          isAddingWaypointMode={isAddingWaypointMode}
        />
      </div>

      {/* Recording Overlay Info Bar */}
      {isRecording && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 bg-red-950/80 border border-red-500/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-red-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>REC</span>
          </div>
          <div className="text-slate-200">
            TIME: <span className="text-white font-bold">{formatTimer(elapsedSeconds)}</span>
          </div>
          <div className="text-slate-200">
            DIST: <span className="text-white font-bold">{currentDistanceKm.toFixed(2)} km</span>
          </div>
          <div className="text-slate-200">
            PTS: <span className="text-white font-bold">{recordedPoints.length}</span>
          </div>
        </div>
      )}

      {/* Bottom Control Dock */}
      <footer className="absolute bottom-3 left-4 right-4 z-30 max-w-lg mx-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-2.5 shadow-2xl flex items-center justify-between">
        {/* Record / Stop Button */}
        {!isRecording ? (
          <button
            onClick={handleStartRecording}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold py-2.5 px-3 rounded-2xl shadow-lg shadow-orange-950/50 transition-all active:scale-95 text-xs tracking-wide"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Record Trail</span>
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-3 rounded-2xl shadow-lg shadow-red-950/50 transition-all active:scale-95 text-xs tracking-wide animate-pulse"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>Stop & Save</span>
          </button>
        )}

        {/* Quick Drop Waypoint */}
        <button
          onClick={handleQuickAddCurrentLocationWaypoint}
          className="mx-2 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2.5 px-3 rounded-2xl transition-all active:scale-95 text-xs font-medium"
          title="Drop waypoint at current position"
        >
          <MapPin className="w-4 h-4 text-orange-400" />
          <span className="hidden sm:inline">Waypoint</span>
        </button>

        {/* Tap Map Waypoint Mode Toggle */}
        <button
          onClick={() => setIsAddingWaypointMode((prev) => !prev)}
          className={`mr-2 p-2.5 rounded-2xl border transition-all active:scale-95 ${
            isAddingWaypointMode
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
          title="Tap on map to add waypoint"
        >
          <AlertTriangle className="w-4 h-4" />
        </button>

        {/* Library Drawer Toggle */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl transition-all active:scale-95 flex items-center justify-center relative"
          title="Open Trail Library"
        >
          <FolderOpen className="w-4 h-4 text-amber-400" />
          {trails.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center">
              {trails.length}
            </span>
          )}
        </button>
      </footer>

      {/* Modals & Drawers */}
      <TrailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        trails={trails}
        waypoints={waypoints}
        activeTrailId={activeTrailId}
        onSelectTrail={(id) => setActiveTrailId(id)}
        onDeleteTrail={async (id) => {
          await deleteTrail(id);
          setTrails((prev) => prev.filter((t) => t.id !== id));
          if (activeTrailId === id) setActiveTrailId(null);
        }}
        onImportTrail={async (newTrail) => {
          await saveTrail(newTrail);
          setTrails((prev) => [newTrail, ...prev]);
          setActiveTrailId(newTrail.id);
        }}
        onDeleteWaypoint={async (id) => {
          await deleteWaypoint(id);
          setWaypoints((prev) => prev.filter((w) => w.id !== id));
        }}
      />

      <WaypointModal
        isOpen={Boolean(selectedCoordsForWaypoint)}
        onClose={() => setSelectedCoordsForWaypoint(null)}
        coordinates={selectedCoordsForWaypoint}
        onSave={handleSaveWaypoint}
      />
    </main>
  );
}
