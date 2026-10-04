'use client';

import React from 'react';
import { Truck, Bike, Footprints } from 'lucide-react';
import { TransportMode } from '@/types/trail';

interface ModeSelectorProps {
  currentMode: TransportMode;
  onSelectMode: (mode: TransportMode) => void;
}

export default function ModeSelector({
  currentMode,
  onSelectMode,
}: ModeSelectorProps) {
  const modes: { id: TransportMode; label: string; icon: React.ReactNode; color: string }[] = [
    {
      id: 'utv',
      label: 'UTV / 4x4',
      icon: <Truck className="w-4 h-4" />,
      color: 'bg-orange-500 text-white shadow-orange-500/30',
    },
    {
      id: 'mtb',
      label: 'MTB',
      icon: <Bike className="w-4 h-4" />,
      color: 'bg-emerald-500 text-white shadow-emerald-500/30',
    },
    {
      id: 'hike',
      label: 'Hike',
      icon: <Footprints className="w-4 h-4" />,
      color: 'bg-sky-500 text-white shadow-sky-500/30',
    },
  ];

  return (
    <div className="flex items-center bg-slate-900/90 backdrop-blur-md p-1.5 rounded-full border border-slate-700/80 shadow-xl">
      {modes.map((mode) => {
        const isActive = currentMode === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onSelectMode(mode.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all duration-150 active:scale-95 ${
              isActive
                ? `${mode.color} shadow-md`
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {mode.icon}
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
