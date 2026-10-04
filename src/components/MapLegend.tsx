'use client';

import React, { useState } from 'react';
import { Info, X, CheckCircle, AlertTriangle, AlertOctagon, HelpCircle, Camera } from 'lucide-react';

interface MapLegendProps {
  className?: string;
}

export default function MapLegend({ className = '' }: MapLegendProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {/* Legend Toggle Button */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 active:scale-95 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-full shadow-xl text-slate-200 text-xs font-bold transition select-none"
          title="Open Map Legend"
        >
          <Info className="w-3.5 h-3.5 text-amber-400" />
          <span>Legend</span>
        </button>
      ) : (
        /* Expanded Legend Modal / Overlay */
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-3xl p-4 shadow-2xl w-80 max-w-[90vw] text-slate-100 flex flex-col gap-3 select-none animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-orange-400" />
              <span className="font-extrabold text-sm uppercase tracking-wide text-white">
                Map Legend & Rules
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: Trail Type by Transport Mode */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Trail Types & Modes
            </span>

            {/* UTV Trail */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-1 rounded bg-orange-500 shadow-sm shadow-orange-500/50" />
                <span className="font-medium text-slate-200">UTV / 4x4 Off-Road</span>
              </div>
              <span className="text-[10px] text-orange-400 font-mono font-semibold">Dirt / Woods</span>
            </div>

            {/* MTB Singletrack */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-1 rounded bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span className="font-medium text-slate-200">MTB / Mountain Bike</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">Singletrack</span>
            </div>

            {/* Hiking Trail */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-1 rounded bg-sky-500 shadow-sm shadow-sky-500/50" />
                <span className="font-medium text-slate-200">Hiking / Foot Trail</span>
              </div>
              <span className="text-[10px] text-sky-400 font-mono font-semibold">Non-motorized</span>
            </div>

            {/* Road Route Open to UTVs */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-1 rounded border-b-2 border-dashed border-amber-400" />
                <span className="font-medium text-slate-200">ATV Road Route</span>
              </div>
              <span className="text-[10px] text-amber-400 font-mono font-semibold">Town / CTH Road</span>
            </div>
          </div>

          {/* Section 2: Trail Status */}
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Trail Status
            </span>

            {/* Open */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-200">Open & Active</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Solid Line</span>
            </div>

            {/* Closed */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
                <span className="text-slate-200">Closed (Fire / Seasonal)</span>
              </div>
              <span className="text-[10px] text-red-400 font-mono">Red Dashed Line</span>
            </div>

            {/* Hazard */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-200">Hazard / Obstacle Report</span>
              </div>
              <span className="text-[10px] text-amber-400 font-mono">Map Pin</span>
            </div>

            {/* Scenic Viewpoint / Photo */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-200">Scenic Photo / Video Point</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">Cyan Pin</span>
            </div>
          </div>

          {/* Section 3: Legal Road Route Guide */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 text-[11px] text-slate-300 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-wide">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Public Road Route Rules</span>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">
              • <b>County Highways (CTH):</b> Open to UTVs except CTH A (Hwy 35 to Kilkare Rd).<br />
              • <b>Town Roads:</b> Open in most northern townships (Swiss, Webb Lake, Oakland).<br />
              • <b>State Highways (35/70/77):</b> Prohibited except designated bridge crossings.<br />
              • Stay on extreme right paved surface; headlights on; max 35 mph.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
