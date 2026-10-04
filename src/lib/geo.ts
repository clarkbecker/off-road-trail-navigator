import { BreadcrumbPoint } from '@/types/trail';

/**
 * Calculates perpendicular distance from a point to a line segment.
 */
function perpendicularDistance(
  point: BreadcrumbPoint,
  lineStart: BreadcrumbPoint,
  lineEnd: BreadcrumbPoint
): number {
  let dx = lineEnd.lng - lineStart.lng;
  let dy = lineEnd.lat - lineStart.lat;

  // Normalize
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag > 0) {
    dx /= mag;
    dy /= mag;
  }

  const pvx = point.lng - lineStart.lng;
  const pvy = point.lat - lineStart.lat;

  // Project p onto line
  const pvdot = dx * pvx + dy * pvy;
  const dsx = pvdot * dx;
  const dsy = pvdot * dy;

  const ax = pvx - dsx;
  const ay = pvy - dsy;

  return Math.sqrt(ax * ax + ay * ay);
}

/**
 * Douglas-Peucker algorithm for reducing GPS track points while preserving topology.
 * @param points Array of breadcrumb points
 * @param epsilon Tolerance threshold in degrees (~0.00005 deg is ~5 meters)
 */
export function simplifyBreadcrumbTrack(
  points: BreadcrumbPoint[],
  epsilon = 0.00005
): BreadcrumbPoint[] {
  if (points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = simplifyBreadcrumbTrack(points.slice(0, index + 1), epsilon);
    const recResults2 = simplifyBreadcrumbTrack(points.slice(index), epsilon);

    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Calculates total distance in kilometers from an array of coordinates using Haversine formula.
 */
export function calculateTrackDistanceKm(points: { lat: number; lng: number }[]): number {
  if (points.length < 2) return 0;

  const R = 6371; // Earth radius in km
  let totalKm = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const lat1 = (points[i].lat * Math.PI) / 180;
    const lat2 = (points[i + 1].lat * Math.PI) / 180;
    const dLat = ((points[i + 1].lat - points[i].lat) * Math.PI) / 180;
    const dLng = ((points[i + 1].lng - points[i].lng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += R * c;
  }

  return Math.round(totalKm * 100) / 100;
}
