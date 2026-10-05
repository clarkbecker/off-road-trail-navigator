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

// 1. Ingest Iowa DOT & DNR State Trails Network (Bike / Hike / Multi-use)
async function ingestIowaStateTrails() {
  console.log('\n--- 1. Ingesting Iowa State Trails Network (Bike / Hike / Multi-use) ---');
  let offset = 0;
  const batchSize = 500;
  let totalIa = 0;

  while (true) {
    const url = `https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Trail_View/FeatureServer/0/query?where=LENGTH_MILE%20%3E%200.2&outFields=*&outSR=4326&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
    const res = await fetch(url);
    const data = await res.json();
    const features = data.features || [];
    if (features.length === 0) break;

    console.log(`Processing Iowa batch offset ${offset} (${features.length} features)...`);

    for (const f of features) {
      const attr = f.attributes;
      const paths = f.geometry?.paths;
      if (!paths || paths.length === 0) continue;

      const geojson = paths.length === 1
        ? { type: 'LineString', coordinates: paths[0] }
        : { type: 'MultiLineString', coordinates: paths };

      const distKm = attr.LENGTH_MILE ? Number((attr.LENGTH_MILE * 1.60934).toFixed(2)) : calculateDistance(paths[0]);
      if (distKm < 0.2) continue;

      const trailName = attr.FACILITY_NAME || attr.CORRIDOR || `Iowa Trail ${attr.OBJECTID}`;
      const surface = (attr.SURF_DESC || 'crushed stone').toLowerCase().includes('paved') || (attr.SURF_DESC || '').toLowerCase().includes('asphalt') ? 'paved' : 'gravel';
      const extRef = `IA_DOT_${attr.OBJECTID}`;

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
            'designated_trail', 'open', 'public', 99.0, 0.4, 0.4, $4, 'Easy',
            'ia-dnr', $5, false, false,
            false, false, true, true,
            $6, false, $7, NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `, [
          trailName,
          `Iowa State Multi-Use Trail. County: ${attr.COUNTY_NAME || 'Iowa'}. Surface: ${attr.SURF_DESC || 'Crushed Stone'}. Managed by: ${attr.OWNER_NAME || 'State/County'}.`,
          JSON.stringify(geojson),
          distKm,
          attr.CORRIDOR || 'Iowa State Trails Network',
          surface,
          extRef
        ]);
        totalIa++;
      } catch (err) {
        // Continue on individual errors
      }
    }

    offset += features.length;
    if (features.length < batchSize) break;
  }

  console.log(`✓ Inserted ${totalIa} Iowa State trails!`);
}

