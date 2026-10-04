import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres';

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
