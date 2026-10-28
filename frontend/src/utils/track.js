/**
 * Distance along a stored track, for the charts' x-axis.
 *
 * Points recorded with a `dist` (metres from the start, from the watch or
 * Intervals.icu) use it as-is — that is the only distance an indoor run on a
 * treadmill has. Otherwise distance is summed from GPS between consecutive
 * positions. Returns km per point, or null for a point with neither.
 */
export function cumulativeKm(points) {
  const out = new Array(points.length).fill(null)
  let cum = 0, prev = null
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (p.dist != null) {
      cum = p.dist / 1000
      out[i] = cum
    } else if (p.lat != null && p.lon != null) {
      if (prev) cum += haversineKm(prev.lat, prev.lon, p.lat, p.lon)
      out[i] = cum
      prev = p
    }
  }
  return out
}

/** True when any point has a position or a recorded distance to chart along. */
export function hasDistance(points) {
  return !!points?.some(p => p.dist != null || p.lat != null)
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
