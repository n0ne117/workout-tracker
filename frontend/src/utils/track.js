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

/**
 * The charts' x-axis for a track: distance when it has any, otherwise time.
 *
 * A trainer ride without a speed sensor records heart rate (maybe cadence or
 * power) against time only; charting it against distance would leave every
 * chart empty. Returns `{ xs, unit }` — km or elapsed minutes per point.
 */
export function trackAxis(points) {
  if (hasDistance(points)) return { xs: cumulativeKm(points), unit: 'km' }
  const secs = points.map(p => toSecs(p.time))
  const t0 = secs.find(t => t != null)
  return { xs: secs.map(t => (t == null || t0 == null ? null : (t - t0) / 60)), unit: 'min' }
}

export function axisUnit(points) {
  return hasDistance(points) ? 'km' : 'min'
}

/** A position on the x-axis as text: "3.25 km" or "12:30 min". */
export function formatAxis(v, unit) {
  if (unit === 'km') return `${v.toFixed(2)} km`
  const m = Math.floor(v), s = Math.round((v - m) * 60)
  return s === 60 ? `${m + 1}:00 min` : `${m}:${String(s).padStart(2, '0')} min`
}

/** Seconds from a stored time: an offset (Intervals.icu) or an ISO timestamp (files). */
function toSecs(t) {
  if (t == null) return null
  if (typeof t === 'number') return t
  const ms = Date.parse(t)
  return Number.isNaN(ms) ? null : ms / 1000
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
