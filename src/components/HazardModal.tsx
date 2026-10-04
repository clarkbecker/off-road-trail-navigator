'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Trees,
  CloudRain,
  Axe,
  Ban,
  HelpCircle,
  X,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { HazardReport, HazardType, RiderProfile } from '@/types/trail';
import { saveHazard, enqueueSync } from '@/lib/db';

interface HazardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPosition: GeolocationCoordinates | null;
  currentRider: RiderProfile | null;
  onHazardAdded: (hazard: HazardReport) => void;
}

const HAZARD_OPTIONS: {
  type: HazardType;
  title: string;
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  textClass: string;
}[] = [
  {
    type: 'tree_down',
    title: 'Tree Down',
    icon: <Trees className="w-7 h-7" />,
    bgClass: 'bg-emerald-950/60 hover:bg-emerald-900/80 active:bg-emerald-800',
    borderClass: 'border-emerald-600/60',
    textClass: 'text-emerald-400',
  },
  {
    type: 'washout_rut',
    title: 'Washout / Rut',
    icon: <AlertTriangle className="w-7 h-7" />,
    bgClass: 'bg-amber-950/60 hover:bg-amber-900/80 active:bg-amber-800',
    borderClass: 'border-amber-600/60',
    textClass: 'text-amber-400',
  },
  {
    type: 'mud_flooded',
    title: 'Mud / Flooded',
    icon: <CloudRain className="w-7 h-7" />,
    bgClass: 'bg-blue-950/60 hover:bg-blue-900/80 active:bg-blue-800',
    borderClass: 'border-blue-600/60',
    textClass: 'text-blue-400',
  },
  {
    type: 'active_logging',
    title: 'Active Logging',
    icon: <Axe className="w-7 h-7" />,
    bgClass: 'bg-purple-950/60 hover:bg-purple-900/80 active:bg-purple-800',
    borderClass: 'border-purple-600/60',
    textClass: 'text-purple-400',
  },
  {
    type: 'trail_impassable',
    title: 'Trail Impassable',
    icon: <Ban className="w-7 h-7" />,
    bgClass: 'bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-800',
    borderClass: 'border-rose-600/60',
    textClass: 'text-rose-400',
  },
  {
    type: 'other',
    title: 'Other Hazard',
    icon: <HelpCircle className="w-7 h-7" />,
    bgClass: 'bg-slate-800/60 hover:bg-slate-700/80 active:bg-slate-600',
    borderClass: 'border-slate-600/60',
    textClass: 'text-slate-300',
  },
];

export default function HazardModal({
  isOpen,
  onClose,
  currentPosition,
  currentRider,
  onHazardAdded,
}: HazardModalProps) {
  const [selectedType, setSelectedType] = useState<HazardType | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleReport = async (hazardType: HazardType, title: string) => {
    if (!currentPosition) {
      alert('Unable to acquire current GPS location. Please ensure location services are enabled.');
      return;
    }

    setIsSubmitting(true);

    const report: HazardReport = {
      id: crypto.randomUUID(),
      hazardType,
      title,
      description: notes.trim() || undefined,
      lat: currentPosition.latitude,
      lng: currentPosition.longitude,
      elevation: currentPosition.altitude || undefined,
      reportedBy: currentRider?.id,
      reportedByName: currentRider ? `${currentRider.firstName} ${currentRider.lastName}` : 'Anonymous Rider',
      active: true,
      createdAt: Date.now(),
    };

    // Save locally
    await saveHazard(report);

    // Enqueue for cloud sync
    await enqueueSync({
      id: crypto.randomUUID(),
      type: 'hazard',
      action: 'create',
      payload: report,
      timestamp: Date.now(),
    });

    onHazardAdded(report);
    setIsSubmitting(false);
    setSubmitted(true);

    setTimeout(() => {
      setSubmitted(false);
      setSelectedType(null);
      setNotes('');
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full sm:max-w-md bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col gap-4 animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Report Trail Hazard</h2>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-orange-400" />
                {currentPosition
                  ? `${currentPosition.latitude.toFixed(4)}, ${currentPosition.longitude.toFixed(4)}`
                  : 'Acquiring GPS...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce" />
            <h3 className="text-xl font-bold text-white">Hazard Reported!</h3>
            <p className="text-xs text-slate-400">
              Saved offline and broadcasted to local riders.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-300 font-medium">
              Tap a hazard category to broadcast an alert at your current coordinates:
            </p>

            {/* Oversized Glove-Friendly Hazard Button Grid (Min 60x60px) */}
            <div className="grid grid-cols-2 gap-3">
              {HAZARD_OPTIONS.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleReport(item.type, item.title)}
                  disabled={isSubmitting || !currentPosition}
                  className={`h-24 p-3 rounded-2xl border ${item.borderClass} ${item.bgClass} flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 select-none shadow-lg`}
                >
                  <div className={item.textClass}>{item.icon}</div>
                  <span className="text-xs font-bold text-slate-100 text-center leading-tight">
                    {item.title}
                  </span>
                </button>
              ))}
            </div>

            {/* Optional Note input */}
            <div className="mt-1">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional details (e.g. 18-inch pine blocking trail)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
