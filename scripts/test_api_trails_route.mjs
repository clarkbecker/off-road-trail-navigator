import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testTrailsRoute() {
  await client.connect();

  const query = `
    SELECT 
      t.id, 
      t.name, 
      t.description, 
      t.route_type as "routeType", 
      COALESCE(j.current_status, t.official_status::text, 'open') as "officialStatus",
      j.status_headline as "statusHeadline",
      j.current_status_reason as "statusReason",
      j.name as "jurisdictionName",
      t.system_name as "systemName",
      t.trail_number as "trailNumber",
      t.allowed_utv as "allowedUtv",
      t.allowed_atv as "allowedAtv",
      t.allowed_dirtbike as "allowedDirtbike",
      t.allowed_4x4 as "allowed4x4",
      t.allowed_mtb as "allowedMtb",
      t.allowed_hiking as "allowedHiking",
      t.max_utv_width_inches as "maxUtvWidthInches",
      t.surface_type as "surfaceType",
      t.is_public_road_route as "isPublicRoadRoute",
      t.visibility, 
      t.cost_utv as "costUtv", 
      t.cost_mtb as "costMtb", 
      t.cost_hike as "costHike", 
      t.distance_km as "distanceKm", 
      t.difficulty,
      ST_AsGeoJSON(t.geom) as geojson,
      extract(epoch from t.created_at) * 1000 as "createdAt"
    FROM trails t
    LEFT JOIN jurisdictions j ON t.jurisdiction_id = j.id
    WHERE t.visibility = 'public'
    ORDER BY t.created_at DESC;
  `;

  try {
    const result = await client.query(query);
    console.log(`Query returned ${result.rows.length} rows.`);

    let errorCount = 0;
    const parsedTrails = [];
    for (const row of result.rows) {
      try {
        const parsedGeo = JSON.parse(row.geojson);
        let coords = [];
        if (parsedGeo.type === 'LineString') {
          coords = parsedGeo.coordinates;
        } else if (parsedGeo.type === 'MultiLineString') {
          coords = parsedGeo.coordinates.flat(1);
        }
        parsedTrails.push({
          id: row.id,
          name: row.name,
          pointsCount: coords.length
        });
      } catch (err) {
        errorCount++;
      }
    }
    console.log(`Parsed trails successfully: ${parsedTrails.length}, errors: ${errorCount}`);

    // Check Trail 8 in parsed trails
    const trail8 = parsedTrails.filter(t => t.name.toLowerCase().includes('trail 8'));
    console.log('Trail 8 matches in API output:', trail8);

  } catch (err) {
    console.error('Query error:', err);
  }

  await client.end();
}

testTrailsRoute().catch(console.error);
