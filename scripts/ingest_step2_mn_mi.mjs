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

// 1. Ingest MN DNR Border Trails (Nemadji, Gandy Dancer MN, Soo Line, St. Croix, Chengwatana, etc.)
async function ingestMinnesotaBorderTrails() {
  console.log('\n--- Ingesting Minnesota DNR Border Trails (Nemadji, Gandy Dancer MN, Soo Line, etc.) ---');
  const where = encodeURIComponent("trail_name LIKE '%Nemadji%' OR trail_name LIKE '%Gandy%' OR trail_name LIKE '%Soo Line%' OR trail_name LIKE '%St. Croix%' OR trail_name LIKE '%Snake%' OR trail_name LIKE '%General%' OR trail_name LIKE '%Chengwatana%' OR trail_name LIKE '%Solana%' OR trail_name LIKE '%Moose%' OR trail_name LIKE '%Carlton%' OR trail_name LIKE '%Pine%'");
  
  let offset = 0;
  const batchSize = 500;
  let totalInserted = 0;

  while (true) {
    const url = `https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/trans_ohv_trails_mn/FeatureServer/0/query?where=${where}&outFields=*&outSR=4326&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
    const res = await fetch(url);
    const data = await res.json();
    const features = data.features || [];
    if (features.length === 0) break;

    console.log(`Processing MN batch offset ${offset} (${features.length} features)...`);

    for (const f of features) {
      const attr = f.attributes;
      const paths = f.geometry?.paths;
      if (!paths || paths.length === 0) continue;

      const geojson = paths.length === 1
        ? { type: 'LineString', coordinates: paths[0] }
        : { type: 'MultiLineString', coordinates: paths };

      const distKm = attr.miles ? Number((attr.miles * 1.60934).toFixed(2)) : calculateDistance(paths[0]);
      if (distKm < 0.1) continue;

      const trailName = attr.segment_name
        ? `${attr.trail_name}: ${attr.segment_name}`
        : (attr.trail_name || `MN OHV Trail ${attr.objectid}`);

      const allowedUtv = Boolean(attr.atv_class_2 === 'X' || attr.off_road_vehicle === 'X');
      const allowedAtv = Boolean(attr.atv_class_1 === 'X' || attr.atv_class_2 === 'X');
      const allowedDirtbike = Boolean(attr.off_highway_motorcycle === 'X');
      const allowed4x4 = Boolean(attr.off_road_vehicle === 'X');
      const extRef = `MN_OHV_${attr.objectid}`;

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
            'designated_trail', 'open', 'public', 0.4, 0.8, 1.2, $4, 'Moderate',
            'mn-dnr', $5, $6, $7,
            $8, $9, true, true,
            $10, false, $11, NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `, [
          trailName,
          `Minnesota DNR State Forest OHV Trail. Surface: ${attr.surface_type || 'Natural'}. Width: ${attr.trail_width || 'Standard'}. Info: ${attr.web_site || 'https://www.dnr.state.mn.us/ohv/'}`,
          JSON.stringify(geojson),
          distKm,
          attr.trail_name || 'Minnesota State Forest OHV System',
          allowedUtv,
          allowedAtv,
          allowedDirtbike,
          allowed4x4,
          (attr.surface_type || 'dirt').toLowerCase().includes('gravel') ? 'gravel' : 'dirt',
          extRef
        ]);
        totalInserted++;
      } catch (err) {
        // Continue on individual errors
      }
    }

    offset += features.length;
    if (features.length < batchSize) break;
  }

  console.log(`✓ Inserted ${totalInserted} Minnesota border trails!`);
}

