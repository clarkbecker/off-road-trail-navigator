import { Trail, BreadcrumbPoint } from '@/types/trail';

// Calculate Haversine distance in km
export function calculateDistanceKm(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371; // Earth radius in km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateTotalTrailDistance(points: BreadcrumbPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateDistanceKm(points[i - 1], points[i]);
  }
  return total;
}

// Export trail points as standard GPX format
export function exportTrailToGpx(trail: Trail): string {
  const trkpts = trail.points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">` +
        (p.elevation != null ? `\n        <ele>${p.elevation.toFixed(1)}</ele>` : '') +
        `\n        <time>${new Date(p.timestamp).toISOString()}</time>` +
        `\n      </trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OffRoadTrailNavigator" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(trail.name)}</name>
    <desc>${escapeXml(trail.description || '')}</desc>
    <time>${new Date(trail.createdAt).toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(trail.name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

// Parse GPX track points
export function parseGpx(gpxString: string, defaultName: string = 'Imported Trail'): Trail {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxString, 'text/xml');
  const nameNode = xml.querySelector('trk > name') || xml.querySelector('name');
  const trailName = nameNode?.textContent?.trim() || defaultName;

  const trkptNodes = xml.querySelectorAll('trkpt');
  const points: BreadcrumbPoint[] = [];

  trkptNodes.forEach((node) => {
    const lat = parseFloat(node.getAttribute('lat') || '0');
    const lng = parseFloat(node.getAttribute('lon') || '0');
    const eleNode = node.querySelector('ele');
    const elevation = eleNode ? parseFloat(eleNode.textContent || '0') : null;
    const timeNode = node.querySelector('time');
    const timestamp = timeNode && timeNode.textContent ? new Date(timeNode.textContent).getTime() : Date.now();

    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng, elevation, timestamp });
    }
  });

  const distanceKm = calculateTotalTrailDistance(points);

  return {
    id: 'trail_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: trailName,
    difficulty: 'Moderate',
    points,
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    createdAt: Date.now(),
    color: '#f97316',
  };
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
