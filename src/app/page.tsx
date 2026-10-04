'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  getAllTrails,
  getAllWaypoints,
  getAllHazards,
  getActiveRiderProfile,
  saveTrail,
  saveWaypoint,
  deleteTrail,
  deleteWaypoint,
} from '@/lib/db';
import {
  Trail,
  Waypoint,
  HazardReport,
  BreadcrumbPoint,
  VehicleIncline,
  TransportMode,
  RiderProfile,
} from '@/types/trail';
import { calculateTrackDistanceKm } from '@/lib/geo';
import Inclinometer from '@/components/Inclinometer';
import TrailDrawer from '@/components/TrailDrawer';
import WaypointModal from '@/components/WaypointModal';
import ModeSelector from '@/components/ModeSelector';
import HazardModal from '@/components/HazardModal';
import PinAuthModal from '@/components/PinAuthModal';
import FinishRouteModal from '@/components/FinishRouteModal';
import QuickCameraModal from '@/components/QuickCameraModal';
import {
  Play,
  Square,
  MapPin,
  FolderOpen,
  AlertTriangle,
  User,
  Shield,
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
  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [activeTrailId, setActiveTrailId] = useState<string | null>(null);

  // Rider Profile & Transport Mode
  const [currentRider, setCurrentRider] = useState<RiderProfile | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>('utv');

  // GPS & Vehicle State
  const [currentPosition, setCurrentPosition] = useState<GeolocationCoordinates | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [incline, setIncline] = useState<VehicleIncline>({ pitch: 0, roll: 0 });

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPoints, setRecordedPoints] = useState<BreadcrumbPoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // UI Modals
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPinAuthOpen, setIsPinAuthOpen] = useState(false);
  const [isHazardModalOpen, setIsHazardModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isFinishRouteModalOpen, setIsFinishRouteModalOpen] = useState(false);
  const [isAddingWaypointMode, setIsAddingWaypointMode] = useState(false);
  const [selectedCoordsForWaypoint, setSelectedCoordsForWaypoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Load IndexedDB items on start & fetch cloud trails/hazards from Supabase
  useEffect(() => {
    async function initData() {
      const savedTrails = await getAllTrails();
      const savedWaypoints = await getAllWaypoints();
      const savedHazards = await getAllHazards();
      const activeRider = await getActiveRiderProfile();

      setTrails(savedTrails);
      setWaypoints(savedWaypoints);
      setHazards(savedHazards);
      setCurrentRider(activeRider);

      // Fetch cloud trails & hazards from Supabase PostGIS
      try {
        const [trailsRes, hazardsRes] = await Promise.all([
          fetch('/api/trails'),
          fetch('/api/hazards'),
        ]);

        if (trailsRes.ok) {
          const data = await trailsRes.json();
          if (data.trails && data.trails.length > 0) {
            setTrails((local) => {
              const existingIds = new Set(local.map((t) => t.id));
              const newFromCloud = data.trails.filter((t: Trail) => !existingIds.has(t.id));
              // Cache in local IndexedDB for offline use
              newFromCloud.forEach((t: Trail) => saveTrail(t));
              return [...newFromCloud, ...local];
            });
          }
        }

        if (hazardsRes.ok) {
          const data = await hazardsRes.json();
          if (data.hazards && data.hazards.length > 0) {
            setHazards(data.hazards);
          }
        }
      } catch (e) {
        console.warn('Offline mode: relying on local IndexedDB storage');
      }
    }
    initData();

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update();
        })
        .catch((err) => {
          console.warn('SW registration failed:', err);
        });
    }

    // Set accurate viewport height on mobile to completely prevent toolbar/OS nav cutoffs
    const updateAppHeight = () => {
      const vh = window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${vh}px`);
    };
    updateAppHeight();
    window.addEventListener('resize', updateAppHeight);
    window.addEventListener('orientationchange', updateAppHeight);
    return () => {
      window.removeEventListener('resize', updateAppHeight);
      window.removeEventListener('orientationchange', updateAppHeight);
    };
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

        // If recording, log breadcrumb point
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

  // Handle Recording Actions
  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordedPoints([]);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (recordedPoints.length < 2) {
      alert('Trail too short to save. Drive or walk a further distance.');
      setRecordedPoints([]);
      return;
    }
    // Open Finish Route Dialog with 3-Way Privacy Selector
    setIsFinishRouteModalOpen(true);
  };

  const handleRouteSaved = async (newTrail: Trail) => {
    setTrails((prev) => [newTrail, ...prev]);
    setRecordedPoints([]);
    setActiveTrailId(newTrail.id);

    try {
      await fetch('/api/trails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrail),
      });
    } catch (e) {
      console.warn('Saved locally; will sync when back online');
    }
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

  const currentDistanceKm = calculateTrackDistanceKm(recordedPoints);
  const currentDistanceMiles = currentDistanceKm * 0.621371;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <main
      className="fixed inset-0 w-full flex flex-col bg-slate-950 select-none overflow-hidden font-sans"
      style={{ height: 'var(--app-height, 100svh)', maxHeight: 'var(--app-height, 100svh)' }}
    >
      {/* Top HUD Container */}
      <div className="absolute top-0 left-0 right-0 z-30 p-2 sm:p-3 flex flex-col gap-1.5 sm:gap-2 pointer-events-none pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Row 1: Brand/Speed, Desktop Mode Selector, Gauges/Rider */}
        <header className="w-full flex items-center justify-between gap-1.5 sm:gap-2 pointer-events-none">
          {/* Brand, Speed & Altitude */}
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-2.5 sm:px-3 py-1.5 shadow-xl">
            <div className="flex flex-col">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-orange-500 leading-tight">
                TrailNav
              </span>
              <div className="flex items-baseline gap-0.5 sm:gap-1">
                <span className="text-lg sm:text-xl font-black font-mono text-white leading-tight">
                  {speedKmh}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono uppercase">km/h</span>
              </div>
            </div>
            {currentPosition?.altitude != null && (
              <>
                <div className="h-5 sm:h-6 w-px bg-slate-800 ml-1" />
                <div className="flex flex-col ml-0.5 sm:ml-1">
                  <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-400 font-bold leading-tight">
                    ELEV
                  </span>
                  <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-200">
                    {Math.round(currentPosition.altitude)}m
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Desktop/Tablet Center: Mode Selector */}
          <div className="pointer-events-auto hidden md:block">
            <ModeSelector
              currentMode={transportMode}
              onSelectMode={(mode) => setTransportMode(mode)}
            />
          </div>

          {/* Right: Inclinometer Gauges & Rider Profile Button */}
          <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
            {/* Rider Profile Button */}
            <button
              onClick={() => setIsPinAuthOpen(true)}
              className="flex items-center gap-1 bg-slate-900/90 hover:bg-slate-800 active:scale-95 backdrop-blur-md border border-slate-800 p-2 sm:px-2.5 sm:py-2 rounded-2xl shadow-xl text-slate-200 text-xs font-bold transition"
              title="Rider Profile PIN Login"
            >
              <User className="w-4 h-4 text-orange-400" />
              <span className="hidden lg:inline">
                {currentRider ? `${currentRider.firstName}` : 'Rider'}
              </span>
            </button>

            {/* Vehicle Incline Gauges */}
            <Inclinometer incline={incline} heading={heading} />
          </div>
        </header>

        {/* Row 2: Mobile/Tablet Mode Selector (Flows cleanly below header, ZERO overlap) */}
        <div className="md:hidden flex justify-center pointer-events-auto">
          <ModeSelector
            currentMode={transportMode}
            onSelectMode={(mode) => setTransportMode(mode)}
          />
        </div>

        {/* Row 3: Persistent Track Recording HUD Warning Banner */}
        {isRecording && (
          <div className="self-center pointer-events-auto bg-purple-950/95 border-2 border-purple-500/90 backdrop-blur-md px-4 sm:px-5 py-1.5 sm:py-2 rounded-full shadow-2xl flex items-center gap-2.5 sm:gap-3 text-xs font-mono animate-pulse">
            <div className="flex items-center gap-1.5 text-purple-300 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
              <span>🔴 REC ({transportMode.toUpperCase()})</span>
            </div>
            <div className="text-white font-black text-xs sm:text-sm">
              {currentDistanceMiles.toFixed(1)} mi ({currentDistanceKm.toFixed(1)} km)
            </div>
            <div className="text-purple-200 font-bold">
              {formatTimer(elapsedSeconds)}
            </div>
          </div>
        )}
      </div>

      {/* Main Map Viewport */}
      <div className="flex-1 w-full h-full relative">
        <TrailMap
          currentPosition={currentPosition}
          recordedPoints={recordedPoints}
          trails={trails}
          waypoints={waypoints}
          hazards={hazards}
          transportMode={transportMode}
          activeTrailId={activeTrailId}
          onMapClickAddWaypoint={handleMapClickAddWaypoint}
          isAddingWaypointMode={isAddingWaypointMode}
          onSelectHazard={(h) => alert(`Hazard: ${h.title}\n${h.description || 'Reported on trail'}`)}
          onReportHazard={() => setIsHazardModalOpen(true)}
          onQuickCamera={() => setIsCameraModalOpen(true)}
        />
      </div>

      {/* Bottom Control Dock (Anchored with safe-area spacing to prevent bottom nav clipping) */}
      <footer className="absolute bottom-6 left-3 right-3 sm:left-4 sm:right-4 z-30 max-w-lg mx-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-3xl p-2 sm:p-2.5 shadow-2xl flex items-center justify-between pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Record / Stop Button */}
        {!isRecording ? (
          <button
            onClick={handleStartRecording}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold py-3 px-3 rounded-2xl shadow-lg shadow-orange-950/50 transition-all active:scale-95 text-xs tracking-wide"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Record Route</span>
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-3 rounded-2xl shadow-lg shadow-purple-950/50 transition-all active:scale-95 text-xs tracking-wide animate-pulse"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>Finish Route</span>
          </button>
        )}

        {/* Quick Drop Waypoint */}
        <button
          onClick={handleQuickAddCurrentLocationWaypoint}
          className="mx-1.5 sm:mx-2 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-3 px-2.5 sm:px-3 rounded-2xl transition-all active:scale-95 text-xs font-medium"
          title="Drop waypoint at current position"
        >
          <MapPin className="w-4 h-4 text-orange-400" />
          <span className="hidden sm:inline">Waypoint</span>
        </button>

        {/* Tap Map Waypoint Mode Toggle */}
        <button
          onClick={() => setIsAddingWaypointMode((prev) => !prev)}
          className={`mr-1.5 sm:mr-2 p-3 rounded-2xl border transition-all active:scale-95 ${
            isAddingWaypointMode
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
          title="Tap on map to add waypoint"
        >
          <MapPin className="w-4 h-4" />
        </button>

        {/* Library Drawer Toggle */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl transition-all active:scale-95 flex items-center justify-center relative"
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

      {/* Modals & Sheets */}
      <PinAuthModal
        isOpen={isPinAuthOpen}
        onClose={() => setIsPinAuthOpen(false)}
        onSuccess={(rider) => setCurrentRider(rider)}
        currentRider={currentRider}
      />

      <HazardModal
        isOpen={isHazardModalOpen}
        onClose={() => setIsHazardModalOpen(false)}
        currentPosition={currentPosition}
        currentRider={currentRider}
        onHazardAdded={async (newHazard) => {
          setHazards((prev) => [newHazard, ...prev]);
          try {
            await fetch('/api/hazards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newHazard),
            });
          } catch (e) {
            console.warn('Saved locally; will sync when back online');
          }
        }}
      />

      <FinishRouteModal
        isOpen={isFinishRouteModalOpen}
        onClose={() => setIsFinishRouteModalOpen(false)}
        recordedPoints={recordedPoints}
        elapsedSeconds={elapsedSeconds}
        currentRider={currentRider}
        onRouteSaved={handleRouteSaved}
      />

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

      <QuickCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        currentPosition={currentPosition}
        heading={heading}
        speedKmh={speedKmh}
        onSaveWaypoint={handleSaveWaypoint}
      />
    </main>
  );
}
