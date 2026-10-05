import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function inspectTrail8Geom() {
  await client.connect();

  const res = await client.query(`
    SELECT name, ST_AsGeoJSON(geom) as geojson, distance_km
    FROM trails
    WHERE name ILIKE '%Trail 8%' OR name ILIKE '%Swiss Fire%';
  `);

  for (const r of res.rows) {
    const geo = JSON.parse(r.geojson);
    const coords = geo.coordinates;
    const start = coords[0];
    const end = coords[coords.length - 1];
    console.log(`\nTrail: ${r.name} (${r.distance_km} km, ${coords.length} pts)`);
    console.log(`  Start: [lat: ${start[1]}, lng: ${start[0]}]`);
    console.log(`  End:   [lat: ${end[1]}, lng: ${end[0]}]`);
  }

  await client.end();
}

inspectTrail8Geom().catch(console.error);
