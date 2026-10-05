import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function findNearbyTrails() {
  await client.connect();
  // 2005 Sunnyside Rd / Nicaboyne Lake, Danbury/Webb Lake, WI: ~45.9865, -92.0802
  const lat = 45.9865;
  const lng = -92.0802;

  const res = await client.query(`
    SELECT 
      id, name, route_type, jurisdiction_id, official_status,
      ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1609.34 as distance_miles
    FROM trails
    WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 25000)
    ORDER BY distance_miles ASC
    LIMIT 25;
  `, [lng, lat]);

  console.log(`Found ${res.rows.length} trails within ~15 miles of Sunnyside Rd:`);
  for (const r of res.rows) {
    console.log(`- ${r.name} (${Number(r.distance_miles).toFixed(2)} mi away, ${r.route_type}, jurisdiction: ${r.jurisdiction_id})`);
  }

  // Also check if "Trail 8" or "Trail 7" exists anywhere in the database
  const searchRes = await client.query(`
    SELECT id, name, jurisdiction_id FROM trails WHERE name ILIKE '%Trail 8%' OR name ILIKE '%Trail 7%' OR name ILIKE '%Swiss Fire%';
  `);
  console.log(`\nTrails matching 'Trail 8' / 'Trail 7' / 'Swiss Fire' in entire DB (${searchRes.rows.length}):`);
  for (const r of searchRes.rows) {
    console.log(`* ${r.name} (jurisdiction: ${r.jurisdiction_id})`);
  }

  await client.end();
}

findNearbyTrails().catch(console.error);
