import pg from 'pg';
const { Client } = pg;

process.loadEnvFile('.env.local');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

// Complete corridor sequence from Wild Rivers Trail in Minong to Hayward / Nelson Lake:
// 1. Minong Town connection: 5th Ave & Frog Creek Road
// 2. Colton Road / Poppleshoot Fire Lane
// 3. Wozny Road corridor
// 4. Duck Pond Road & Tagalder Trail into Nelson Lake / Hayward
const poppleshootWays = [
  // Minong east out of Wild Rivers Trail
  21632095, 21627630, 21637310, 21635956,
  // Colton Road / Poppleshoot Fire Lane
  21631772, 635897341, 635897342,
  // Wozny Road corridor through Washburn County Forest
  21630441, 1085685387, 1085685388,
  // Duck Pond Road entering Sawyer County
  21630776, 21597015, 21597006,
  // Tagalder Trail into Nelson Lake & Hayward
  21598806, 1086809311
];

async function main() {
  await client.connect();
  console.log('=== INGESTING POPPLESHOOT TRAIL (MINONG TO HAYWARD) ===');

  let allCoords = [];
  for (const wId of poppleshootWays) {
    try {
      const url = `https://api.openstreetmap.org/api/0.6/way/${wId}/full.json`;
      const res = await fetch(url, { headers: { 'User-Agent': 'TrailNavDanbury/1.0' } });
      if (res.ok) {
        const d = await res.json();
        const way = d.elements.find(e => e.type === 'way');
        const nodeMap = new Map();
        for (const el of d.elements) if (el.type === 'node') nodeMap.set(el.id, [el.lon, el.lat]);
        const coords = way?.nodes?.map(nId => nodeMap.get(nId)).filter(Boolean);
        if (coords) {
          // If first point is closer to current end than last point, keep order, else reverse
          if (allCoords.length > 0 && coords.length > 1) {
            const last = allCoords[allCoords.length - 1];
            const d1 = Math.hypot(coords[0][0] - last[0], coords[0][1] - last[1]);
            const d2 = Math.hypot(coords[coords.length - 1][0] - last[0], coords[coords.length - 1][1] - last[1]);
            if (d2 < d1) coords.reverse();
          }
          allCoords.push(...coords);
        }
      }
    } catch (e) {
      console.warn(`Error on way ${wId}:`, e.message);
    }
  }

  console.log(`Retrieved ${allCoords.length} total coordinates for Poppleshoot corridor.`);
  const distKm = calculateDistance(allCoords);
  console.log(`Calculated distance: ${distKm} km (~${(distKm * 0.621371).toFixed(1)} miles).`);

  const geojson = JSON.stringify({ type: 'LineString', coordinates: allCoords });

  await client.query(`DELETE FROM trails WHERE name ILIKE '%Poppleshoot%';`);

  await client.query(`
    INSERT INTO trails (
      id, name, description, geom, route_type, official_status,
      visibility, cost_utv, cost_mtb, cost_hike, distance_km, difficulty,
      jurisdiction_id, system_name, trail_number, allowed_utv, allowed_atv,
      allowed_dirtbike, allowed_4x4, allowed_mtb, allowed_hiking,
      surface_type, is_public_road_route, external_ref, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      $1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
      'designated_trail', 'open', 'public', 0.3, 0.7, 1.0, $4, 'Moderate',
      'wi-washburn-forestry', 'Washburn County & Sawyer County Forest Trails', 'PS',
      true, true, true, true, true, true,
      'gravel', false, 'WASHBURN_SAWYER_POPPLESHOOT', NOW(), NOW()
    );
  `, [
    'Poppleshoot Trail (Minong to Hayward)',
    'Premier motorized corridor connecting the Wild Rivers State Trail in Minong directly east through Washburn County Forest (Colton Rd, Poppleshoot Fire Lane, Wozny Rd) and Sawyer County (Duck Pond Rd, Tagalder Trail) to Nelson Lake and Hayward.',
    geojson,
    distKm
  ]);

  console.log('✓ Successfully inserted Poppleshoot Trail into PostGIS database!');

  const check = await client.query(`
    SELECT name, distance_km, system_name, jurisdiction_id, allowed_utv, allowed_atv, allowed_mtb, allowed_hiking
    FROM trails
    WHERE name ILIKE '%Poppleshoot%';
  `);
  console.table(check.rows);

  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
