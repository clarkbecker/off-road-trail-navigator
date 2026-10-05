import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function importUSFSChequamegonTrails() {
  await client.connect();
  console.log('Fetching Chequamegon-Nicolet designated motorized trails from USFS EDW...');

  // 1. Fetch Trails (Layer 2)
  const trailsUrl = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/2/query?where=forestname%20LIKE%20'%25Chequamegon%25'&outFields=id,name,forestname,districtname,gis_miles,atv,otherwheeled_ohv,motorcycle,seasonal,atv_datesopen&outSR=4326&f=json`;
  const tRes = await fetch(trailsUrl);
  const tData = await tRes.json();

  console.log(`Fetched ${tData.features?.length || 0} designated trails. Inserting into PostGIS...`);

  let trailCount = 0;
  for (const f of (tData.features || [])) {
    const attr = f.attributes;
    const paths = f.geometry?.paths;
    if (!paths || paths.length === 0) continue;

    const geojsonGeometry = paths.length === 1
      ? { type: 'LineString', coordinates: paths[0] }
      : { type: 'MultiLineString', coordinates: paths };

    const trailName = attr.name ? `${attr.name} (TR ${attr.id})` : `Chequamegon Trail ${attr.id}`;
    const allowedUtv = attr.otherwheeled_ohv === 'open';
    const allowedAtv = attr.atv === 'open';
    const allowedDirtbike = attr.motorcycle === 'open';

    try {
      await client.query(`
        INSERT INTO trails (
          id, name, description, geom, route_type, official_status, visibility,
          jurisdiction_id, system_name, trail_number, allowed_utv, allowed_atv,
          allowed_dirtbike, allowed_4x4, allowed_mtb, allowed_ebike_classes,
          allowed_hiking, surface_type, external_ref, difficulty, distance_km,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          $1,
          $2,
          ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
          'designated_trail',
          'open',
          'public',
          'usfs-chequamegon-nicolet',
          'Chequamegon-Nicolet National Forest',
          $4,
          $5, $6, $7, false, true, ARRAY[1], true,
          'dirt', $8, 'moderate', $9, NOW(), NOW()
        )
      `, [
        trailName,
        `USFS Motor Vehicle Use Map Trail. District: ${attr.districtname || 'Chequamegon-Nicolet'}. Open dates: ${attr.atv_datesopen || 'Seasonal'}`,
        JSON.stringify(geojsonGeometry),
        attr.id,
        allowedUtv,
        allowedAtv,
        allowedDirtbike,
        `USFS_MVUM_TR_${attr.id}`,
        attr.gis_miles ? Number((attr.gis_miles * 1.60934).toFixed(2)) : null
      ]);
      trailCount++;
    } catch (e) {
      console.warn(`Error on trail ${attr.id}:`, e.message);
    }
  }

  console.log(`Imported ${trailCount} designated Chequamegon trails!`);

  // 2. Fetch High-Use / Designated OHV Forest Roads (Layer 1)
  console.log('Fetching Chequamegon Forest Service OHV Roads (otherwheeled_ohv = open or atv = open)...');
  
  let roadOffset = 0;
  const pageSize = 500;
  let totalRoads = 0;

  while (true) {
    const roadsUrl = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/1/query?where=forestname%20LIKE%20'%25Chequamegon%25'%20AND%20(otherwheeled_ohv%3D'open'%20OR%20atv%3D'open')&outFields=id,name,forestname,districtname,gis_miles,surfacetype,atv,otherwheeled_ohv,highclearancevehicle,fourwd_gt50inches&outSR=4326&resultOffset=${roadOffset}&resultRecordCount=${pageSize}&f=json`;
    const rRes = await fetch(roadsUrl);
    const rData = await rRes.json();

    const features = rData.features || [];
    if (features.length === 0) break;

    for (const f of features) {
      const attr = f.attributes;
      const paths = f.geometry?.paths;
      if (!paths || paths.length === 0) continue;

      const geojsonGeometry = paths.length === 1
        ? { type: 'LineString', coordinates: paths[0] }
        : { type: 'MultiLineString', coordinates: paths };

      const roadName = attr.name ? `FR ${attr.id} - ${attr.name}` : `Forest Road ${attr.id}`;
      const allowedUtv = attr.otherwheeled_ohv === 'open';
      const allowedAtv = attr.atv === 'open';
      const allowed4x4 = attr.fourwd_gt50inches === 'open' || attr.highclearancevehicle === 'open';

      try {
        await client.query(`
          INSERT INTO trails (
            id, name, description, geom, route_type, official_status, visibility,
            jurisdiction_id, system_name, trail_number, allowed_utv, allowed_atv,
            allowed_dirtbike, allowed_4x4, allowed_mtb, allowed_ebike_classes,
            allowed_hiking, surface_type, external_ref, difficulty, distance_km,
            created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            $1,
            $2,
            ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
            'unmaintained_fire_road',
            'open',
            'public',
            'usfs-chequamegon-nicolet',
            'Chequamegon-Nicolet National Forest',
            $4,
            $5, $6, true, $7, true, ARRAY[1, 2], true,
            $8, $9, 'easy', $10, NOW(), NOW()
          )
        `, [
          roadName,
          `USFS Forest Service Road. District: ${attr.districtname || 'Chequamegon-Nicolet'}. Surface: ${attr.surfacetype || 'Gravel/Dirt'}`,
          JSON.stringify(geojsonGeometry),
          attr.id,
          allowedUtv,
          allowedAtv,
          allowed4x4,
          attr.surfacetype?.toLowerCase().includes('pave') ? 'paved_road_route' : 'gravel',
          `USFS_MVUM_RD_${attr.id}`,
          attr.gis_miles ? Number((attr.gis_miles * 1.60934).toFixed(2)) : null
        ]);
        totalRoads++;
      } catch (e) {
        // ignore duplicate external ref if any
      }
    }

    roadOffset += pageSize;
    console.log(`Processed batch up to offset ${roadOffset}, total roads imported so far: ${totalRoads}`);
    if (features.length < pageSize) break;
  }

  console.log(`Successfully completed Chequamegon ingestion! Trails: ${trailCount}, Forest Roads: ${totalRoads}`);
  await client.end();
}

importUSFSChequamegonTrails().catch(err => {
  console.error('USFS Import error:', err);
  process.exit(1);
});