// 2. Ingest Michigan Western UP (Gogebic, Ontonagon, Iron, Houghton, Keweenaw, Baraga, Dickinson, Marquette)
async function ingestMichiganUpperPeninsula() {
  console.log('\n--- Ingesting Michigan Western UP Trails (MI DNR ORV Routes, Trails, Motorcycle, Railtrails) ---');
  const where = encodeURIComponent("County IN ('Gogebic', 'Ontonagon', 'Iron', 'Houghton', 'Keweenaw', 'Baraga', 'Dickinson', 'Marquette')");

  const layers = [
    { id: 11, name: 'ORV Route (UTV/4x4)', utv: true, atv: true, dirtbike: true, fourwd: true, mtb: true, hike: true, costUtv: 0.3 },
    { id: 12, name: 'ORV Trail (50" ATV)', utv: false, atv: true, dirtbike: true, fourwd: false, mtb: true, hike: true, costUtv: 99.0 },
    { id: 13, name: 'Motorcycle Singletrack', utv: false, atv: false, dirtbike: true, fourwd: false, mtb: true, hike: true, costUtv: 99.0 },
    { id: 16, name: 'Railtrail (Multi-use)', utv: false, atv: false, dirtbike: false, fourwd: false, mtb: true, hike: true, costUtv: 99.0 }
  ];

  let totalMi = 0;

  for (const layer of layers) {
    console.log(`Fetching MI Layer ${layer.id} (${layer.name})...`);
    let offset = 0;
    const batchSize = 500;

    while (true) {
      const url = `https://gisagodnr.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/${layer.id}/query?where=${where}&outFields=*&outSR=4326&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
      const res = await fetch(url);
      const data = await res.json();
      const features = data.features || [];
      if (features.length === 0) break;

      for (const f of features) {
        const attr = f.attributes;
        const paths = f.geometry?.paths;
        if (!paths || paths.length === 0) continue;

        const geojson = paths.length === 1
          ? { type: 'LineString', coordinates: paths[0] }
          : { type: 'MultiLineString', coordinates: paths };

        const distKm = attr.SegmentLengthMiles ? Number((attr.SegmentLengthMiles * 1.60934).toFixed(2)) : calculateDistance(paths[0]);
        if (distKm < 0.1) continue;

        const trailName = attr.TrailNamePrimary || attr.ORVRouteName || attr.RailGradeName || `MI Trail ${attr.OBJECTID}`;
        const isRoadRoute = attr.TrailOnRoad === 'County Road' || attr.TrailOnRoad === 'Yes';
        const officialStatus = (attr.OpenClosedStatusORV || 'Open').toLowerCase().includes('closed') ? 'closed' : 'open';
        const extRef = `MI_DNR_${layer.id}_${attr.OBJECTID}`;

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
              'designated_trail', $4, 'public', $5, 0.7, 1.0, $6, 'Moderate',
              'mi-dnr', $7, $8, $9,
              $10, $11, $12, $13,
              $14, $15, $16, NOW(), NOW()
            ) ON CONFLICT (id) DO NOTHING;
          `, [
            trailName,
            `Michigan DNR Designated ${layer.name}. County: ${attr.County}. Surface: ${attr.SurfaceType || 'Natural'}. Road Route: ${isRoadRoute ? 'Yes' : 'No'}.`,
            JSON.stringify(geojson),
            officialStatus,
            layer.costUtv,
            distKm,
            `Michigan DNR - ${attr.County} County Network`,
            layer.utv,
            layer.atv,
            layer.dirtbike,
            layer.fourwd,
            layer.mtb,
            layer.hike,
            (attr.SurfaceType || 'dirt').toLowerCase().includes('gravel') ? 'gravel' : 'dirt',
            isRoadRoute,
            extRef
          ]);
          totalMi++;
        } catch (err) {
          // Continue on individual errors
        }
      }

      offset += features.length;
      if (features.length < batchSize) break;
    }
  }

  console.log(`✓ Inserted ${totalMi} Michigan Western UP trails!`);
}

// 3. Ingest USFS Ottawa National Forest Motorized Corridors
async function ingestOttawaNationalForest() {
  console.log('\n--- Ingesting USFS Ottawa National Forest (Motorized Roads & Forest Trails) ---');
  let offset = 0;
  const batchSize = 500;
  let totalOttawa = 0;

  while (true) {
    const url = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/1/query?where=forestname%20LIKE%20%27%25Ottawa%25%27%20AND%20gis_miles%20%3E%200.2&outFields=*&outSR=4326&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
    const res = await fetch(url);
    const data = await res.json();
    const features = data.features || [];
    if (features.length === 0) break;

    console.log(`Processing Ottawa NF batch offset ${offset} (${features.length} features)...`);

    for (const f of features) {
      const attr = f.attributes;
      const paths = f.geometry?.paths;
      if (!paths || paths.length === 0) continue;

      const geojson = paths.length === 1
        ? { type: 'LineString', coordinates: paths[0] }
        : { type: 'MultiLineString', coordinates: paths };

      const distKm = attr.gis_miles ? Number((attr.gis_miles * 1.60934).toFixed(2)) : calculateDistance(paths[0]);
      if (distKm < 0.2) continue;

      const trailName = attr.name ? `FR ${attr.id}: ${attr.name}` : `Ottawa NF Forest Road ${attr.id || attr.objectid}`;
      const surface = (attr.surfacetype || '').toLowerCase().includes('paved') ? 'paved' : 'gravel';
      const extRef = `USFS_OTTAWA_${attr.objectid}`;

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
            'unmaintained_fire_road', 'open', 'public', 0.4, 0.8, 1.2, $4, 'Easy',
            'usfs-ottawa', 'Ottawa National Forest MVUM Network', $5,
            true, true, true, true, true, true,
            $6, false, $7, NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `, [
          trailName,
          `Designated Motorized Forest Service Route in Ottawa National Forest (MI UP). MVUM Symbol: ${attr.mvum_symbol_name || 'Forest Road'}. Maintenance Level: ${attr.operationalmaintlevel || 'Level 2'}.`,
          JSON.stringify(geojson),
          distKm,
          String(attr.id || ''),
          surface,
          extRef
        ]);
        totalOttawa++;
      } catch (err) {
        // Continue on individual errors
      }
    }

    offset += features.length;
    if (features.length < batchSize) break;
  }

  console.log(`✓ Inserted ${totalOttawa} Ottawa National Forest routes!`);
}

async function main() {
  await client.connect();
  console.log('=== STARTING STEP 2: MINNESOTA BORDER & MICHIGAN WESTERN UP INGESTION ===');

  await ingestMinnesotaBorderTrails();
  await ingestMichiganUpperPeninsula();
  await ingestOttawaNationalForest();

  const totalRes = await client.query('SELECT count(*) as total, count(distinct jurisdiction_id) as jurisdictions FROM trails;');
  console.log(`\n🎉 Step 2 Complete! Total trails now in database: ${totalRes.rows[0].total} across ${totalRes.rows[0].jurisdictions} jurisdictions!`);

  await client.end();
}

main().catch(err => {
  console.error('Fatal Step 2 error:', err);
  process.exit(1);
});
