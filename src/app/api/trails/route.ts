import { NextResponse } from 'next/server';
import { getPgPool } from '@/lib/serverDb';

export async function GET() {
  try {
    const pool = getPgPool();
    const query = `
      SELECT 
        t.id, 
        t.name, 
        t.description, 
        t.route_type as "routeType", 
        COALESCE(j.current_status, t.official_status::text, 'open') as "officialStatus",
        j.status_headline as "statusHeadline",
        j.current_status_reason as "statusReason",
        j.name as "jurisdictionName",
        t.system_name as "systemName",
        t.trail_number as "trailNumber",
        t.allowed_utv as "allowedUtv",
        t.allowed_atv as "allowedAtv",
        t.allowed_dirtbike as "allowedDirtbike",
        t.allowed_4x4 as "allowed4x4",
        t.allowed_mtb as "allowedMtb",
        t.allowed_hiking as "allowedHiking",
        t.max_utv_width_inches as "maxUtvWidthInches",
        t.surface_type as "surfaceType",
        t.is_public_road_route as "isPublicRoadRoute",
        t.visibility, 
        t.cost_utv as "costUtv", 
        t.cost_mtb as "costMtb", 
        t.cost_hike as "costHike", 
        t.distance_km as "distanceKm", 
        t.difficulty,
        ST_AsGeoJSON(t.geom) as geojson,
        extract(epoch from t.created_at) * 1000 as "createdAt"
      FROM trails t
      LEFT JOIN jurisdictions j ON t.jurisdiction_id = j.id
      WHERE t.visibility = 'public'
      ORDER BY t.created_at DESC;
    `;

    const result = await pool.query(query);

    const trails = result.rows.map((row) => {
      let points: Array<{ lng: number; lat: number; elevation: number | null; timestamp: number }> = [];

      try {
        const parsedGeo = JSON.parse(row.geojson);
        let coords: number[][] = [];

        if (parsedGeo.type === 'LineString') {
          coords = parsedGeo.coordinates;
        } else if (parsedGeo.type === 'MultiLineString') {
          // Flatten multi-line string paths into sequential points for navigator
          coords = parsedGeo.coordinates.flat(1);
        }

        points = coords.map((coord: number[]) => ({
          lng: coord[0],
          lat: coord[1],
          elevation: coord[2] || null,
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn('Error parsing geojson for trail:', row.name, e);
      }

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        routeType: row.routeType,
        officialStatus: row.officialStatus,
        statusHeadline: row.statusHeadline,
        statusReason: row.statusReason,
        jurisdictionName: row.jurisdictionName,
        systemName: row.systemName,
        trailNumber: row.trailNumber,
        allowedUtv: row.allowedUtv ?? true,
        allowedAtv: row.allowedAtv ?? true,
        allowedDirtbike: row.allowedDirtbike ?? true,
        allowed4x4: row.allowed4x4 ?? false,
        allowedMtb: row.allowedMtb ?? false,
        allowedHiking: row.allowedHiking ?? false,
        maxUtvWidthInches: row.maxUtvWidthInches ?? null,
        surfaceType: row.surfaceType || 'dirt',
        isPublicRoadRoute: Boolean(row.isPublicRoadRoute),
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

    return NextResponse.json(
      { trails },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
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
