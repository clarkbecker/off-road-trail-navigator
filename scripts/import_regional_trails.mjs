import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const projectId = 'udwdwmxtdmplxngovxxk';

async function getClient() {
  const client = new Client({
    host: 'aws-0-us-east-2.pooler.supabase.com',
    port: 6543,
    user: `postgres.${projectId}`,
    password: '33t1L$AzJpC45s',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

// Haversine distance calculator in km
function calculateDistance(coords) {
  let totalKm = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const lat1 = (coords[i][1] * Math.PI) / 180;
    const lat2 = (coords[i + 1][1] * Math.PI) / 180;
    const dLat = ((coords[i + 1][1] - coords[i][1]) * Math.PI) / 180;
    const dLng = ((coords[i + 1][0] - coords[i][0]) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += 6371 * c;
  }
  return Math.round(totalKm * 100) / 100;
}

// 1. Ingest Wisconsin DNR State Trails
async function importWisconsinDnr(client) {
  console.log('\n--- 1. Fetching Wisconsin DNR State Trails ---');
  const url =
    'https://dnrmaps.wi.gov/arcgis/rest/services/PR_TRAILS/PR_STATE_TRAIL_DISS_WTM_Ext/MapServer/0/query?where=1%3D1&outFields=*&f=geojson&outSR=4326';

  const res = await fetch(url);
  const data = await res.json();
  const features = data.features || [];
  console.log(`Retrieved ${features.length} state trails from Wisconsin DNR.`);

  let inserted = 0;
  for (const f of features) {
    const props = f.properties || {};
    const name = props.PROP_NAME || props.NAME || 'Wisconsin State Trail';
    const geom = f.geometry;

    if (!geom || !geom.coordinates || geom.coordinates.length < 2) continue;

    // Normalize MultiLineString to LineString if needed, or use first line
    let coords = geom.coordinates;
    if (geom.type === 'MultiLineString') {
      coords = geom.coordinates[0];
    }

    if (!coords || coords.length < 2) continue;

    const distKm = calculateDistance(coords);
    const lineStringGeoJson = JSON.stringify({
      type: 'LineString',
      coordinates: coords.map((c) => [c[0], c[1]]),
    });

    const query = `
      INSERT INTO trails (
        name, description, geom, route_type, official_status, 
        visibility, cost_utv, cost_mtb, cost_hike, distance_km, difficulty
      )
      VALUES (
        $1, $2, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)), 
        'designated_trail', 'open', 'public', 0.5, 0.8, 1.0, $4, 'Moderate'
      )
      ON CONFLICT DO NOTHING;
    `;

    try {
      await client.query(query, [
        name,
        `Wisconsin State Trail • ${props.PRIMARY_URL || 'DNR Managed'}`,
        lineStringGeoJson,
        distKm,
      ]);
      inserted++;
    } catch (err) {
      // skip individual line errors
    }
  }

  console.log(`Successfully ingested ${inserted} Wisconsin State Trails.`);
}

// 2. Ingest Michigan DNR ORV & Non-Motorized Trails
async function importMichiganDnr(client) {
  console.log('\n--- 2. Fetching Michigan DNR ORV & Recreational Trails ---');

  // Layer 11: ORV Routes (UTV routes)
  const orvUrl =
    'https://gisagodnr.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/11/query?where=1%3D1&outFields=TrailNamePrimary,SurfaceType,County,Peninsula,SegmentLengthMiles&outSR=4326&f=json&resultRecordCount=150';

  const res = await fetch(orvUrl);
  const data = await res.json();
  const features = data.features || [];
  console.log(`Retrieved ${features.length} Michigan ORV Routes.`);

  let inserted = 0;
  for (const f of features) {
    const attrs = f.attributes || {};
    const name = attrs.TrailNamePrimary || 'Michigan ORV Route';
    const paths = f.geometry?.paths || [];

    if (paths.length === 0 || paths[0].length < 2) continue;

    const coords = paths[0];
    const distKm = calculateDistance(coords);

    const lineStringGeoJson = JSON.stringify({
      type: 'LineString',
      coordinates: coords.map((c) => [c[0], c[1]]),
    });

    const county = attrs.County || 'Michigan';
    const peninsula = attrs.Peninsula || 'State Forest';
    const surface = attrs.SurfaceType || 'Natural Dirt';

    const query = `
      INSERT INTO trails (
        name, description, geom, route_type, official_status, 
        visibility, cost_utv, cost_mtb, cost_hike, distance_km, difficulty
      )
      VALUES (
        $1, $2, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)), 
        'designated_trail', 'open', 'public', 0.4, 1.2, 1.5, $4, 'Moderate'
      )
      ON CONFLICT DO NOTHING;
    `;

    try {
      await client.query(query, [
        name,
        `MI DNR ORV Route • ${surface} • ${county} County (${peninsula})`,
        lineStringGeoJson,
        distKm,
      ]);
      inserted++;
    } catch (err) {
      // skip individual line errors
    }
  }

  console.log(`Successfully ingested ${inserted} Michigan ORV Routes.`);
}

// 3. Ingest Flagship Multi-Modal Trails across MN, IA, IL & CNNF
async function importRegionalFlagships(client) {
  console.log('\n--- 3. Ingesting Flagship Trails for MN, IA, IL & Chequamegon-Nicolet ---');

  const flagships = [
    // Minnesota UTV & OHV
    {
      name: 'Soo Line North Trail (Moose Lake to Cass Lake)',
      state: 'Minnesota',
      mode: 'UTV / ATV / Snowmobile',
      route_type: 'designated_trail',
      cost_utv: 0.5,
      cost_mtb: 0.8,
      cost_hike: 1.2,
      difficulty: 'Easy',
      coords: [
        [-92.7610, 46.4520],
        [-92.8900, 46.5200],
        [-93.0800, 46.5900],
        [-93.3500, 46.6800],
        [-93.6200, 46.8100],
        [-94.1500, 47.1200],
        [-94.6100, 47.3800],
      ],
    },
    {
      name: 'Gandy Dancer Trail (MN/WI Inter-State Corridor)',
      state: 'MN / WI',
      mode: 'UTV / ATV / MTB',
      route_type: 'designated_trail',
      cost_utv: 0.5,
      cost_mtb: 0.7,
      cost_hike: 1.0,
      difficulty: 'Easy',
      coords: [
        [-92.5400, 45.4500],
        [-92.5100, 45.6200],
        [-92.4800, 45.7900],
        [-92.4200, 45.9800],
        [-92.3800, 46.1200],
        [-92.3100, 46.3500],
      ],
    },
    {
      name: 'Iron Range OHV State Recreation Area (Gilbert Trail System)',
      state: 'Minnesota',
      mode: 'UTV / 4x4 Rock Crawling',
      route_type: 'designated_trail',
      cost_utv: 0.3,
      cost_mtb: 1.5,
      cost_hike: 2.0,
      difficulty: 'Difficult',
      coords: [
        [-92.4650, 47.4820],
        [-92.4610, 47.4890],
        [-92.4550, 47.4940],
        [-92.4490, 47.4910],
        [-92.4520, 47.4850],
        [-92.4600, 47.4800],
      ],
    },
    {
      name: 'Superior Hiking Trail (Lutsen to Oberg Mountain Segment)',
      state: 'Minnesota',
      mode: 'Hiking',
      route_type: 'designated_trail',
      cost_utv: 9.9,
      cost_mtb: 2.5,
      cost_hike: 0.5,
      difficulty: 'Moderate',
      coords: [
        [-90.7100, 47.6600],
        [-90.7400, 47.6500],
        [-90.7900, 47.6350],
        [-90.8400, 47.6100],
        [-90.8900, 47.5950],
      ],
    },
    {
      name: 'Cuyuna Lakes MTB Red Dirt Loop',
      state: 'Minnesota',
      mode: 'Mountain Bike / MTB',
      route_type: 'designated_trail',
      cost_utv: 9.9,
      cost_mtb: 0.4,
      cost_hike: 1.0,
      difficulty: 'Moderate',
      coords: [
        [-93.9900, 46.4950],
        [-93.9800, 46.5050],
        [-93.9650, 46.5120],
        [-93.9550, 46.5080],
        [-93.9700, 46.4980],
        [-93.9900, 46.4950],
      ],
    },

    // Iowa UTV & Rail-Trails
    {
      name: 'Gypsum City OHV Park (Full Perimeter Loop)',
      state: 'Iowa',
      mode: 'UTV / 4x4 / ATV',
      route_type: 'designated_trail',
      cost_utv: 0.4,
      cost_mtb: 1.5,
      cost_hike: 2.0,
      difficulty: 'Moderate',
      coords: [
        [-94.1350, 42.4920],
        [-94.1200, 42.4980],
        [-94.1080, 42.4910],
        [-94.1120, 42.4820],
        [-94.1280, 42.4790],
        [-94.1350, 42.4920],
      ],
    },
    {
      name: 'High Trestle Trail (Ankeny to Woodward & Bridge)',
      state: 'Iowa',
      mode: 'Biking / Hiking',
      route_type: 'designated_trail',
      cost_utv: 9.9,
      cost_mtb: 0.5,
      cost_hike: 0.7,
      difficulty: 'Easy',
      coords: [
        [-93.6000, 41.7300],
        [-93.7100, 41.7900],
        [-93.8200, 41.8600],
        [-93.8900, 41.9100],
        [-93.9250, 41.9210],
      ],
    },

    // Illinois Shawnee National Forest & Off-Road
    {
      name: 'River to River Trail (Shawnee National Forest Segment)',
      state: 'Illinois',
      mode: 'Hiking / Backpacking',
      route_type: 'designated_trail',
      cost_utv: 9.9,
      cost_mtb: 1.8,
      cost_hike: 0.5,
      difficulty: 'Difficult',
      coords: [
        [-89.4100, 37.5800],
        [-89.1500, 37.5600],
        [-88.8500, 37.5400],
        [-88.5500, 37.5200],
        [-88.2200, 37.4900],
      ],
    },
    {
      name: 'The Cliffs Insane Terrain Off-Road Park (Marseilles)',
      state: 'Illinois',
      mode: 'UTV / 4x4 / Crawling',
      route_type: 'designated_trail',
      cost_utv: 0.3,
      cost_mtb: 2.0,
      cost_hike: 2.5,
      difficulty: 'Extreme',
      coords: [
        [-88.7100, 41.3450],
        [-88.7020, 37.3510],
        [-88.6950, 41.3480],
        [-88.7050, 41.3400],
        [-88.7100, 41.3450],
      ],
    },

    // Chequamegon-Nicolet National Forest (WI Federal)
    {
      name: 'Dead Horse Run Trail (Chequamegon National Forest)',
      state: 'Wisconsin',
      mode: 'UTV / 4x4 / ATV',
      route_type: 'designated_trail',
      cost_utv: 0.4,
      cost_mtb: 1.0,
      cost_hike: 1.5,
      difficulty: 'Difficult',
      coords: [
        [-90.8200, 46.0500],
        [-90.8700, 46.0900],
        [-90.9300, 46.1400],
        [-90.9900, 46.1800],
        [-91.0500, 46.2200],
      ],
    },
    {
      name: 'Flambeau Trail System (Chequamegon National Forest)',
      state: 'Wisconsin',
      mode: 'UTV / SxS / ATV',
      route_type: 'designated_trail',
      cost_utv: 0.4,
      cost_mtb: 1.1,
      cost_hike: 1.4,
      difficulty: 'Moderate',
      coords: [
        [-90.5800, 45.9200],
        [-90.6400, 45.9600],
        [-90.7100, 45.9900],
        [-90.7600, 46.0400],
      ],
    },
    {
      name: 'Ice Age Trail - Blue Hills Segment (Rusk County)',
      state: 'Wisconsin',
      mode: 'Hiking',
      route_type: 'designated_trail',
      cost_utv: 9.9,
      cost_mtb: 2.0,
      cost_hike: 0.5,
      difficulty: 'Difficult',
      coords: [
        [-91.4500, 45.4200],
        [-91.4800, 45.4600],
        [-91.5200, 45.5100],
        [-91.5600, 45.5500],
      ],
    },
  ];

  let inserted = 0;
  for (const trail of flagships) {
    const distKm = calculateDistance(trail.coords);
    const lineStringGeoJson = JSON.stringify({
      type: 'LineString',
      coordinates: trail.coords,
    });

    const query = `
      INSERT INTO trails (
        name, description, geom, route_type, official_status, 
        visibility, cost_utv, cost_mtb, cost_hike, distance_km, difficulty
      )
      VALUES (
        $1, $2, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)), 
        $4, 'open', 'public', $5, $6, $7, $8, $9
      )
      ON CONFLICT DO NOTHING;
    `;

    try {
      await client.query(query, [
        trail.name,
        `Flagship Regional Trail • ${trail.state} (${trail.mode})`,
        lineStringGeoJson,
        trail.route_type,
        trail.cost_utv,
        trail.cost_mtb,
        trail.cost_hike,
        distKm,
        trail.difficulty,
      ]);
      inserted++;
    } catch (err) {
      console.error(`Error inserting ${trail.name}:`, err.message);
    }
  }

  console.log(`Successfully ingested ${inserted} regional flagship trails.`);
}

async function main() {
  const client = await getClient();
  console.log('Connected to Supabase PostGIS cluster.');

  try {
    await importWisconsinDnr(client);
    await importMichiganDnr(client);
    await importRegionalFlagships(client);

    // Summary of total trails and mileage in Supabase
    const countRes = await client.query('SELECT count(*) as total, sum(distance_km) as km FROM trails;');
    const total = countRes.rows[0].total;
    const totalKm = Math.round(parseFloat(countRes.rows[0].km) || 0);
    const totalMiles = Math.round(totalKm * 0.621371);

    console.log('\n=======================================');
    console.log(`🎉 Master Ingestion Complete!`);
    console.log(`Total Trails in Supabase: ${total}`);
    console.log(`Total Trail Distance: ${totalKm.toLocaleString()} km (${totalMiles.toLocaleString()} miles)`);
    console.log('=======================================\n');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Master ingestion error:', err);
  process.exit(1);
});
