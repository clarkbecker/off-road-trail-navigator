'use client';

import React, { useState } from 'react';
import {
  Flag,
  Lock,
  Users,
  Globe,
  Gauge,
  MapPin,
  Clock,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import {
  BreadcrumbPoint,
  RoutePrivacy,
  RouteType,
  RiderProfile,
  Trail,
} from '@/types/trail';
import { simplifyBreadcrumbTrack, calculateTrackDistanceKm } from '@/lib/geo';
import { saveTrail, enqueueSync } from '@/lib/db';

interface FinishRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordedPoints: BreadcrumbPoint[];
  elapsedSeconds: number;
  currentRider: RiderProfile | null;
  onRouteSaved: (trail: Trail) => void;
}

export default function FinishRouteModal({
  isOpen,
  onClose,
  recordedPoints,
  elapsedSeconds,
  currentRider,
  onRouteSaved,
}: FinishRouteModalProps) {
  const [name, setName] = useState(`Track ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  const [difficulty, setDifficulty] = useState<Trail['difficulty']>('Moderate');
  const [routeType, setRouteType] = useState<RouteType>('user_submitted');
  const [visibility, setVisibility] = useState<RoutePrivacy>('private');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const rawDistance = calculateTrackDistanceKm(recordedPoints);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);

    // Apply Douglas-Peucker GPS path smoothing
    const simplifiedPoints = simplifyBreadcrumbTrack(recordedPoints, 0.00005);
    const distanceKm = calculateTrackDistanceKm(simplifiedPoints) || rawDistance;

    const trail: Trail = {
      id: crypto.randomUUID(),
      name: name.trim(),
      difficulty,
      points: simplifiedPoints,
      distanceKm,
      durationSeconds: elapsedSeconds,
      createdAt: Date.now(),
      color: visibility === 'private' ? '#f43f5e' : visibility === 'shared' ? '#38bdf8' : '#10b981',
      visibility,
      routeType,
      creatorId: currentRider?.id,
      officialStatus: 'open',
    };

    // Save locally
    await saveTrail(trail);

    // Enqueue cloud sync
    await enqueueSync({
      id: crypto.randomUUID(),
      type: 'trail',
      action: 'create',
      payload: trail,
      timestamp: Date.now(),
    });

    onRouteSaved(trail);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Flag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Finish Recorded Route</h2>
              <p className="text-xs text-slate-400">Save and set route privacy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary Card */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-orange-400" /> Distance
            </span>
            <span className="text-sm font-extrabold text-slate-100">
              {(rawDistance * 0.621371).toFixed(2)} mi
            </span>
            <span className="text-[10px] text-slate-500">{rawDistance.toFixed(2)} km</span>
          </div>

          <div className="flex flex-col items-center border-x border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" /> Duration
            </span>
            <span className="text-sm font-extrabold text-slate-100">
              {minutes}m {seconds}s
            </span>
            <span className="text-[10px] text-slate-500">{elapsedSeconds} sec</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" /> GPS Track
            </span>
            <span className="text-sm font-extrabold text-slate-100">
              {recordedPoints.length}
            </span>
            <span className="text-[10px] text-slate-500">raw points</span>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Route Name */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1.5 block">
              Route Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-orange-500 font-medium"
              required
            />
          </div>

          {/* Difficulty Rating */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1.5 block">
              Difficulty Rating
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['Easy', 'Moderate', 'Difficult', 'Severe', 'Extreme'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition border ${
                    difficulty === diff
                      ? 'bg-orange-500 text-white border-orange-400 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Route Type */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1.5 block">
              Trail Classification
            </label>
            <select
              value={routeType}
              onChange={(e) => setRouteType(e.target.value as RouteType)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
            >
              <option value="user_submitted">User Submitted Track</option>
              <option value="designated_trail">Designated UTV/Off-Road Trail</option>
              <option value="unmaintained_fire_road">Unmaintained Fire Road</option>
              <option value="street_legal_city">Street-Legal Connector</option>
            </select>
          </div>

          {/* 3-Way Privacy Selector (V7 Specification) */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-orange-400" /> Route Visibility
              </label>
              <span className="text-[10px] text-slate-500">Defaults to Private</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Private (Only Me) */}
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center transition active:scale-95 ${
                  visibility === 'private'
                    ? 'bg-rose-950/60 border-rose-500 text-rose-300 shadow-md shadow-rose-950/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-5 h-5 text-rose-400" />
                <span className="text-[11px] font-bold">Private</span>
                <span className="text-[9px] text-slate-400">Only Me</span>
              </button>

              {/* Shared (Specific Riders) */}
              <button
                type="button"
                onClick={() => setVisibility('shared')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center transition active:scale-95 ${
                  visibility === 'shared'
                    ? 'bg-sky-950/60 border-sky-500 text-sky-300 shadow-md shadow-sky-950/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-5 h-5 text-sky-400" />
                <span className="text-[11px] font-bold">Shared</span>
                <span className="text-[9px] text-slate-400">Group Riders</span>
              </button>

              {/* Public */}
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center transition active:scale-95 ${
                  visibility === 'public'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-5 h-5 text-emerald-400" />
                <span className="text-[11px] font-bold">Public</span>
                <span className="text-[9px] text-slate-400">Community</span>
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-lg shadow-orange-950 border border-orange-400/40 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
            <span>{isSaving ? 'Simplifying & Saving...' : 'Save Trail to Map'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
