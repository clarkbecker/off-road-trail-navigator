import { NextResponse } from 'next/server';
import { getPgPool } from '@/lib/serverDb';

export async function GET() {
  try {
    const pool = getPgPool();
    const query = `
      SELECT 
        id, 
        name, 
        description, 
        route_type as "routeType", 
        official_status as "officialStatus", 
        visibility, 
        cost_utv as "costUtv", 
        cost_mtb as "costMtb", 
        cost_hike as "costHike", 
        distance_km as "distanceKm", 
        difficulty,
        ST_AsGeoJSON(geom) as geojson,
        extract(epoch from created_at) * 1000 as "createdAt"
      FROM trails
      WHERE visibility = 'public'
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query);

    const trails = result.rows.map((row) => {
      const parsedGeo = JSON.parse(row.geojson);
      const points = parsedGeo.coordinates.map((coord: number[]) => ({
        lng: coord[0],
        lat: coord[1],
        elevation: coord[2] || null,
        timestamp: Date.now(),
      }));

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        routeType: row.routeType,
        officialStatus: row.officialStatus,
        visibility: row.visibility,
        costUtv: row.costUtv ? parseFloat(row.costUtv) : 0.5,
        costMtb: row.costMtb ? parseFloat(row.costMtb) : 1.0,
        costHike: row.costHike ? parseFloat(row.costHike) : 1.5,
        distanceKm: row.distanceKm ? parseFloat(row.distanceKm) : 0,
        difficulty: row.difficulty || 'Moderate',
        points,
        createdAt: Number(row.createdAt),
      };
    });

    return NextResponse.json({ trails });
  } catch (err: any) {
    console.error('Error fetching trails from Supabase PostGIS:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, difficulty, points, visibility, routeType, creatorId } = body;

    if (!name || !points || points.length < 2) {
      return NextResponse.json({ error: 'Invalid trail data' }, { status: 400 });
    }

    const coordinates = points.map((p: any) => [p.lng, p.lat]);
    const geojson = JSON.stringify({
      type: 'LineString',
      coordinates,
    });

    const pool = getPgPool();
    const insertQuery = `
      INSERT INTO trails (
        name, description, geom, difficulty, visibility, route_type, creator_id
      )
      VALUES (
        $1, $2, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)), $4, $5, $6, $7
      )
      RETURNING id, name, created_at;
    `;

    const result = await pool.query(insertQuery, [
      name,
      description || null,
      geojson,
      difficulty || 'Moderate',
      visibility || 'private',
      routeType || 'user_submitted',
      creatorId || null,
    ]);

    return NextResponse.json({ success: true, trail: result.rows[0] });
  } catch (err: any) {
    console.error('Error inserting trail into PostGIS:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
