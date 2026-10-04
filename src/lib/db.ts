import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Trail, Waypoint, HazardReport, RiderProfile } from '@/types/trail';

export interface SyncQueueItem {
  id: string;
  type: 'hazard' | 'trail' | 'waypoint';
  action: 'create' | 'update' | 'delete';
  payload: any;
  timestamp: number;
}

interface TrailNavDB extends DBSchema {
  trails: {
    key: string;
    value: Trail;
    indexes: { 'by-date': number };
  };
  waypoints: {
    key: string;
    value: Waypoint;
    indexes: { 'by-date': number; 'by-category': string };
  };
  hazards: {
    key: string;
    value: HazardReport;
    indexes: { 'by-date': number; 'by-type': string; 'by-active': number };
  };
  rider: {
    key: string;
    value: RiderProfile;
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-date': number };
  };
  settings: {
    key: string;
    value: any;
  };
  media: {
    key: string;
    value: any;
    indexes: { 'by-date': number };
  };
}

const DB_NAME = 'trailnav-db';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<TrailNavDB>> | null = null;

export function getDatabase() {
  if (typeof window === 'undefined') return null;

  if (!dbPromise) {
    dbPromise = openDB<TrailNavDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const trailStore = db.createObjectStore('trails', { keyPath: 'id' });
          trailStore.createIndex('by-date', 'createdAt');

          const wpStore = db.createObjectStore('waypoints', { keyPath: 'id' });
          wpStore.createIndex('by-date', 'createdAt');
          wpStore.createIndex('by-category', 'category');

          db.createObjectStore('settings');
        }

        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('hazards')) {
            const hazardStore = db.createObjectStore('hazards', { keyPath: 'id' });
            hazardStore.createIndex('by-date', 'createdAt');
            hazardStore.createIndex('by-type', 'hazardType');
          }

          if (!db.objectStoreNames.contains('rider')) {
            db.createObjectStore('rider', { keyPath: 'id' });
          }

          if (!db.objectStoreNames.contains('syncQueue')) {
            const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
            queueStore.createIndex('by-date', 'timestamp');
          }
        }

        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('media')) {
            const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
            mediaStore.createIndex('by-date', 'createdAt');
          }
        }
      },
    });
  }
  return dbPromise;
}

// Media Operations (Quick Camera Capture)
export async function saveTrailMedia(item: any): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.put('media', item);
}

export async function getAllTrailMedia(): Promise<any[]> {
  const db = await getDatabase();
  if (!db) return [];
  return db.getAllFromIndex('media', 'by-date');
}

export async function deleteTrailMedia(id: string): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.delete('media', id);
}

// Trail Operations
export async function saveTrail(trail: Trail): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.put('trails', trail);
}

export async function getAllTrails(): Promise<Trail[]> {
  const db = await getDatabase();
  if (!db) return [];
  return db.getAllFromIndex('trails', 'by-date');
}

export async function deleteTrail(id: string): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.delete('trails', id);
}

// Waypoint Operations
export async function saveWaypoint(waypoint: Waypoint): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.put('waypoints', waypoint);
}

export async function getAllWaypoints(): Promise<Waypoint[]> {
  const db = await getDatabase();
  if (!db) return [];
  return db.getAllFromIndex('waypoints', 'by-date');
}

export async function deleteWaypoint(id: string): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.delete('waypoints', id);
}

// Hazard Operations
export async function saveHazard(hazard: HazardReport): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.put('hazards', hazard);
}

export async function getAllHazards(): Promise<HazardReport[]> {
  const db = await getDatabase();
  if (!db) return [];
  return db.getAllFromIndex('hazards', 'by-date');
}

export async function deleteHazard(id: string): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.delete('hazards', id);
}

// Rider Profile Operations
export async function saveRiderProfile(rider: RiderProfile): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.put('rider', rider);
}

export async function getActiveRiderProfile(): Promise<RiderProfile | null> {
  const db = await getDatabase();
  if (!db) return null;
  const all = await db.getAll('rider');
  return all.length > 0 ? all[0] : null;
}

export async function clearRiderProfile(): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.clear('rider');
}

// Sync Queue Operations
export async function enqueueSync(item: SyncQueueItem): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.put('syncQueue', item);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  if (!db) return [];
  return db.getAllFromIndex('syncQueue', 'by-date');
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.delete('syncQueue', id);
}
