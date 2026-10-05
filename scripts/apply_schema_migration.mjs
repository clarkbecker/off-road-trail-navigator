import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to Supabase Postgres. Applying schema migration...');

  await client.query(`
    -- 1. Jurisdictions table
    CREATE TABLE IF NOT EXISTS jurisdictions (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      agency_level VARCHAR(32) NOT NULL, -- 'federal_usfs', 'federal_blm', 'federal_nps', 'state_dnr', 'county_forest', 'township', 'private_commercial', 'trail_club'
      state VARCHAR(2) NOT NULL,
      county_name VARCHAR(128),
      county_fips VARCHAR(5),
      condition_page_url TEXT,
      condition_feed_type VARCHAR(32) DEFAULT 'html_scrape',
      contact_phone VARCHAR(32),
      current_status VARCHAR(32) DEFAULT 'open', -- cascade status for all child trails
      current_status_reason VARCHAR(64),
      status_headline VARCHAR(255),
      status_updated_at TIMESTAMPTZ,
      last_scraped_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_jurisdictions_state ON jurisdictions(state);
    CREATE INDEX IF NOT EXISTS idx_jurisdictions_agency ON jurisdictions(agency_level);

    -- 2. Enhance trails table with FTGS & nationwide attributes
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS jurisdiction_id VARCHAR(64) REFERENCES jurisdictions(id) ON DELETE SET NULL;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS system_name VARCHAR(128);
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS trail_number VARCHAR(64);
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS max_utv_width_inches INT;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS allowed_utv BOOLEAN DEFAULT TRUE;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS allowed_atv BOOLEAN DEFAULT TRUE;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS allowed_dirtbike BOOLEAN DEFAULT TRUE;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS allowed_4x4 BOOLEAN DEFAULT FALSE;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS allowed_mtb BOOLEAN DEFAULT FALSE;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS allowed_ebike_classes INT[] DEFAULT '{}';
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS allowed_hiking BOOLEAN DEFAULT FALSE;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS allowed_equestrian BOOLEAN DEFAULT FALSE;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS surface_type VARCHAR(32) DEFAULT 'dirt';
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS is_public_road_route BOOLEAN DEFAULT FALSE;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS external_ref VARCHAR(128);
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS seasonal_open_date VARCHAR(5);
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS seasonal_close_date VARCHAR(5);
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS is_fee_required BOOLEAN DEFAULT FALSE;
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS pass_details TEXT;

    -- 3. Trail Status Logs table
    CREATE TABLE IF NOT EXISTS trail_status_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      jurisdiction_id VARCHAR(64) REFERENCES jurisdictions(id) ON DELETE CASCADE,
      trail_id UUID REFERENCES trails(id) ON DELETE CASCADE,
      status VARCHAR(32) NOT NULL, -- 'open', 'closed', 'caution_rough', 'seasonal_winter_only', 'seasonal_summer_only'
      reason VARCHAR(64), -- 'spring_breakup', 'mud_wet_weather', 'active_logging', 'washout_storm', 'snowmobile_groomed', 'fire_redflag', 'wildlife_calving'
      headline VARCHAR(255) NOT NULL,
      detailed_notes TEXT,
      source_url TEXT,
      effective_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      effective_end TIMESTAMPTZ,
      verified_by VARCHAR(32) DEFAULT 'official_scraper',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_trail_status_jurisdiction ON trail_status_logs(jurisdiction_id);
    CREATE INDEX IF NOT EXISTS idx_trail_status_trail ON trail_status_logs(trail_id);
    CREATE INDEX IF NOT EXISTS idx_trail_status_effective ON trail_status_logs(effective_start, effective_end);
  `);

  console.log('Schema migration applied successfully!');
  await client.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
