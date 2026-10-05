import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function addConnectingRoutes() {
  await client.connect();

  // Search OSM for CTH H ways between 45.96 and 46.05
  // We can query OSM Overpass or direct ways
  console.log('Querying CTH H connector ways...');
  const query = `[out:json][timeout:25];
way["ref"="CTH H"](45.96,-92.16,46.05,-92.08);
out geom;
`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TrailNavDanbury/1.0' },
    body: 'data=' + encodeURIComponent(query),
  });

  const text = await res.text();
  if (text.startsWith('{')) {
    const data = JSON.parse(text);
    const ways = data.elements || [];
    console.log(`Found ${ways.length} segments for CTH H.`);

    for (let i = 0; i < ways.length; i++) {
      const w = ways[i];
      if (!w.geometry || w.geometry.length < 2) continue;
      const coords = w.geometry.map(pt => [pt.lon, pt.lat]);
      const geojson = JSON.stringify({ type: 'LineString', coordinates: coords });

      await client.query(`
        INSERT INTO trails (
          id, name, description, geom, route_type, official_status, visibility,
          cost_utv, cost_mtb, cost_hike, distance_km, difficulty,
          jurisdiction_id, system_name, trail_number, allowed_utv, allowed_atv,
          allowed_dirtbike, allowed_4x4, allowed_mtb, allowed_hiking,
          surface_type, is_public_road_route, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          $1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
          'road_route', 'open', 'public', 0.2, 0.8, 1.5, 2.5, 'Easy',
          'wi-burnett-forestry', 'Burnett County ATV/UTV Road Routes', 'CTH-H',
          true, true, true, true, true, false,
          'paved_road_route', true, NOW(), NOW()
        )
      `, [
        `CTH H Connecting Route (Segment ${i + 1})`,
        'Designated Burnett County ATV/UTV Road Route on County Highway H connecting Nicaboyne Lake, Webb Lake, Trail 7, and Trail 8.',
        geojson
      ]);
    }
    console.log(`Successfully added CTH H connecting segments!`);
  } else {
    console.warn('Overpass returned non-JSON for CTH H, skipping CTH H addition for now.');
  }

  await client.end();
}

addConnectingRoutes().catch(console.error);
