export type TransportMode = 'utv' | 'mtb' | 'hike';

export type RoutePrivacy = 'private' | 'shared' | 'public';

export type RouteType =
  | 'designated_trail'
  | 'unmaintained_fire_road'
  | 'road_route'
  | 'street_legal_city'
  | 'prohibited'
  | 'user_submitted';

export type TrailStatus = 'open' | 'closed' | 'caution';

export interface RiderProfile {
  id: string;
  firstName: string;
  lastName: string;
  pin: string; // 4-digit PIN
  createdAt: number;
}

export type HazardType =
  | 'tree_down'
  | 'washout_rut'
  | 'mud_flooded'
  | 'active_logging'
  | 'trail_impassable'
  | 'other';

export interface HazardReport {
  id: string;
  hazardType: HazardType;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  elevation?: number;
  reportedBy?: string;
  reportedByName?: string;
  active: boolean;
  createdAt: number;
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation?: number;
  category: 'campsite' | 'hazard' | 'obstacle' | 'water' | 'scenic' | 'fuel' | 'general';
  notes?: string;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video';
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
  visibility?: RoutePrivacy;
  routeType?: RouteType;
  officialStatus?: TrailStatus;
  creatorId?: string;
  costUtv?: number;
  costMtb?: number;
  costHike?: number;
  jurisdictionId?: string;
  jurisdictionName?: string;
  systemName?: string;
  trailNumber?: string;
  statusHeadline?: string;
  statusReason?: string;
  allowedUtv?: boolean;
  allowedAtv?: boolean;
  allowedDirtbike?: boolean;
  allowed4x4?: boolean;
  allowedMtb?: boolean;
  allowedHiking?: boolean;
  maxUtvWidthInches?: number;
  surfaceType?: string;
  isPublicRoadRoute?: boolean;
}

export interface MapLayerConfig {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  tileSize?: number;
  zoomOffset?: number;
}

export interface VehicleIncline {
  pitch: number; // degrees (-front / +back)
  roll: number;  // degrees (-left / +right)
}

export interface TrailMedia {
  id: string;
  type: 'photo' | 'video';
  dataUrl?: string;
  blob?: Blob;
  lat: number;
  lng: number;
  elevation?: number | null;
  heading?: number | null;
  speedKmh?: number | null;
  createdAt: number;
  title?: string;
  notes?: string;
}
