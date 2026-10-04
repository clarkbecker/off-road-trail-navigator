export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation?: number;
  category: 'campsite' | 'hazard' | 'obstacle' | 'water' | 'scenic' | 'fuel' | 'general';
  notes?: string;
  createdAt: number;
}

export interface BreadcrumbPoint {
  lat: number;
  lng: number;
  elevation?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface Trail {
  id: string;
  name: string;
  description?: string;
  difficulty: 'Easy' | 'Moderate' | 'Difficult' | 'Severe' | 'Extreme';
  points: BreadcrumbPoint[];
  distanceKm: number;
  durationSeconds?: number;
  createdAt: number;
  color?: string;
}

export interface MapLayerConfig {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

export interface VehicleIncline {
  pitch: number; // degrees (-front / +back)
  roll: number;  // degrees (-left / +right)
}
