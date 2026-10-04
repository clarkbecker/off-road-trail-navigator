'use client';

import React, { useState } from 'react';
import { Waypoint } from '@/types/trail';
import { MapPin, X } from 'lucide-react';

interface WaypointModalProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates: { lat: number; lng: number } | null;
  onSave: (wp: Omit<Waypoint, 'id' | 'createdAt'>) => void;
}

const CATEGORIES: { label: string; value: Waypoint['category'] }[] = [
  { label: 'Obstacle / Rock Crawl', value: 'obstacle' },
  { label: 'Hazard / Danger', value: 'hazard' },
  { label: 'Campsite', value: 'campsite' },
  { label: 'Scenic Viewpoint', value: 'scenic' },
  { label: 'Water Crossing', value: 'water' },
  { label: 'Fuel / Staging Area', value: 'fuel' },
  { label: 'General Marker', value: 'general' },
];

export default function WaypointModal({
  isOpen,
  onClose,
  coordinates,
  onSave,
}: WaypointModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Waypoint['category']>('general');
  const [notes, setNotes] = useState('');

  if (!isOpen || !coordinates) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      category,
      lat: coordinates.lat,
      lng: coordinates.lng,
      notes: notes.trim() || undefined,
    });

    setName('');
    setCategory('general');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-white text-base">Drop Waypoint</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Waypoint Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Broken Axle Rock, Ridge Camp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Waypoint['category'])}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Line Advice</label>
            <textarea
              rows={2}
              placeholder="e.g. Hug the driver side wall, deep rut on passenger side"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            Coordinates: {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white shadow-lg shadow-orange-600/30 transition-all"
            >
              Save Waypoint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