// 2. Ingest Shawnee National Forest Motorized Corridors (Southern Illinois)
async function ingestShawneeNationalForest() {
  console.log('\n--- 2. Ingesting Shawnee National Forest (Illinois) ---');
  let offset = 0;
  const batchSize = 500;
  let totalShawnee = 0;

  while (true) {
    const url = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/1/query?where=forestname%20LIKE%20%27%25Shawnee%25%27%20AND%20gis_miles%20%3E%200.2&outFields=*&outSR=4326&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
    const res = await fetch(url);
    const data = await res.json();
    const features = data.features || [];
    if (features.length === 0) break;

    console.log(`Processing Shawnee NF batch offset ${offset} (${features.length} features)...`);

    for (const f of features) {
      const attr = f.attributes;
      const paths = f.geometry?.paths;
      if (!paths || paths.length === 0) continue;

      const geojson = paths.length === 1
        ? { type: 'LineString', coordinates: paths[0] }
        : { type: 'MultiLineString', coordinates: paths };

      const distKm = attr.gis_miles ? Number((attr.gis_miles * 1.60934).toFixed(2)) : calculateDistance(paths[0]);
      if (distKm < 0.2) continue;

      const trailName = attr.name ? `FR ${attr.id}: ${attr.name}` : `Shawnee NF Forest Road ${attr.id || attr.objectid}`;
      const surface = (attr.surfacetype || '').toLowerCase().includes('paved') ? 'paved' : 'gravel';
      const extRef = `USFS_SHAWNEE_${attr.objectid}`;

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
            'usfs-shawnee', 'Shawnee National Forest MVUM Network', $5,
            true, true, true, true, true, true,
            $6, false, $7, NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `, [
          trailName,
          `Designated Motorized Forest Service Route in Shawnee National Forest (IL). MVUM Symbol: ${attr.mvum_symbol_name || 'Forest Road'}. Maintenance Level: ${attr.operationalmaintlevel || 'Level 2'}.`,
          JSON.stringify(geojson),
          distKm,
          String(attr.id || ''),
          surface,
          extRef
        ]);
        totalShawnee++;
      } catch (err) {
        // Continue on individual errors
      }
    }

    offset += features.length;
    if (features.length < batchSize) break;
  }

  console.log(`✓ Inserted ${totalShawnee} Shawnee National Forest routes!`);
}

// 3. Ingest USFS Forests for MN & MI (Superior, Chippewa, Hiawatha, Huron-Manistee)
async function ingestNationalForestCorridors(forestName, jurisdictionId, systemName, minMiles = 0.5) {
  console.log(`\n--- Ingesting ${systemName} (${forestName}) ---`);
  let offset = 0;
  const batchSize = 500;
  let count = 0;

  while (true) {
    const url = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/1/query?where=forestname%20LIKE%20%27%25${encodeURIComponent(forestName)}%25%27%20AND%20gis_miles%20%3E%20${minMiles}&outFields=*&outSR=4326&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
    const res = await fetch(url);
    const data = await res.json();
    const features = data.features || [];
    if (features.length === 0) break;

    console.log(`Processing ${forestName} batch offset ${offset} (${features.length} features)...`);

    for (const f of features) {
      const attr = f.attributes;
      const paths = f.geometry?.paths;
      if (!paths || paths.length === 0) continue;

      const geojson = paths.length === 1
        ? { type: 'LineString', coordinates: paths[0] }
        : { type: 'MultiLineString', coordinates: paths };

      const distKm = attr.gis_miles ? Number((attr.gis_miles * 1.60934).toFixed(2)) : calculateDistance(paths[0]);
      if (distKm < 0.2) continue;

      const trailName = attr.name ? `FR ${attr.id}: ${attr.name}` : `${forestName} Road ${attr.id || attr.objectid}`;
      const surface = (attr.surfacetype || '').toLowerCase().includes('paved') ? 'paved' : 'gravel';
      const extRef = `USFS_${jurisdictionId.toUpperCase()}_${attr.objectid}`;

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
            $5, $6, $7,
            true, true, true, true, true, true,
            $8, false, $9, NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `, [
          trailName,
          `Designated Motorized Forest Service Route in ${systemName}. MVUM Symbol: ${attr.mvum_symbol_name || 'Forest Road'}. Maintenance Level: ${attr.operationalmaintlevel || 'Level 2'}.`,
          JSON.stringify(geojson),
          distKm,
          jurisdictionId,
          systemName,
          String(attr.id || ''),
          surface,
          extRef
        ]);
        count++;
      } catch (err) {
        // Continue on individual errors
      }
    }

    offset += features.length;
    if (features.length < batchSize) break;
  }

  console.log(`✓ Inserted ${count} routes for ${systemName}!`);
}

async function main() {
  await client.connect();
  console.log('=== STARTING STEP 3: FIVE STATES EXPANSION (IA, IL, MN, MI) ===');

  await ingestIowaStateTrails();
  await ingestShawneeNationalForest();
  await ingestNationalForestCorridors('Superior', 'usfs-superior', 'Superior National Forest MVUM Network', 0.5);
  await ingestNationalForestCorridors('Chippewa', 'usfs-chippewa', 'Chippewa National Forest MVUM Network', 0.5);
  await ingestNationalForestCorridors('Hiawatha', 'usfs-hiawatha', 'Hiawatha National Forest MVUM Network', 0.5);
  await ingestNationalForestCorridors('Huron', 'usfs-huron-manistee', 'Huron-Manistee National Forests MVUM Network', 0.5);

  const totalRes = await client.query('SELECT count(*) as total, count(distinct jurisdiction_id) as jurisdictions FROM trails;');
  console.log(`\n🎉 Step 3 Complete! Total trails now in database: ${totalRes.rows[0].total} across ${totalRes.rows[0].jurisdictions} jurisdictions!`);

  await client.end();
}

main().catch(err => {
  console.error('Fatal Step 3 error:', err);
  process.exit(1);
});
