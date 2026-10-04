import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Trail, Waypoint } from '@/types/trail';

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
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'trailnav-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TrailNavDB>> | null = null;

export function getDatabase() {
  if (typeof window === 'undefined') return null;

  if (!dbPromise) {
    dbPromise = openDB<TrailNavDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('trails')) {
          const trailStore = db.createObjectStore('trails', { keyPath: 'id' });
          trailStore.createIndex('by-date', 'createdAt');
        }
        if (!db.objectStoreNames.contains('waypoints')) {
          const wpStore = db.createObjectStore('waypoints', { keyPath: 'id' });
          wpStore.createIndex('by-date', 'createdAt');
          wpStore.createIndex('by-category', 'category');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

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
