import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
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

async function updateDanburyTrail8West() {
  await client.connect();

  const wayIds = [
    824017910, 824017911, 416775412, 1445229171, 1445229172, 926883166, // Downtown Danbury departure
    21450086, 21449259, 21448722 // Swiss Fire Lane, Carters Bridge, Briggs Lake
  ];

  let totalCoords = [];
  for (const wId of wayIds) {
    const url = `https://api.openstreetmap.org/api/0.6/way/${wId}/full.json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TrailNavDanbury/1.0' } });
    const data = await res.json();
    const way = data.elements.find(e => e.type === 'way');
    const nodeMap = new Map();
    for (const el of data.elements) {
      if (el.type === 'node') nodeMap.set(el.id, [el.lon, el.lat]);
    }
    const coords = way.nodes.map(nId => nodeMap.get(nId)).filter(Boolean);
    totalCoords.push(...coords);
  }

  const distKm = calculateDistance(totalCoords);
  const geojson = JSON.stringify({
    type: 'LineString',
    coordinates: totalCoords
  });

  await client.query(`DELETE FROM trails WHERE name ILIKE '%Trail 8 West%';`);

  await client.query(`
    INSERT INTO trails (
      id, name, description, geom, route_type, official_status,
      visibility, cost_utv, cost_mtb, cost_hike, distance_km, difficulty,
      jurisdiction_id, system_name, trail_number, allowed_utv, allowed_atv,
      allowed_dirtbike, allowed_4x4, allowed_mtb, allowed_hiking,
      surface_type, is_public_road_route, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'Burnett County Trail 8 West',
      'Burnett County Forest UTV/ATV Trail 8 West. Starts in downtown Danbury off the Gandy Dancer State Trail and Highway 77, heading East along the Yellow River corridor across Swiss Fire Lane, Carters Bridge Road, and Briggs Lake Road.',
      ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
      'designated_trail', 'open', 'public', 0.3, 0.7, 1.0, $2, 'Easy',
      'wi-burnett-forestry', 'Burnett County Forest', '8W',
      true, true, true, true, true, true,
      'dirt', false, NOW(), NOW()
    );
  `, [geojson, distKm]);

  console.log(`✓ Updated Burnett County Trail 8 West starting directly in Danbury! (${distKm} km, ${totalCoords.length} points)`);
  await client.end();
}

updateDanburyTrail8West().catch(console.error);
