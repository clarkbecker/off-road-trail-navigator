'use client';

import React, { useState } from 'react';
import { Trail, Waypoint } from '@/types/trail';
import { exportTrailToGpx, parseGpx } from '@/lib/gpx';
import { Download, Upload, Trash2, MapPin, Eye, Mountain, X } from 'lucide-react';

interface TrailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  trails: Trail[];
  waypoints: Waypoint[];
  activeTrailId: string | null;
  onSelectTrail: (id: string | null) => void;
  onDeleteTrail: (id: string) => void;
  onImportTrail: (trail: Trail) => void;
  onDeleteWaypoint: (id: string) => void;
}

export default function TrailDrawer({
  isOpen,
  onClose,
  trails,
  waypoints,
  activeTrailId,
  onSelectTrail,
  onDeleteTrail,
  onImportTrail,
  onDeleteWaypoint,
}: TrailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'trails' | 'waypoints'>('trails');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = parseGpx(text, file.name.replace(/\.[^/.]+$/, ''));
        onImportTrail(imported);
      } catch (err) {
        alert('Failed to parse GPX file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportTrail = (trail: Trail) => {
    const gpxData = exportTrailToGpx(trail);
    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trail.name.replace(/\s+/g, '_')}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mountain className="w-6 h-6 text-orange-500" />
            <h2 className="text-lg font-bold text-white tracking-wide">Trail Library</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 m-3 rounded-xl">
          <button
            onClick={() => setActiveTab('trails')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'trails'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Recorded Trails ({trails.length})
          </button>
          <button
            onClick={() => setActiveTab('waypoints')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'waypoints'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Waypoints ({waypoints.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'trails' ? (
            <>
              {/* Import GPX Action */}
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-700 hover:border-orange-500 rounded-xl cursor-pointer bg-slate-950/40 transition-colors group">
                <Upload className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-slate-300">Import GPX Trail File</span>
                <input type="file" accept=".gpx" onChange={handleFileUpload} className="hidden" />
              </label>

              {trails.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No trails saved yet. Record a drive or import a GPX track!
                </div>
              ) : (
                trails.map((trail) => {
                  const isActive = trail.id === activeTrailId;
                  return (
                    <div
                      key={trail.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isActive
                          ? 'border-orange-500/80 bg-orange-950/20 shadow-md'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-100 text-sm">{trail.name}</h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-mono">
                            <span>{trail.distanceKm.toFixed(2)} km</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-orange-400">
                              {trail.difficulty}
                            </span>
                            <span>•</span>
                            <span>{trail.points.length} pts</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onSelectTrail(isActive ? null : trail.id)}
                            className={`p-1.5 rounded-lg border ${
                              isActive
                                ? 'bg-orange-500 text-white border-orange-400'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            }`}
                            title={isActive ? 'Deselect trail' : 'Focus trail'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleExportTrail(trail)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                            title="Export to GPX"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTrail(trail.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-slate-700"
                            title="Delete trail"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <>
              {waypoints.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No waypoints recorded. Tap "+ Waypoint" on the bottom navigation to drop one!
                </div>
              ) : (
                waypoints.map((wp) => (
                  <div
                    key={wp.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-orange-400" />
                        <h3 className="font-semibold text-slate-100 text-sm">{wp.name}</h3>
                      </div>
                      <div className="mt-1 text-xs text-slate-400 flex items-center gap-2 font-mono">
                        <span className="capitalize text-amber-400">{wp.category}</span>
                        <span>•</span>
                        <span>
                          {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                        </span>
                      </div>
                      {wp.notes && <p className="text-xs text-slate-400 mt-1 italic">{wp.notes}</p>}
                    </div>
                    <button
                      onClick={() => onDeleteWaypoint(wp.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-slate-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
