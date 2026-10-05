import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

// Known motorized multi-use state trails in Wisconsin
const MOTORIZED_STATE_TRAILS = new Set([
  'Gandy Dancer State Trail (North)',
  'Gandy Dancer State Trail (South)',
  'Tuscobia State Trail',
  'Wild Rivers State Trail',
  'Saunders State Trail',
  'Cattail State Trail',
  'Buffalo River State Trail',
  'Nicolet State Trail',
  'Oconto River State Trail',
  'Wolf River State Trail',
  'Pecatonica State Trail',
  'Hillsboro State Trail',
  'Newton Blackmour State Trail',
  'Eisenbahn State Trail'
]);

async function importWIDNRTrails() {
  await client.connect();
  console.log('Fetching all official Wisconsin State Trails from WI DNR ArcGIS REST...');

  const url = 'https://dnrmaps.wi.gov/arcgis/rest/services/PR_TRAILS/PR_STATE_TRAIL_DISS_WTM_Ext/MapServer/0/query?where=1=1&outFields=OBJECTID,PROP_NAME,INFO_URL&outSR=4326&f=json';
  const res = await fetch(url);
  const data = await res.json();

  if (!data.features || data.features.length === 0) {
    console.error('No features returned from WI DNR service');
    await client.end();
    return;
  }

  console.log(`Retrieved ${data.features.length} state trail features. Processing & inserting into Supabase...`);

  let importedCount = 0;

  for (const feature of data.features) {
    const { PROP_NAME, INFO_URL } = feature.attributes;
    const paths = feature.geometry?.paths;

    if (!paths || paths.length === 0) continue;

    const isMotorized = MOTORIZED_STATE_TRAILS.has(PROP_NAME);

    // Build GeoJSON LineString or MultiLineString
    let geojsonGeometry;
    if (paths.length === 1) {
      geojsonGeometry = {
        type: 'LineString',
        coordinates: paths[0]
      };
    } else {
      geojsonGeometry = {
        type: 'MultiLineString',
        coordinates: paths
      };
    }

    const geojsonStr = JSON.stringify(geojsonGeometry);

    try {
      await client.query(`
        INSERT INTO trails (
          id, name, description, geom, route_type, official_status, visibility,
          jurisdiction_id, system_name, allowed_utv, allowed_atv, allowed_dirtbike,
          allowed_4x4, allowed_mtb, allowed_ebike_classes, allowed_hiking,
          surface_type, is_public_road_route, external_ref, difficulty, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          $1,
          $2,
          ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
          $4,
          'open',
          'public',
          'wi-dnr',
          'Wisconsin State Trails System',
          $5, $6, $7, false, true, ARRAY[1, 2], true,
          $8, false, $9, 'easy', NOW(), NOW()
        )
      `, [
        PROP_NAME,
        `Official Wisconsin State Trail managed by WI DNR. ${INFO_URL || ''}`,
        geojsonStr,
        isMotorized ? 'designated_trail' : 'prohibited', // 'prohibited' motorized for foot/bike-only
        isMotorized, // allowed_utv
        isMotorized, // allowed_atv
        isMotorized, // allowed_dirtbike
        isMotorized ? 'crushed_limestone' : 'crushed_stone',
        `WIDNR_${feature.attributes.OBJECTID}`
      ]);

      importedCount++;
    } catch (err) {
      console.warn(`Error inserting ${PROP_NAME}:`, err.message);
    }
  }

  console.log(`Successfully imported ${importedCount} Wisconsin State Trails into PostGIS!`);
  await client.end();
}

importWIDNRTrails().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
