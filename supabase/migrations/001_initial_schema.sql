-- Enable PostGIS spatial database extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Table: riders (glove-friendly lightweight PIN auth)
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_rider_name UNIQUE (first_name, last_name)
);

-- 2. Route & Trail types
DO $$ BEGIN
  CREATE TYPE route_type_enum AS ENUM (
    'designated_trail',
    'unmaintained_fire_road',
    'street_legal_city',
    'prohibited',
    'user_submitted'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE trail_status_enum AS ENUM (
    'open',
    'closed',
    'caution'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE trail_visibility_enum AS ENUM (
    'private',
    'shared',
    'public'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Table: trails
CREATE TABLE IF NOT EXISTS trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  geom GEOMETRY(LineString, 4326) NOT NULL,
  route_type route_type_enum DEFAULT 'designated_trail',
  official_status trail_status_enum DEFAULT 'open',
  creator_id UUID REFERENCES riders(id) ON DELETE CASCADE,
  visibility trail_visibility_enum DEFAULT 'private',
  cost_utv NUMERIC DEFAULT 0.5,
  cost_mtb NUMERIC DEFAULT 1.0,
  cost_hike NUMERIC DEFAULT 1.5,
  distance_km NUMERIC,
  difficulty TEXT DEFAULT 'Moderate',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index spatial geometry for fast bounding box / viewport queries
CREATE INDEX IF NOT EXISTS trails_geom_idx ON trails USING GIST (geom);

-- 4. Table: trail_shares (maps which riders can see a shared trail)
CREATE TABLE IF NOT EXISTS trail_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_trail_share UNIQUE (trail_id, rider_id)
);

-- 5. Table: hazard_reports (rapid crowd-sourced hazard alerts)
DO $$ BEGIN
  CREATE TYPE hazard_type_enum AS ENUM (
    'tree_down',
    'washout_rut',
    'mud_flooded',
    'active_logging',
    'trail_impassable',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS hazard_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geom GEOMETRY(Point, 4326) NOT NULL,
  hazard_type hazard_type_enum NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  reported_by UUID REFERENCES riders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS hazards_geom_idx ON hazard_reports USING GIST (geom);

-- 6. Strict Row Level Security (RLS) Policies
ALTER TABLE trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

-- Trails RLS:
-- Public trails are visible to everyone
-- Private trails visible only to creator
-- Shared trails visible to riders in trail_shares
CREATE POLICY "View Access for Trails" ON trails FOR SELECT USING (
  visibility = 'public' 
  OR creator_id = auth.uid() 
  OR id IN (SELECT trail_id FROM trail_shares WHERE rider_id = auth.uid())
);

CREATE POLICY "Insert Access for Trails" ON trails FOR INSERT WITH CHECK (
  creator_id = auth.uid() OR auth.uid() IS NOT NULL
);

CREATE POLICY "Update Access for Trails" ON trails FOR UPDATE USING (
  creator_id = auth.uid()
);

-- Hazard Reports RLS: all active hazards viewable by riders
CREATE POLICY "View Access for Hazards" ON hazard_reports FOR SELECT USING (
  active = TRUE
);

CREATE POLICY "Insert Access for Hazards" ON hazard_reports FOR INSERT WITH CHECK (
  TRUE
);

-- Function: Simplify recorded GPS track coordinates before ingestion
CREATE OR REPLACE FUNCTION simplify_recorded_track(raw_geom GEOMETRY, tolerance_degrees DOUBLE PRECISION DEFAULT 0.00005)
RETURNS GEOMETRY AS $$
BEGIN
  RETURN ST_SimplifyPreserveTopology(raw_geom, tolerance_degrees);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
