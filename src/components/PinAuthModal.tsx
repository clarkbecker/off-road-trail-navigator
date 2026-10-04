'use client';

import React, { useState } from 'react';
import { User, ShieldCheck, Delete, X } from 'lucide-react';
import { RiderProfile } from '@/types/trail';
import { saveRiderProfile } from '@/lib/db';

interface PinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (rider: RiderProfile) => void;
  currentRider: RiderProfile | null;
}

export default function PinAuthModal({
  isOpen,
  onClose,
  onSuccess,
  currentRider,
}: PinAuthModalProps) {
  const [firstName, setFirstName] = useState(currentRider?.firstName || '');
  const [lastName, setLastName] = useState(currentRider?.lastName || '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + num);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name');
      return;
    }

    if (pin.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    const rider: RiderProfile = {
      id: currentRider?.id || crypto.randomUUID(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      pin,
      createdAt: currentRider?.createdAt || Date.now(),
    };

    await saveRiderProfile(rider);
    onSuccess(rider);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Rider Profile</h2>
              <p className="text-xs text-slate-400">Glove-friendly PIN authentication</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Clark"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Becker"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* 4-Digit PIN Indicator */}
          <div className="mt-1 flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Enter 4-Digit PIN</span>
            <div className="flex items-center gap-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                    pin.length > idx
                      ? 'bg-orange-500 border-orange-400 scale-110 shadow-md shadow-orange-500/50'
                      : 'border-slate-700 bg-slate-950/60'
                  }`}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-400 text-center font-medium bg-rose-950/40 border border-rose-900/50 py-1.5 rounded-lg">
              {error}
            </div>
          )}

          {/* Oversized Glove-Friendly Keypad (Min 60px touch targets) */}
          <div className="grid grid-cols-3 gap-2.5 mt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit.toString())}
                className="h-14 sm:h-16 bg-slate-800 hover:bg-slate-700 active:bg-orange-600/30 active:scale-95 text-slate-100 font-bold text-2xl rounded-2xl border border-slate-700/80 shadow transition flex items-center justify-center select-none"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 sm:h-16 bg-slate-950/60 hover:bg-slate-800 active:scale-95 text-slate-400 font-bold text-xs uppercase rounded-2xl border border-slate-800 transition flex items-center justify-center select-none"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-14 sm:h-16 bg-slate-800 hover:bg-slate-700 active:bg-orange-600/30 active:scale-95 text-slate-100 font-bold text-2xl rounded-2xl border border-slate-700/80 shadow transition flex items-center justify-center select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 sm:h-16 bg-slate-950/60 hover:bg-slate-800 active:scale-95 text-slate-400 hover:text-rose-400 rounded-2xl border border-slate-800 transition flex items-center justify-center select-none"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="mt-3 w-full py-4 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-lg shadow-orange-950 border border-orange-400/40 transition flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Enter Map</span>
          </button>
        </form>
      </div>
    </div>
  );
}
