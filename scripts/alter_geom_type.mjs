import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Altering trails.geom to accept any LineString or MultiLineString...');
  await client.query(`
    ALTER TABLE trails ALTER COLUMN geom TYPE geometry(Geometry, 4326);
  `);
  console.log('Geometry column updated successfully!');
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
