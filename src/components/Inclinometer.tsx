'use client';

import React from 'react';
import { Compass } from 'lucide-react';
import { VehicleIncline } from '@/types/trail';

interface InclinometerProps {
  incline: VehicleIncline;
  heading: number | null;
}

export default function Inclinometer({ incline, heading }: InclinometerProps) {
  const pitchWarn = Math.abs(incline.pitch) > 20;
  const pitchDanger = Math.abs(incline.pitch) > 30;
  const rollWarn = Math.abs(incline.roll) > 18;
  const rollDanger = Math.abs(incline.roll) > 28;

  const getStatusColor = (danger: boolean, warn: boolean) => {
    if (danger) return 'text-red-500 border-red-500 bg-red-950/40';
    if (warn) return 'text-amber-400 border-amber-400 bg-amber-950/40';
    return 'text-emerald-400 border-emerald-500/40 bg-slate-900/80';
  };

  return (
    <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-2 px-3 shadow-2xl">
      {/* Compass / Heading */}
      <div className="flex flex-col items-center justify-center min-w-[50px]">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <Compass
            className="w-7 h-7 text-amber-500 transition-transform duration-300"
            style={{ transform: `rotate(${heading || 0}deg)` }}
          />
        </div>
        <span className="text-[10px] font-mono text-slate-400 mt-0.5">
          {heading != null ? `${Math.round(heading)}°` : 'N/A'}
        </span>
      </div>

      <div className="h-8 w-px bg-slate-800" />

      {/* Pitch Gauge */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-bold transition-colors ${getStatusColor(
          pitchDanger,
          pitchWarn
        )}`}
      >
        <span className="text-[10px] font-sans font-semibold tracking-wide text-slate-400">PITCH</span>
        <span className="text-sm">
          {incline.pitch > 0 ? `+${incline.pitch.toFixed(1)}°` : `${incline.pitch.toFixed(1)}°`}
        </span>
      </div>

      {/* Roll Gauge */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-bold transition-colors ${getStatusColor(
          rollDanger,
          rollWarn
        )}`}
      >
        <span className="text-[10px] font-sans font-semibold tracking-wide text-slate-400">ROLL</span>
        <span className="text-sm">
          {incline.roll > 0 ? `+${incline.roll.toFixed(1)}°` : `${incline.roll.toFixed(1)}°`}
        </span>
      </div>
    </div>
  );
}
