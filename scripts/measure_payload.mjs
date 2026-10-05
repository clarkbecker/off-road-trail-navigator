import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function measurePayload() {
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

  const result = await client.query(query);

  const trails = result.rows.map((row) => {
    let points = [];
    try {
      const parsedGeo = JSON.parse(row.geojson);
      let coords = [];
      if (parsedGeo.type === 'LineString') {
        coords = parsedGeo.coordinates;
      } else if (parsedGeo.type === 'MultiLineString') {
        coords = parsedGeo.coordinates.flat(1);
      }
      points = coords.map((coord) => ({
        lng: coord[0],
        lat: coord[1],
        elevation: coord[2] || null,
        timestamp: Date.now(),
      }));
    } catch (e) {}

    return {
      id: row.id,
      name: row.name,
      points,
    };
  });

  const jsonStr = JSON.stringify({ trails });
  console.log(`Payload size: ${(jsonStr.length / 1024 / 1024).toFixed(2)} MB (${jsonStr.length} bytes)`);

  await client.end();
}

measurePayload().catch(console.error);
