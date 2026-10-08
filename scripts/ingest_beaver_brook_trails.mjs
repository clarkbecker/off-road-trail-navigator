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

// Group into coherent named trail segments within Beaver Brook Wildlife Area
const BEAVER_BROOK_SEGMENTS = [
  {
    name: 'Beaver Brook Ski & Snowshoe Main Loop',
    wayIds: [167707019, 167707009, 167707008],
    desc: 'Main classic cross-country ski and snowshoe loop through rolling hardwoods and pine plantations, maintained by Spooner Glide & Stride.'
  },
  {
    name: 'Beaver Brook Creek & Springs Trail',
    wayIds: [525406195, 1342455581, 1342455582],
    desc: 'Scenic hiking and nature path following along Beaver Brook trout stream and restored spring ponds.'
  },
  {
    name: 'Beaver Brook Wildlife Area North Loop',
    wayIds: [439815882, 439815887, 439815875, 439815872, 439815873],
    desc: 'Northern wildlife management trail accessed via Wildlife Road off Hwy 253.'
  },
  {
    name: 'Beaver Brook Cranberry Springs Loop',
    wayIds: [439819238, 439819255, 439807480, 439807481],
    desc: 'Wooded trail loop accessed from Cranberry Drive parking lot on the west side of the wildlife area.'
  },
  {
    name: 'Beaver Brook Wetland Mitigation Boardwalk & Trails',
    wayIds: [440856837, 440862126, 440856843, 440856841, 440856842, 440856844],
    desc: 'Foot trails and wetland restoration viewing paths around Beaver Brook mitigation pools.'
  },
  {
    name: 'Beaver Brook Ski Spurs & Connectors',
    wayIds: [167707012, 167707013, 167707014, 167707015, 167707016, 167707017, 167707020],
    desc: 'Glide and Stride connector spurs connecting ridge and valley ski sections.'
  },
  {
    name: 'Beaver Brook Wildlife Access Corridor',
    wayIds: [215148601],
    desc: 'Historic railroad corridor trail crossing through Beaver Brook Wildlife Area.'
  }
];

async function main() {
  await client.connect();
  console.log('=== INGESTING BEAVER BROOK WILDLIFE AREA TRAILS ===');

  let totalInserted = 0;

  for (const seg of BEAVER_BROOK_SEGMENTS) {
    const allCoords = [];
    for (const wId of seg.wayIds) {
      try {
        const res = await fetch(`https://api.openstreetmap.org/api/0.6/way/${wId}/full.json`, {
          headers: { 'User-Agent': 'TrailNavBeaverBrook/1.0' }
        });
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
      } catch (e) {
        console.warn(`Error on way ${wId}:`, e.message);
      }
    }

    if (allCoords.length >= 2) {
      const distKm = calculateDistance(allCoords);
      const geojson = JSON.stringify({ type: 'LineString', coordinates: allCoords });
      const extRef = `BEAVER_BROOK_${seg.wayIds[0]}`;

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
          'designated_trail', 'open', 'public', 1.0, 0.8, 0.2, $4, 'Easy',
          'Beaver Brook Wildlife Area', false, false,
          false, false, false, true,
          'dirt', false, $5, NOW(), NOW()
        );
      `, [
        seg.name, seg.desc, geojson, distKm, extRef
      ]);

      console.log(`✓ Inserted: ${seg.name} (${distKm} km, ${allCoords.length} pts)`);
      totalInserted++;
    }
  }

  console.log(`=== Done! Inserted ${totalInserted} Beaver Brook Wildlife Area trails ===`);
  await client.end();
}

main().catch(console.error);
