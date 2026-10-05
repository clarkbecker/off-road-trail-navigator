import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const res = await client.query(`SELECT count(*) as count FROM trails`);
  console.log('Trails row count:', res.rows[0].count);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
