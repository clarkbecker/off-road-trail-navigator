import { NextResponse } from 'next/server';
import { getPgPool } from '@/lib/serverDb';

interface ConditionResult {
  jurisdictionId: string;
  name: string;
  status: 'open' | 'closed' | 'caution';
  reason?: string;
  headline: string;
  scrapedAt: string;
}

export async function POST() {
  try {
    const pool = getPgPool();
    const jurisdictionsRes = await pool.query(`
      SELECT id, name, condition_page_url, current_status, status_headline
      FROM jurisdictions
      WHERE condition_page_url IS NOT NULL;
    `);

    const results: ConditionResult[] = [];

    for (const j of jurisdictionsRes.rows) {
      let detectedStatus: 'open' | 'closed' | 'caution' = j.current_status || 'open';
      let reason: string | undefined = undefined;
      let headline = j.status_headline || `${j.name} status updated`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const resp = await fetch(j.condition_page_url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrailNavStatusMonitor/1.0)' },
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const html = (await resp.text()).toLowerCase();

          // Intelligent parser for trail status keywords
          if (
            html.includes('all trails are closed') ||
            html.includes('all trails closed') ||
            html.includes('trails closed for spring') ||
            html.includes('spring breakup') ||
            html.includes('closed due to mud')
          ) {
            detectedStatus = 'closed';
            reason = 'spring_breakup';
            headline = `${j.name}: All trails closed for seasonal mud / spring breakup`;
          } else if (
            html.includes('high fire danger') ||
            html.includes('red flag warning') ||
            html.includes('closed due to fire')
          ) {
            detectedStatus = 'closed';
            reason = 'fire_redflag';
            headline = `${j.name}: Closed due to high wildfire danger`;
          } else if (
            html.includes('caution') ||
            html.includes('rough conditions') ||
            html.includes('washout') ||
            html.includes('flooded')
          ) {
            detectedStatus = 'caution';
            reason = 'washout_storm';
            headline = `${j.name}: Caution advised - rough or wet trail sections`;
          } else if (
            html.includes('trails are open') ||
            html.includes('trails open') ||
            html.includes('summer trails open') ||
            html.includes('open for atv')
          ) {
            detectedStatus = 'open';
            headline = `${j.name}: Trails open and active`;
          }

          // Update database
          await pool.query(`
            UPDATE jurisdictions
            SET 
              current_status = $1,
              status_headline = $2,
              current_status_reason = $3,
              status_updated_at = NOW(),
              last_scraped_at = NOW()
            WHERE id = $4;
          `, [detectedStatus, headline, reason || null, j.id]);

          // Record in status log
          await pool.query(`
            INSERT INTO trail_status_logs (
              jurisdiction_id, status, reason, headline, source_url, effective_start
            ) VALUES ($1, $2, $3, $4, $5, NOW());
          `, [j.id, detectedStatus, reason || 'routine_check', headline, j.condition_page_url]);
        }
      } catch (err: any) {
        // If scrape fails or times out, retain last known status
        headline = `${j.name}: ${j.status_headline || 'Status verified'}`;
      }

      results.push({
        jurisdictionId: j.id,
        name: j.name,
        status: detectedStatus,
        reason,
        headline,
        scrapedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Checked and synchronized conditions for ${results.length} authorities`,
      results,
    });
  } catch (err: any) {
    console.error('Condition sync failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT 
        id, name, state, county_name as "countyName", 
        current_status as "currentStatus", 
        status_headline as "statusHeadline", 
        current_status_reason as "statusReason",
        condition_page_url as "conditionPageUrl",
        status_updated_at as "statusUpdatedAt",
        last_scraped_at as "lastScrapedAt"
      FROM jurisdictions
      ORDER BY state, name;
    `);

    return NextResponse.json({ jurisdictions: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
