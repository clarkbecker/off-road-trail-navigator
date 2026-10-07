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

const WEBB_LAKE_WAY_GROUPS = [
  {
    name: 'Dogtown South Loop',
    wayIds: [831082205],
    systemName: "Webb Lake Men's Club Trails",
    desc: "Dogtown South Loop hiking & singletrack mountain biking trail in Burnett County Forest."
  },
  {
    name: 'Dogtown North Loop',
    wayIds: [831092564],
    systemName: "Webb Lake Men's Club Trails",
    desc: "Dogtown North Loop hiking & singletrack mountain biking trail in Burnett County Forest."
  },
  {
    name: 'Dogtown-Bear Lake Connector',
    wayIds: [831084743, 831085357],
    systemName: "Webb Lake Men's Club Trails",
    desc: "Connects Dogtown Cluster south to Big Bear Lake Loops across Burnett County Forest."
  },
  {
    name: 'Bear Lake Loops',
    wayIds: [831084744, 831092080, 831092081, 1065336509],
    systemName: "Webb Lake Men's Club Trails",
    desc: "Big Bear Lake scenic loops for hiking and mountain biking around Bear Lake."
  },
  {
    name: 'Webb Lake Section 36 Trail',
    wayIds: [1443566391, 1443566395],
    systemName: "Webb Lake Men's Club Trails",
    desc: "Section 36 wilderness hiking & biking corridor connecting through Burnett County Forest."
  },
  {
    name: 'Bear Lake / Dogtown Ridge Trail',
    wayIds: [831092086, 831092090],
    systemName: "Webb Lake Men's Club Trails",
    desc: "Rolling ridge singletrack section of the Webb Lake Men's Club trail network."
  },
  {
    name: "Webb Lake Bypass & Spurs",
    wayIds: [831092082, 831092083, 831092084, 831092085, 831092087],
    systemName: "Webb Lake Men's Club Trails",
    desc: "Scenic cutoff loops including Ann's Bypass and Jokerman Bypass in Webb Lake."
  }
];

async function main() {
  await client.connect();
  console.log("=== INGESTING WEBB LAKE MEN'S CLUB HIKING TRAILS ===");

  let totalInserted = 0;

  for (const group of WEBB_LAKE_WAY_GROUPS) {
    const allCoords = [];
    for (const wId of group.wayIds) {
      try {
        const url = `https://api.openstreetmap.org/api/0.6/way/${wId}/full.json`;
        const res = await fetch(url, { headers: { 'User-Agent': 'WebbLakeTrailNav/1.0' } });
        if (res.ok) {
          const d = await res.json();
          const way = d.elements.find(e => e.type === 'way');
          const nodeMap = new Map();
          for (const el of d.elements) if (el.type === 'node') nodeMap.set(el.id, [el.lon, el.lat]);
          const coords = way?.nodes?.map(nId => nodeMap.get(nId)).filter(Boolean);
          if (coords && coords.length > 1) {
            allCoords.push(...coords);
          }
        }
      } catch (err) {
        console.warn(`Could not fetch way ${wId}:`, err.message);
      }
    }

    if (allCoords.length >= 2) {
      const distKm = calculateDistance(allCoords);
      const geojson = JSON.stringify({ type: 'LineString', coordinates: allCoords });
      const extRef = `WEBB_CLUB_${group.wayIds[0]}`;

      await client.query(`DELETE FROM trails WHERE external_ref = $1;`, [extRef]);
      await client.query(`
        INSERT INTO trails (
          id, name, description, geom, route_type, official_status,
          visibility, cost_utv, cost_mtb, cost_hike, distance_km, difficulty,
          system_name, allowed_utv, allowed_atv,
          allowed_dirtbike, allowed_4x4, allowed_mtb, allowed_hiking,
          surface_type, is_public_road_route, external_ref, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          $1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
          'designated_trail', 'open', 'public', 1.0, 0.3, 0.3, $4, 'Moderate',
          $5, false, false,
          false, false, true, true,
          'dirt', false, $6, NOW(), NOW()
        );
      `, [
        group.name, group.desc, geojson, distKm,
        group.systemName, extRef
      ]);

      console.log(`✓ Inserted: ${group.name} (${distKm} km, ${allCoords.length} pts)`);
      totalInserted++;
    }
  }

  console.log(`=== Done! Inserted ${totalInserted} Webb Lake hiking trails ===`);
  await client.end();
}

main().catch(console.error);
