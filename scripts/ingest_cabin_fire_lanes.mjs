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

const localFireRoutes = [
  {
    name: 'Balsam Fire Lane',
    systemName: 'Burnett County Forest Fire Roads',
    jurisdictionId: 'wi-burnett-forestry',
    surface: 'sand',
    wayIds: [1058395166],
    desc: 'Burnett County Forest fire road running north of Sunnyside Rd and Webb Lake.'
  },
  {
    name: 'Conroy Fire Lane',
    systemName: 'Burnett County Forest Fire Roads',
    jurisdictionId: 'wi-burnett-forestry',
    surface: 'sand',
    wayIds: [21453743],
    desc: 'Unmaintained forest fire road in Burnett County Forest south of Hwy 77.'
  },
  {
    name: 'Howard Fire Lane',
    systemName: 'Burnett County Forest Fire Roads',
    jurisdictionId: 'wi-burnett-forestry',
    surface: 'sand',
    wayIds: [21451393],
    desc: 'Burnett County Forest fire break road near Swiss & Webb Lake.'
  },
  {
    name: 'Phelps Fire Lane',
    systemName: 'Burnett County Forest Fire Roads',
    jurisdictionId: 'wi-burnett-forestry',
    surface: 'sand',
    wayIds: [21453788],
    desc: 'Burnett County Forest fire lane off the Swiss Fire Lane corridor.'
  },
  {
    name: 'Thorton Fire Lane',
    systemName: 'Burnett County Forest Fire Roads',
    jurisdictionId: 'wi-burnett-forestry',
    surface: 'sand',
    wayIds: [21449099],
    desc: 'Forestry fire lane traversing Burnett County Forest timberlands.'
  },
  {
    name: 'CCC Road (Burnett County Forest)',
    systemName: 'Burnett County Forest Fire Roads',
    jurisdictionId: 'wi-burnett-forestry',
    surface: 'gravel',
    wayIds: [21453919, 21453924],
    desc: 'Historic Civilian Conservation Corps forest road and primary fire break route.'
  },
  {
    name: 'Flowage Drive (Burnett County)',
    systemName: 'Burnett County Forest Fire Roads',
    jurisdictionId: 'wi-burnett-forestry',
    surface: 'sand',
    wayIds: [21449970],
    desc: 'Forest road providing access along water management flowages in Burnett County.'
  },
  {
    name: 'West Minerva Dam Road',
    systemName: 'Burnett County Forest Fire Roads',
    jurisdictionId: 'wi-burnett-forestry',
    surface: 'gravel',
    wayIds: [21448367],
    desc: 'Access road connecting Minerva flowage and Burnett County forest trails.'
  },
  {
    name: 'Whale Lake Spur',
    systemName: 'Washburn County Forest Fire Roads',
    jurisdictionId: 'wi-washburn-forestry',
    surface: 'dirt',
    wayIds: [1419376150],
    desc: 'Washburn County Forest logging and fire road spur off Minong Flowage corridor.'
  },
  {
    name: 'CCC Road (Washburn County Forest)',
    systemName: 'Washburn County Forest Fire Roads',
    jurisdictionId: 'wi-washburn-forestry',
    surface: 'gravel',
    wayIds: [21637446, 21637448],
    desc: 'Historic CCC forest road traversing Washburn County Forest toward Minong.'
  },
  {
    name: 'Flowage Road (Minong / West Flowage)',
    systemName: 'Washburn County Forest Fire Roads',
    jurisdictionId: 'wi-washburn-forestry',
    surface: 'gravel',
    wayIds: [21636335, 704369008],
    desc: 'Flowage road corridor along Minong Flowage and Totagatic River.'
  },
  {
    name: 'Smith Bridge Road',
    systemName: 'Washburn County Forest Fire Roads',
    jurisdictionId: 'wi-washburn-forestry',
    surface: 'gravel',
    wayIds: [21627885, 21627892, 1419376144],
    desc: 'Washburn County Forest road corridor crossing Smith Bridge over Totagatic flowage.'
  }
];

async function main() {
  await client.connect();
  console.log('=== INGESTING CABIN FIRE LANES & FLOWAGE ROADS ===');

  let inserted = 0;
  for (const r of localFireRoutes) {
    let allCoords = [];
    for (const wId of r.wayIds) {
      try {
        const url = `https://api.openstreetmap.org/api/0.6/way/${wId}/full.json`;
        const res = await fetch(url, { headers: { 'User-Agent': 'TrailNavDanbury/1.0' } });
        if (res.ok) {
          const d = await res.json();
          const way = d.elements.find(e => e.type === 'way');
          const nodeMap = new Map();
          for (const el of d.elements) if (el.type === 'node') nodeMap.set(el.id, [el.lon, el.lat]);
          const coords = way?.nodes?.map(nId => nodeMap.get(nId)).filter(Boolean);
          if (coords) allCoords.push(...coords);
        }
      } catch (e) {
        console.warn(`Could not fetch way ${wId}:`, e.message);
      }
    }

    if (allCoords.length >= 2) {
      const distKm = calculateDistance(allCoords);
      const geojson = JSON.stringify({ type: 'LineString', coordinates: allCoords });
      await client.query(`DELETE FROM trails WHERE name = $1;`, [r.name]);
      await client.query(`
        INSERT INTO trails (
          id, name, description, geom, route_type, official_status,
          visibility, cost_utv, cost_mtb, cost_hike, distance_km, difficulty,
          jurisdiction_id, system_name, allowed_utv, allowed_atv,
          allowed_dirtbike, allowed_4x4, allowed_mtb, allowed_hiking,
          surface_type, is_public_road_route, external_ref, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          $1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
          'unmaintained_fire_road', 'open', 'public', 0.5, 0.9, 1.2, $4, 'Moderate',
          $5, $6, true, true,
          true, true, true, true,
          $7, false, $8, NOW(), NOW()
        );
      `, [
        r.name, r.desc, geojson, distKm,
        r.jurisdictionId, r.systemName, r.surface, `LOCAL_FIRE_${r.wayIds[0]}`
      ]);
      console.log(`✓ Inserted: ${r.name} (${distKm} km, ${allCoords.length} pts)`);
      inserted++;
    }
  }

  const total = await client.query('SELECT count(*) FROM trails WHERE route_type = \x27unmaintained_fire_road\x27;');
  console.log(`\n🎉 Ingestion complete! Total fire roads now in database: ${total.rows[0].count}`);

  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
