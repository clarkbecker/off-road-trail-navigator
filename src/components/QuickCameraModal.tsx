'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Video,
  X,
  RotateCcw,
  Zap,
  MapPin,
  Download,
  Check,
  Compass,
  Square,
  AlertCircle,
  FlipHorizontal,
} from 'lucide-react';
import { TrailMedia, Waypoint } from '@/types/trail';

interface QuickCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPosition: GeolocationCoordinates | null;
  heading: number | null;
  speedKmh: number;
  onSaveWaypoint?: (wp: Omit<Waypoint, 'id' | 'createdAt'>) => void;
}

export default function QuickCameraModal({
  isOpen,
  onClose,
  currentPosition,
  heading,
  speedKmh,
  onSaveWaypoint,
}: QuickCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Capture State
  const [capturedMedia, setCapturedMedia] = useState<TrailMedia | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSavingWaypoint, setIsSavingWaypoint] = useState(false);
  const [waypointSavedSuccess, setWaypointSavedSuccess] = useState(false);

  // Start Camera
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedMedia(null);
      setWaypointSavedSuccess(false);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Video recording timer
  useEffect(() => {
    let interval: any;
    if (isRecordingVideo) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecordingVideo]);

  async function startCamera() {
    setCameraError(null);
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback without audio if mic permission is rejected
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
      setHasTorch(Boolean(capabilities?.torch));
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError(
        'Unable to access camera directly. You can use your tablet native camera via the button below.'
      );
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  // Toggle Flashlight (Torch)
  async function toggleTorch() {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const newTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorch }],
      });
      setIsTorchOn(newTorch);
    } catch (e) {
      console.warn('Torch constraint error:', e);
    }
  }

  // Flip Camera (Rear <-> Front)
  function handleFlipCamera() {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }

  // 1. Take Photo
  function handleSnapPhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Overlay TrailNav Telemetry Watermark
    ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
    ctx.fillRect(0, canvas.height - 48, canvas.width, 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    const lat = currentPosition ? currentPosition.latitude.toFixed(5) : 'N/A';
    const lng = currentPosition ? currentPosition.longitude.toFixed(5) : 'N/A';
    const elev = currentPosition?.altitude != null ? `${Math.round(currentPosition.altitude)}m` : 'N/A';
    const head = heading != null ? `${Math.round(heading)}°` : 'N/A';
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    ctx.fillText(
      `TRAILNAV • ${dateStr} • GPS: ${lat}, ${lng} • ELEV: ${elev} • HDG: ${head} • ${speedKmh} km/h`,
      16,
      canvas.height - 18
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const media: TrailMedia = {
      id: 'media_' + Date.now(),
      type: 'photo',
      dataUrl,
      lat: currentPosition?.latitude || 0,
      lng: currentPosition?.longitude || 0,
      elevation: currentPosition?.altitude,
      heading,
      speedKmh,
      createdAt: Date.now(),
      title: 'Trail Photo ' + new Date().toLocaleTimeString(),
    };

    setCapturedMedia(media);
    stopCamera();
  }

  // 2. Start Video Recording
  function handleStartRecordingVideo() {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(streamRef.current, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);

        const media: TrailMedia = {
          id: 'media_' + Date.now(),
          type: 'video',
          dataUrl: videoUrl,
          blob,
          lat: currentPosition?.latitude || 0,
          lng: currentPosition?.longitude || 0,
          elevation: currentPosition?.altitude,
          heading,
          speedKmh,
          createdAt: Date.now(),
          title: 'Trail Video ' + new Date().toLocaleTimeString(),
        };

        setCapturedMedia(media);
        stopCamera();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(500); // 500ms chunk slices
      setIsRecordingVideo(true);
    } catch (e) {
      alert('Video recording not supported on this device/browser');
    }
  }

  // Stop Video Recording
  function handleStopRecordingVideo() {
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
    }
  }

  // Handle Native Camera Fallback File Picker
  function handleNativeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const media: TrailMedia = {
        id: 'media_' + Date.now(),
        type: isVideo ? 'video' : 'photo',
        dataUrl,
        blob: file,
        lat: currentPosition?.latitude || 0,
        lng: currentPosition?.longitude || 0,
        elevation: currentPosition?.altitude,
        heading,
        speedKmh,
        createdAt: Date.now(),
        title: 'Native Camera ' + (isVideo ? 'Video' : 'Photo'),
      };
      setCapturedMedia(media);
      stopCamera();
    };
    reader.readAsDataURL(file);
  }

  // Save as Map Waypoint
  function handleSaveAsWaypoint() {
    if (!capturedMedia || !onSaveWaypoint) return;
    setIsSavingWaypoint(true);

    onSaveWaypoint({
      name: capturedMedia.type === 'video' ? 'Video Waypoint' : 'Scenic Photo Waypoint',
      category: 'scenic',
      lat: capturedMedia.lat || currentPosition?.latitude || 0,
      lng: capturedMedia.lng || currentPosition?.longitude || 0,
      elevation: capturedMedia.elevation != null ? capturedMedia.elevation : undefined,
      notes: `${capturedMedia.title} • Captured at ${speedKmh} km/h`,
      mediaUrl: capturedMedia.dataUrl,
      mediaType: capturedMedia.type,
    });

    setIsSavingWaypoint(false);
    setWaypointSavedSuccess(true);
  }

  // Direct Device Download
  function handleDownload() {
    if (!capturedMedia || !capturedMedia.dataUrl) return;
    const a = document.createElement('a');
    a.href = capturedMedia.dataUrl;
    a.download = `trailnav_${capturedMedia.type}_${Date.now()}.${capturedMedia.type === 'video' ? 'webm' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Retake
  function handleRetake() {
    setCapturedMedia(null);
    setWaypointSavedSuccess(false);
    startCamera();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between select-none animate-in fade-in duration-200">
      {/* Top Telemetry Visor Bar */}
      <div className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-3 sm:px-6 flex items-center justify-between text-white z-20">
        {/* GPS Coordinates & Speed */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">
              Quick Trail Cam
            </span>
            <span className="text-xs font-mono font-bold text-slate-200">
              {currentPosition
                ? `${currentPosition.latitude.toFixed(4)}°N, ${Math.abs(currentPosition.longitude).toFixed(4)}°W`
                : 'Acquiring GPS...'}
            </span>
          </div>
          {currentPosition?.altitude != null && (
            <div className="hidden sm:flex flex-col border-l border-slate-800 pl-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Elev</span>
              <span className="text-xs font-mono font-bold">{Math.round(currentPosition.altitude)}m</span>
            </div>
          )}
          <div className="flex flex-col border-l border-slate-800 pl-3">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Speed</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{speedKmh} km/h</span>
          </div>
        </div>

        {/* Top Action Controls: Flash, Flip, Close */}
        <div className="flex items-center gap-2">
          {hasTorch && !capturedMedia && (
            <button
              onClick={toggleTorch}
              className={`p-2.5 rounded-full border transition active:scale-95 ${
                isTorchOn
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-500/50'
                  : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}
              title="Toggle Flashlight / Torch"
            >
              <Zap className="w-4 h-4 fill-current" />
            </button>
          )}

          {!capturedMedia && (
            <button
              onClick={handleFlipCamera}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-full text-slate-200 active:scale-95 transition"
              title="Flip Rear / Front Camera"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2.5 bg-rose-600/80 hover:bg-rose-600 border border-rose-500 text-white rounded-full active:scale-95 transition"
            title="Exit Camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport: Live Viewfinder OR Captured Preview */}
      <div className="relative flex-1 w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {!capturedMedia ? (
          <>
            {/* Live Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Crosshair / Viewfinder Reticle */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-32 h-32 sm:w-48 sm:h-48 border-2 border-white/30 rounded-3xl relative">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border-t-2 border-l-2 border-white/60" />
              </div>
            </div>

            {/* Live Recording Pulsing Banner */}
            {isRecordingVideo && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white font-mono font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-2xl animate-pulse">
                <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                <span>REC {recordingSeconds}s</span>
              </div>
            )}

            {/* Compass Heading HUD in Viewfinder */}
            {heading != null && (
              <div className="absolute bottom-4 left-4 bg-slate-950/70 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-2xl flex items-center gap-2 text-amber-400 font-mono text-xs font-bold">
                <Compass className="w-4 h-4" />
                <span>{Math.round(heading)}° HDG</span>
              </div>
            )}

            {/* Camera Error / Permission Fallback Banner */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center gap-4">
                <AlertCircle className="w-12 h-12 text-amber-400" />
                <p className="text-slate-200 text-sm max-w-md">{cameraError}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-2xl shadow-xl active:scale-95 flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  <span>Launch Tablet Camera</span>
                </button>
              </div>
            )}
          </>
        ) : (
          /* Post-Capture Review Screen */
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {capturedMedia.type === 'photo' ? (
              <img
                src={capturedMedia.dataUrl}
                alt="Captured trail photo"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                src={capturedMedia.dataUrl}
                controls
                autoPlay
                loop
                className="w-full h-full object-contain"
              />
            )}
          </div>
        )}

        {/* Hidden Native Camera File Input Fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleNativeFileChange}
          className="hidden"
        />
      </div>

      {/* Bottom Shutter & Controls Dock */}
      <div className="w-full bg-slate-950/90 backdrop-blur-md border-t border-slate-800 p-4 sm:p-5 flex items-center justify-center gap-4 z-20 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!capturedMedia ? (
          /* Live Shutter Controls */
          <div className="flex items-center justify-center gap-6 sm:gap-10 w-full max-w-md">
            {/* Native App Camera Trigger Fallback */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-full text-slate-300 active:scale-95 transition"
              title="Use Native Tablet Camera App"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Oversized Glove-Friendly Photo Snap Shutter */}
            {!isRecordingVideo ? (
              <button
                onClick={handleSnapPhoto}
                className="w-20 h-20 sm:w-22 sm:h-22 bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 active:scale-90 text-white rounded-full shadow-2xl shadow-orange-950/80 border-4 border-white flex flex-col items-center justify-center gap-0.5 transition select-none"
                title="Instant Photo Capture"
              >
                <Camera className="w-7 h-7 stroke-[2.5]" />
                <span className="text-[9px] font-black uppercase tracking-tight">Snap</span>
              </button>
            ) : null}

            {/* Video Clip Shutter (Start / Stop) */}
            {!isRecordingVideo ? (
              <button
                onClick={handleStartRecordingVideo}
                className="w-16 h-16 sm:w-18 sm:h-18 bg-rose-600 hover:bg-rose-500 active:scale-90 text-white rounded-full shadow-xl shadow-rose-950/60 border-2 border-rose-300 flex flex-col items-center justify-center gap-0.5 transition select-none"
                title="Record Video Clip"
              >
                <Video className="w-6 h-6 stroke-[2]" />
                <span className="text-[8px] font-bold uppercase tracking-tight">Clip</span>
              </button>
            ) : (
              <button
                onClick={handleStopRecordingVideo}
                className="w-20 h-20 bg-red-600 hover:bg-red-500 active:scale-90 text-white rounded-full shadow-2xl border-4 border-white flex flex-col items-center justify-center gap-0.5 transition select-none animate-pulse"
                title="Stop Video Recording"
              >
                <Square className="w-7 h-7 fill-white" />
                <span className="text-[9px] font-black uppercase tracking-tight">Stop</span>
              </button>
            )}
          </div>
        ) : (
          /* Review / Action Buttons */
          <div className="flex items-center justify-between gap-3 w-full max-w-lg">
            {/* Retake */}
            <button
              onClick={handleRetake}
              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 py-3.5 px-3 rounded-2xl text-slate-200 font-bold text-xs active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake</span>
            </button>

            {/* Save as Map Waypoint */}
            {onSaveWaypoint && (
              <button
                onClick={handleSaveAsWaypoint}
                disabled={waypointSavedSuccess || isSavingWaypoint}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-2xl font-bold text-xs active:scale-95 transition shadow-lg ${
                  waypointSavedSuccess
                    ? 'bg-emerald-600 text-white shadow-emerald-950/50'
                    : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/50'
                }`}
              >
                {waypointSavedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved to Map!</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    <span>Geotag Waypoint</span>
                  </>
                )}
              </button>
            )}

            {/* Save to Device Gallery */}
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3.5 px-3 rounded-2xl text-slate-100 font-bold text-xs active:scale-95 transition"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
