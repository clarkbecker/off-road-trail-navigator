import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

// Helper to calculate total distance in km from [lng, lat] coords
function calculateDistance(coords) {
  let totalKm = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const lat1 = (coords[i][1] * Math.PI) / 180;
    const lat2 = (coords[i + 1][1] * Math.PI) / 180;
    const dLat = ((coords[i + 1][1] - coords[i][1]) * Math.PI) / 180;
    const dLng = ((coords[i + 1][0] - coords[i][0]) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += 6371 * c;
  }
  return Math.round(totalKm * 100) / 100;
}

// Fetch geometry directly from official OpenStreetMap API
async function fetchWayCoordinates(wayId) {
  try {
    const url = `https://api.openstreetmap.org/api/0.6/way/${wayId}/full.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TrailNavDanbury/1.0 (clark@trailnav.local)' }
    });
    if (!res.ok) {
      console.warn(`Way ${wayId} fetch returned status ${res.status}`);
      return [];
    }
    const data = await res.json();
    const way = data.elements.find(e => e.type === 'way');
    if (!way || !way.nodes) return [];

    const nodeMap = new Map();
    for (const el of data.elements) {
      if (el.type === 'node') {
        nodeMap.set(el.id, [el.lon, el.lat]);
      }
    }

    // Coordinates array: [ [lng, lat], [lng, lat], ... ]
    return way.nodes.map(nId => nodeMap.get(nId)).filter(Boolean);
  } catch (err) {
    console.warn(`Error fetching way ${wayId}:`, err.message);
    return [];
  }
}

const BURNETT_TRAILS = [
  {
    name: 'Burnett County Trail 8 West',
    trailNumber: '8W',
    systemName: 'Burnett County Forest',
    jurisdictionId: 'wi-burnett-forestry',
    routeType: 'designated_trail',
    difficulty: 'Easy',
    surfaceType: 'dirt',
    description: 'Burnett County Forest UTV/ATV Trail 8 West. Core east-west motorized corridor across Swiss Fire Lane, Carters Bridge Road, and Briggs Lake Road in the Town of Swiss near Danbury.',
    wayIds: [21450086, 21449259, 21448722],
    isPublicRoadRoute: false
  },
  {
    name: 'Burnett County Trail 8 East',
    trailNumber: '8E',
    systemName: 'Burnett County Forest',
    jurisdictionId: 'wi-burnett-forestry',
    routeType: 'designated_trail',
    difficulty: 'Moderate',
    surfaceType: 'sand',
    description: 'Burnett County Forest UTV/ATV Trail 8 East. Primary motorized corridor running past Lake 26 through Burnett County Forest towards Webb Lake and connecting with Washburn County Trail 8.',
    wayIds: [21447179],
    isPublicRoadRoute: false
  },
  {
    name: 'Burnett County Trail 7',
    trailNumber: '7',
    systemName: 'Burnett County Forest',
    jurisdictionId: 'wi-burnett-forestry',
    routeType: 'designated_trail',
    difficulty: 'Easy',
    surfaceType: 'gravel',
    description: 'Burnett County Forest UTV/ATV Trail 7. State-funded motorized trail traversing the Frog Lake Road corridor in the Town of Swiss and Webb Lake area heading towards Namekagon Barrens.',
    wayIds: [21450526, 1058738256],
    isPublicRoadRoute: false
  },
  {
    name: 'Burnett County Trail 7B',
    trailNumber: '7B',
    systemName: 'Burnett County Forest',
    jurisdictionId: 'wi-burnett-forestry',
    routeType: 'designated_trail',
    difficulty: 'Easy',
    surfaceType: 'gravel',
    description: 'Burnett County Trail 7B. Connector spur linking Trail 7 along Webb Creek Drive into the Town of Webb Lake and county forest staging access.',
    wayIds: [21450441],
    isPublicRoadRoute: false
  },
  {
    name: 'Swiss Fire Lane',
    trailNumber: 'FR-SWISS',
    systemName: 'Burnett County Forest Fire Roads',
    jurisdictionId: 'wi-burnett-forestry',
    routeType: 'unmaintained_fire_road',
    difficulty: 'Moderate',
    surfaceType: 'sand',
    description: 'Historic Swiss Fire Lane in northern Burnett County Forest. Rustic unmaintained sand/dirt forest track open to UTVs, ATVs, and high-clearance vehicles.',
    wayIds: [21450086],
    isPublicRoadRoute: false
  },
  {
    name: 'Burnett County Trail 45 North',
    trailNumber: '45N',
    systemName: 'Burnett County Forest',
    jurisdictionId: 'wi-burnett-forestry',
    routeType: 'designated_trail',
    difficulty: 'Moderate',
    surfaceType: 'dirt',
    description: 'Burnett County Forest Trail 45 North. Core north-south motorized multi-use corridor running through central Burnett County Forest.',
    wayIds: [1431825555, 1431825559, 1431825562],
    isPublicRoadRoute: false
  },
  {
    name: 'Burnett County Trail 41 North',
    trailNumber: '41N',
    systemName: 'Burnett County Forest',
    jurisdictionId: 'wi-burnett-forestry',
    routeType: 'designated_trail',
    difficulty: 'Moderate',
    surfaceType: 'dirt',
    description: 'Burnett County Forest Trail 41 North. Scenic motorized trail near Namekagon Barrens State Wildlife Area.',
    wayIds: [21444059],
    isPublicRoadRoute: false
  },
  {
    name: 'Burnett County Trail 151 (Springbrook)',
    trailNumber: '151',
    systemName: 'Burnett County Forest',
    jurisdictionId: 'wi-burnett-forestry',
    routeType: 'designated_trail',
    difficulty: 'Easy',
    surfaceType: 'gravel',
    description: 'Burnett County Trail 151 / Springbrook Trail. Connects Big Island Road and eastern Burnett forest tracts.',
    wayIds: [1478698397],
    isPublicRoadRoute: false
  }
];

async function main() {
  await client.connect();
  console.log('Connecting to PostGIS and ingesting Burnett County trails...');

  for (const t of BURNETT_TRAILS) {
    console.log(`\nFetching geometry for ${t.name}...`);
    const allCoords = [];

    for (const wId of t.wayIds) {
      const coords = await fetchWayCoordinates(wId);
      console.log(`  Way ${wId}: got ${coords.length} coordinates`);
      if (coords.length > 0) {
        allCoords.push(...coords);
      }
      // Small pause to be polite to OSM
      await new Promise(r => setTimeout(r, 200));
    }

    if (allCoords.length < 2) {
      console.warn(`Insufficient points for ${t.name}, skipping.`);
      continue;
    }

    const distKm = calculateDistance(allCoords);
    const lineStringGeoJson = JSON.stringify({
      type: 'LineString',
      coordinates: allCoords,
    });

    // Delete existing with same name if any
    await client.query(`DELETE FROM trails WHERE name = $1;`, [t.name]);

    // Insert with FTGS fields & Burnett County Forestry jurisdiction
    await client.query(`
      INSERT INTO trails (
        id, name, description, geom, route_type, official_status,
        visibility, cost_utv, cost_mtb, cost_hike, distance_km, difficulty,
        jurisdiction_id, system_name, trail_number, allowed_utv, allowed_atv,
        allowed_dirtbike, allowed_4x4, allowed_mtb, allowed_hiking,
        surface_type, is_public_road_route, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        $1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
        $4, 'open', 'public', 0.3, 0.7, 1.0, $5, $6,
        $7, $8, $9, true, true, true, true, true, true,
        $10, $11, NOW(), NOW()
      );
    `, [
      t.name,
      t.description,
      lineStringGeoJson,
      t.routeType,
      distKm,
      t.difficulty,
      t.jurisdictionId,
      t.systemName,
      t.trailNumber,
      t.surfaceType,
      t.isPublicRoadRoute
    ]);

    console.log(`✓ Inserted: ${t.name} (${distKm} km, ${allCoords.length} pts)`);
  }

  const countRes = await client.query('SELECT count(*) FROM trails WHERE jurisdiction_id = $1;', ['wi-burnett-forestry']);
  console.log(`\n🎉 Ingest complete! Total Burnett County trails now in DB: ${countRes.rows[0].count}`);
  await client.end();
}

main().catch(err => {
  console.error('Ingest error:', err);
  process.exit(1);
});
