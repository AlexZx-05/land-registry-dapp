function toXY([lat, lng]) {
  return [lng, lat];
}

export function polygonAreaSqm(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return 0;
  const earthRadius = 6378137;
  const points = coords.map(([lat, lng]) => [
    (lng * Math.PI * earthRadius) / 180,
    (lat * Math.PI * earthRadius) / 180
  ]);

  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

function orientation(p, q, r) {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (Math.abs(val) < 1e-12) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(p, q, r) {
  return (
    q[0] <= Math.max(p[0], r[0]) &&
    q[0] >= Math.min(p[0], r[0]) &&
    q[1] <= Math.max(p[1], r[1]) &&
    q[1] >= Math.min(p[1], r[1])
  );
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

export function pointInPolygon(pointLatLng, polygonLatLng) {
  const point = toXY(pointLatLng);
  const polygon = polygonLatLng.map(toXY);
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonInsideBoundary(polygon, boundary) {
  return polygon.every((point) => pointInPolygon(point, boundary));
}

export function polygonsOverlap(polyA, polyB) {
  const a = polyA.map(toXY);
  const b = polyB.map(toXY);

  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j += 1) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  if (pointInPolygon(polyA[0], polyB)) return true;
  if (pointInPolygon(polyB[0], polyA)) return true;
  return false;
}

export function areaDeviationPercent(referenceSqm, candidateSqm) {
  if (!referenceSqm || referenceSqm <= 0) return 100;
  return (Math.abs(candidateSqm - referenceSqm) / referenceSqm) * 100;
}
