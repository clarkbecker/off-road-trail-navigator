import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function verifyAllTrailsNearCabin() {
  await client.connect();
  // 2005 Sunnyside Rd: ~45.9865, -92.0802
  const lat = 45.9865;
  const lng = -92.0802;

  const res = await client.query(`
    SELECT 
      id, name, route_type, jurisdiction_id, official_status,
      ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1609.34 as distance_miles
    FROM trails
    WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 25000)
    ORDER BY distance_miles ASC;
  `, [lng, lat]);

  console.log(`\n=== TRAILS CURRENTLY WITHIN 15 MILES OF CABIN (2005 Sunnyside Rd) ===`);
  for (const r of res.rows) {
    console.log(`• ${r.name}`);
    console.log(`  Distance: ${Number(r.distance_miles).toFixed(2)} miles | Type: ${r.route_type} | Status: ${r.officialStatus || r.official_status} | Authority: ${r.jurisdiction_id}`);
  }

  await client.end();
}

verifyAllTrailsNearCabin().catch(console.error);
