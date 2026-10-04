import pg from 'pg';

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

async function runImport() {
  console.log('--- Connecting to Supabase PostGIS Database ---');
  const client = await getClient();

  // Define Burnett County Trails to Ingest
  const trailsToFetch = [
    {
      name: 'Burnett County Trail 8 West',
      description: 'Burnett County Forest UTV/ATV Trail 8 West. Traverses the Town of Swiss connecting Danbury corridor across Swiss Fire Lane, Carters Bridge Road, and Briggs Lake Road.',
      difficulty: 'Easy',
      wayIds: [21450086, 21449259, 21448722],
    },
    {
      name: 'Burnett County Trail 8 East',
      description: 'Burnett County Forest UTV/ATV Trail 8 East. Primary east-west motorized corridor running past Lake 26 through Burnett County Forest towards Webb Lake and connecting with Washburn County Trail 8.',
      difficulty: 'Moderate',
      wayIds: [21447179],
    },
    {
      name: 'Burnett County Trail 7',
      description: 'Burnett County Forest UTV/ATV Trail 7. State-funded motorized trail traversing the Frog Lake Road corridor in the Town of Swiss and Webb Lake area heading towards Namekagon Barrens.',
      difficulty: 'Easy',
      wayIds: [21450526, 1058738256],
    },
    {
      name: 'Burnett County Trail 7B',
      description: 'Burnett County Trail 7B. Connector spur linking Trail 7 along Webb Creek Drive into the Town of Webb Lake and county forest staging access.',
      difficulty: 'Easy',
      wayIds: [21450441],
    },
    {
      name: 'Burnett County Trail 45 North',
      description: 'Burnett County Forest Trail 45 North. Core motorized multi-use corridor running through central Burnett County Forest.',
      difficulty: 'Moderate',
      wayIds: [1431825555, 1431825559, 1431825562],
    },
    {
      name: 'Burnett County Trail 41 North',
      description: 'Burnett County Forest Trail 41 North. Scenic motorized trail near Namekagon Barrens State Wildlife Area.',
      difficulty: 'Moderate',
      wayIds: [21444059],
    },
    {
      name: 'Burnett County Trail 151 (Springbrook)',
      description: 'Burnett County Trail 151 / Springbrook Trail. Connects Big Island Road and eastern Burnett forest tracts.',
      difficulty: 'Easy',
      wayIds: [1478698397],
    },
  ];

  // Collect all unique way IDs
  const allWayIds = Array.from(new Set(trailsToFetch.flatMap(t => t.wayIds)));

  console.log(`Fetching geometries for ${allWayIds.length} OSM ways from Overpass...`);
  const query = `[out:json][timeout:45];
(
  ${allWayIds.map(id => `way(${id});`).join('\n  ')}
);
out geom;
`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'TrailNavigator/1.0 (clark@trailnav.local)',
    },
    body: 'data=' + encodeURIComponent(query),
  });

  const data = await res.json();
  const wayMap = new Map();
  for (const el of data.elements || []) {
    if (el.geometry) {
      // GeoJSON format: [longitude, latitude]
      wayMap.set(el.id, el.geometry.map(pt => [pt.lon, pt.lat]));
    }
  }

  let totalInserted = 0;

  for (const t of trailsToFetch) {
    // Combine coordinate sequences from the ways
    const coords = [];
    for (const wId of t.wayIds) {
      const pts = wayMap.get(wId);
      if (pts && pts.length > 0) {
        coords.push(...pts);
      }
    }

    if (coords.length < 2) {
      console.warn(`Insufficient points for ${t.name}, skipping.`);
      continue;
    }

    const distKm = calculateDistance(coords);
    const lineStringGeoJson = JSON.stringify({
      type: 'LineString',
      coordinates: coords,
    });

    const deleteQuery = `DELETE FROM trails WHERE name = $1;`;
    const insertQuery = `
      INSERT INTO trails (
        name, description, geom, route_type, official_status,
        visibility, cost_utv, cost_mtb, cost_hike, distance_km, difficulty
      )
      VALUES (
        $1, $2, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)),
        'designated_trail', 'open', 'public', 0.3, 0.7, 1.0, $4, $5
      );
    `;

    try {
      await client.query(deleteQuery, [t.name]);
      await client.query(insertQuery, [
        t.name,
        t.description,
        lineStringGeoJson,
        distKm,
        t.difficulty,
      ]);
      console.log(`✓ Inserted/Updated: ${t.name} (${distKm} km, ${coords.length} points)`);
      totalInserted++;
    } catch (err) {
      console.error(`Error inserting ${t.name}:`, err.message);
    }
  }

  const countRes = await client.query('SELECT COUNT(*) FROM trails;');
  console.log(`\n🎉 Ingestion complete! Total trails now in database: ${countRes.rows[0].count}`);

  await client.end();
}

runImport().catch(console.error);
