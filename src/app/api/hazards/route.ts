import { NextResponse } from 'next/server';
import { getPgPool } from '@/lib/serverDb';

export async function GET() {
  try {
    const pool = getPgPool();
    const query = `
      SELECT 
        id, 
        hazard_type as "hazardType", 
        title, 
        description, 
        ST_X(geom) as lng, 
        ST_Y(geom) as lat, 
        active, 
        reported_by as "reportedBy", 
        extract(epoch from created_at) * 1000 as "createdAt"
      FROM hazard_reports
      WHERE active = TRUE
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query);

    const hazards = result.rows.map((row) => ({
      id: row.id,
      hazardType: row.hazardType,
      title: row.title,
      description: row.description,
      lng: parseFloat(row.lng),
      lat: parseFloat(row.lat),
      active: row.active,
      reportedBy: row.reportedBy,
      createdAt: Number(row.createdAt),
    }));

    return NextResponse.json({ hazards });
  } catch (err: any) {
    console.error('Error fetching hazards from PostGIS:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { hazardType, title, description, lat, lng, reportedBy } = body;

    if (!hazardType || !title || lat == null || lng == null) {
      return NextResponse.json({ error: 'Missing required hazard fields' }, { status: 400 });
    }

    const pool = getPgPool();
    const insertQuery = `
      INSERT INTO hazard_reports (
        hazard_type, title, description, geom, reported_by
      )
      VALUES (
        $1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6
      )
      RETURNING id, title, created_at;
    `;

    const result = await pool.query(insertQuery, [
      hazardType,
      title,
      description || null,
      lng,
      lat,
      reportedBy || null,
    ]);

    return NextResponse.json({ success: true, hazard: result.rows[0] });
  } catch (err: any) {
    console.error('Error inserting hazard into PostGIS:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
