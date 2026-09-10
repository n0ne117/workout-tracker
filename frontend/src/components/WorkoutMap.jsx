import { useEffect, useRef } from 'react'

// Gradient: blue → cyan → green → yellow → orange → red  (slow → fast)
const COLOR_STOPS = [
  [0.00, [37,  99, 235]],
  [0.25, [ 6, 182, 212]],
  [0.50, [34, 197,  94]],
  [0.70, [234,179,   8]],
  [0.85, [249,115,  22]],
  [1.00, [239, 68,  68]],
]

function paceColor(t) {
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [t1, c1] = COLOR_STOPS[i]
    if (t <= t1) {
      const [t0, c0] = COLOR_STOPS[i - 1]
      const f = (t - t0) / (t1 - t0)
      return `rgb(${Math.round(c0[0] + (c1[0]-c0[0])*f)},${Math.round(c0[1] + (c1[1]-c0[1])*f)},${Math.round(c0[2] + (c1[2]-c0[2])*f)})`
    }
  }
  return 'rgb(239,68,68)'
}

export default function WorkoutMap({ trackPoints, bbox }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !trackPoints?.length) return

    import('leaflet').then(L => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const latlngs = trackPoints.map(p => [p.lat, p.lon])
      const rawSpeeds = trackPoints.map(p => (p.speed != null && p.speed > 0) ? p.speed : null)
      const hasSpeed = rawSpeeds.some(s => s != null)

      if (!hasSpeed) {
        // No speed data — single colour fallback
        L.polyline(latlngs, { color: '#3b82f6', weight: 3, opacity: 0.85 }).addTo(map)
      } else {
        // Rolling-window smooth (forward-fill nulls first)
        const filled = [...rawSpeeds]
        let last = null
        for (let i = 0; i < filled.length; i++) {
          if (filled[i] != null) last = filled[i]
          else if (last != null) filled[i] = last
        }
        // backward fill for leading nulls
        last = null
        for (let i = filled.length - 1; i >= 0; i--) {
          if (filled[i] != null) last = filled[i]
          else if (last != null) filled[i] = last
        }

        const WIN = 20
        const smoothed = filled.map((_, i) => {
          let sum = 0, count = 0
          for (let j = Math.max(0, i - WIN); j <= Math.min(filled.length - 1, i + WIN); j++) {
            if (filled[j] != null) { sum += filled[j]; count++ }
          }
          return count > 0 ? sum / count : 0
        })

        const validSpeeds = smoothed.filter(s => s > 0)
        const minSpeed = Math.min(...validSpeeds)
        const maxSpeed = Math.max(...validSpeeds)
        const range = maxSpeed - minSpeed

        const N_BUCKETS = 32
        const buckets = smoothed.map(s =>
          range === 0 ? 0 : Math.min(N_BUCKETS - 1, Math.floor(((s - minSpeed) / range) * N_BUCKETS))
        )

        // Draw one polyline per run of same bucket (overlap by 1 point to close gaps)
        let segStart = 0
        for (let i = 1; i <= trackPoints.length; i++) {
          if (i === trackPoints.length || buckets[i] !== buckets[segStart]) {
            const seg = latlngs.slice(segStart, i + 1)
            const t = (buckets[segStart] + 0.5) / N_BUCKETS
            L.polyline(seg, { color: paceColor(t), weight: 4, opacity: 0.9 }).addTo(map)
            segStart = i
          }
        }
      }

      // Start marker
      L.circleMarker(latlngs[0], {
        radius: 7, fillColor: '#22c55e', color: '#fff', weight: 2, fillOpacity: 1,
      }).bindTooltip('Start').addTo(map)

      // Finish marker
      L.circleMarker(latlngs[latlngs.length - 1], {
        radius: 7, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1,
      }).bindTooltip('Finish').addTo(map)

      if (bbox?.min_lat) {
        map.fitBounds([[bbox.min_lat, bbox.min_lon], [bbox.max_lat, bbox.max_lon]], { padding: [20, 20] })
      } else {
        map.fitBounds(L.polyline(latlngs).getBounds(), { padding: [20, 20] })
      }
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [trackPoints])

  if (!trackPoints?.length) {
    return (
      <div className="h-64 card flex items-center justify-center text-gray-400 dark:text-gray-600">
        <span className="text-sm">No GPS track available</span>
      </div>
    )
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="h-[303px] sm:h-[399px] w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800"
      />
      <div className="flex items-center gap-2 mt-2 px-1">
        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">Slower</span>
        <div
          className="flex-1 h-2 rounded-full"
          style={{ background: 'linear-gradient(to right, rgb(37,99,235), rgb(6,182,212), rgb(34,197,94), rgb(234,179,8), rgb(249,115,22), rgb(239,68,68))' }}
        />
        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">Faster</span>
      </div>
    </div>
  )
}
