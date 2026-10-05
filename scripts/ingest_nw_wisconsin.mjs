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

// 1. Ingest Official Bayfield County Forest Network
async function ingestBayfieldCounty() {
  console.log('\n--- 1. Ingesting Official Bayfield County Forest Network ---');
  const url = 'https://maps.bayfieldcounty.wi.gov/arcgis/rest/services/BayfieldCoZoneMapEB/MapServer/23/query?where=1=1&outFields=*&outSR=4326&f=json';
  const res = await fetch(url);
  const data = await res.json();
  const features = data.features || [];
  console.log(`Retrieved ${features.length} Bayfield County ATV trail features.`);

  let count = 0;
  for (const f of features) {
    const attr = f.attributes;
    const paths = f.geometry?.paths;
    if (!paths || paths.length === 0) continue;

    const geojson = paths.length === 1
      ? { type: 'LineString', coordinates: paths[0] }
      : { type: 'MultiLineString', coordinates: paths };

    const trailName = attr.Trl_Name
      ? (attr.Trl_Num ? `${attr.Trl_Name} (Trail ${attr.Trl_Num})` : attr.Trl_Name)
      : (attr.Trl_Num ? `Bayfield County Trail ${attr.Trl_Num}` : `Bayfield ATV Trail ${attr.OBJECTID}`);

    const distKm = attr.LENGTH ? Number((attr.LENGTH * 1.60934).toFixed(2)) : calculateDistance(paths[0]);

    try {
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
          'wi-bayfield-forestry', 'Bayfield County Forest Trail Network', $5,
          true, true, true, true, true, true,
          'dirt', false, $6, NOW(), NOW()
        );
      `, [
        trailName,
        `Official Bayfield County Forest ATV/UTV Trail. Corridor: ${attr.Corr_No || 'Main'} - ${attr.TrailClass || 'Class A'}`,
        JSON.stringify(geojson),
        distKm,
        attr.Trl_Num ? String(attr.Trl_Num) : null,
        `BAYFIELD_ATV_${attr.OBJECTID}`
      ]);
      count++;
    } catch (e) {
      console.warn(`Error on Bayfield feature ${attr.OBJECTID}:`, e.message);
    }
  }
  console.log(`✓ Inserted ${count} Bayfield County trails!`);
}

// 2. Ingest North Country & Ice Age National Scenic Trails (Hike / Run / Backpacking)
async function ingestNationalScenicTrails() {
  console.log('\n--- 2. Ingesting North Country & Ice Age National Scenic Hiking Trails ---');
  // Layers 2 and 3 from LF_DML/LF_DNR_REC_OPPS_WTM_Ext
  const trailsToFetch = [
    { layerId: 3, name: 'North Country National Scenic Trail', jurisdiction: 'wi-dnr' },
    { layerId: 2, name: 'Ice Age National Scenic Trail', jurisdiction: 'wi-dnr' },
  ];

  for (const t of trailsToFetch) {
    const url = `https://dnrmaps.wi.gov/arcgis/rest/services/LF_DML/LF_DNR_REC_OPPS_WTM_Ext/MapServer/${t.layerId}/query?where=1=1&outFields=*&outSR=4326&f=json`;
    const res = await fetch(url);
    const data = await res.json();
    const features = data.features || [];
    console.log(`Fetched ${features.length} features for ${t.name}.`);

    let segCount = 0;
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const paths = f.geometry?.paths;
      if (!paths || paths.length === 0) continue;

      const geojson = paths.length === 1
        ? { type: 'LineString', coordinates: paths[0] }
        : { type: 'MultiLineString', coordinates: paths };

      const distKm = calculateDistance(paths[0]);
      if (distKm < 0.2) continue; // skip tiny slivers

      try {
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
            'designated_trail', 'open', 'public', 99.0, 5.0, 0.2, $4, 'Moderate',
            $5, $1, false, false, false, false, false, true,
            'dirt', false, $6, NOW(), NOW()
          );
        `, [
          `${t.name} (Segment ${i + 1})`,
          `Official National Scenic Trail across Northern Wisconsin managed by National Park Service and Wisconsin DNR. Foot-travel and backpacking only.`,
          JSON.stringify(geojson),
          distKm,
          t.jurisdiction,
          `NST_${t.layerId}_${i + 1}`
        ]);
        segCount++;
      } catch (e) {
        // ignore duplicate
      }
    }
    console.log(`✓ Inserted ${segCount} segments for ${t.name}!`);
  }
}

// 3. Ingest Key Signature Corridors for Washburn, Douglas, Sawyer & Iron Counties
async function ingestSignatureNWTrails() {
  console.log('\n--- 3. Ingesting Washburn, Douglas, Sawyer & Iron County Signature Trails ---');

  // Direct OSM ways for famous NW Wisconsin signature trails
  const signatureRoutes = [
    // Washburn County Trail 8 Continuation (Minong to Trego / Spooner)
    {
      name: 'Washburn County Trail 8 (Minong to Trego)',
      systemName: 'Washburn County Forest',
      jurisdictionId: 'wi-washburn-forestry',
      trailNumber: '8',
      routeType: 'designated_trail',
      difficulty: 'Easy',
      surfaceType: 'gravel',
      description: 'Washburn County Trail 8. Connects seamlessly with Burnett County Trail 8 East, running past Minong and Trego down toward Spooner.',
      wayIds: [21447179, 1431825555]
    },
    // Douglas County Moose River Trail (Trail 35)
    {
      name: 'Douglas County Moose River Trail (Trail 35)',
      systemName: 'Douglas County Forest',
      jurisdictionId: 'wi-douglas-forestry',
      trailNumber: '35',
      routeType: 'designated_trail',
      difficulty: 'Moderate',
      surfaceType: 'dirt',
      description: 'Douglas County Moose River Trail. Premier county forest motorized trail traversing Dairyland and Moose Junction south of Superior.',
      wayIds: [21450086, 1445229171]
    },
    // Sawyer County Dead Horse Run Trail
    {
      name: 'Dead Horse Run Trail (Sawyer County)',
      systemName: 'Sawyer County Forest / Chequamegon',
      jurisdictionId: 'wi-sawyer-forestry',
      trailNumber: 'DHR',
      routeType: 'designated_trail',
      difficulty: 'Difficult',
      surfaceType: 'rock_slickrock',
      description: 'Iconic Dead Horse Run Trail in Sawyer and Ashland counties. 56 miles of rugged, rocky, and rolling glacial terrain through dense hardwoods.',
      wayIds: [21444059]
    },
    // Iron County Flambeau Trail System (Hurley / Mercer)
    {
      name: 'Iron County Flambeau Trail (Trail 17)',
      systemName: 'Iron County Forest',
      jurisdictionId: 'wi-iron-forestry',
      trailNumber: '17',
      routeType: 'designated_trail',
      difficulty: 'Moderate',
      surfaceType: 'gravel',
      description: 'Iron County Forest Trail 17 (Flambeau Trail). Major northern artery connecting Mercer and Hurley across the Penokee Range and Gile Flowage.',
      wayIds: [1431825559, 1431825562]
    }
  ];

  for (const r of signatureRoutes) {
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
      } catch (e) {}
    }

    if (allCoords.length > 2) {
      const distKm = calculateDistance(allCoords);
      const geojson = JSON.stringify({ type: 'LineString', coordinates: allCoords });
      await client.query(`DELETE FROM trails WHERE name = $1;`, [r.name]);
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
          $10, false, NOW(), NOW()
        );
      `, [
        r.name, r.description, geojson, r.routeType, distKm, r.difficulty,
        r.jurisdictionId, r.systemName, r.trailNumber, r.surfaceType
      ]);
      console.log(`✓ Inserted: ${r.name} (${distKm} km)`);
    }
  }
}

async function main() {
  await client.connect();
  console.log('=== STARTING NW WISCONSIN INGESTION (STEP 1) ===');

  await ingestBayfieldCounty();
  await ingestNationalScenicTrails();
  await ingestSignatureNWTrails();

  const totalRes = await client.query('SELECT count(*) FROM trails;');
  console.log(`\n🎉 Step 1 Complete! Total trails now in database: ${totalRes.rows[0].count}`);

  await client.end();
}

main().catch(err => {
  console.error('Fatal Step 1 error:', err);
  process.exit(1);
});
