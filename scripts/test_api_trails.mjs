import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testApiOutput() {
  await client.connect();
  const res = await client.query(`
    SELECT t.name, t.route_type, COALESCE(j.current_status, t.official_status::text) as status, j.name as authority
    FROM trails t
    LEFT JOIN jurisdictions j ON t.jurisdiction_id = j.id
    WHERE t.name ILIKE '%Trail 8%' OR t.name ILIKE '%Trail 7%' OR t.name ILIKE '%Swiss%'
    ORDER BY t.name;
  `);

  console.log('Query result:');
  for (const r of res.rows) {
    console.log(`• ${r.name} | Status: ${r.status} | Authority: ${r.authority}`);
  }
  await client.end();
}

testApiOutput().catch(console.error);
