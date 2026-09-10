import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Save, Scissors, Loader2, RotateCcw } from 'lucide-react'
import { formatDuration, formatDistance, formatElevation } from '../utils/format'

// ── Geo helpers ───────────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nearestIdx(lat, lon, pts) {
  let best = 0, bestD = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].lat - lat) ** 2 + (pts[i].lon - lon) ** 2
    if (d < bestD) { bestD = d; best = i }
  }
  return best
}

function calcPreview(pts, s, e) {
  const slice = pts.slice(s, e + 1)
  if (slice.length < 2) return null
  let dist = 0, elevGain = 0
  const hrs = []
  for (let i = 1; i < slice.length; i++) {
    dist += haversine(slice[i - 1].lat, slice[i - 1].lon, slice[i].lat, slice[i].lon)
    if (slice[i - 1].ele != null && slice[i].ele != null) {
      const d = slice[i].ele - slice[i - 1].ele
      if (d > 0) elevGain += d
    }
    if (slice[i].hr) hrs.push(slice[i].hr)
  }
  const t0 = slice[0]?.time
  const t1 = slice[slice.length - 1]?.time
  const duration = t0 && t1 ? (new Date(t1) - new Date(t0)) / 1000 : null
  const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null
  return { dist, duration, elevGain, avgHr, count: slice.length }
}

// ── Map styles ────────────────────────────────────────────────────────────────

const KEPT_STYLE  = { color: '#3b82f6', weight: 4, opacity: 0.9 }
const TRIM_STYLE  = { color: '#ef4444', weight: 3, opacity: 0.28, dashArray: '5 6' }

function makeIcon(color) {
  return {
    // built inside effect once L is available — see buildIcon()
    color,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkoutTrimmer({ trackPoints, onSave, onCancel, saving }) {
  const n = trackPoints.length

  // Leaflet object refs — set once inside useEffect
  const LRef            = useRef(null)
  const mapRef          = useRef(null)
  const startMarkerRef  = useRef(null)
  const endMarkerRef    = useRef(null)
  const linesRef        = useRef({ trimStart: null, kept: null, trimEnd: null })
  const redrawRef       = useRef(null)
  const mapContainerRef = useRef(null)

  // Mutable index refs (avoid stale closures inside Leaflet handlers)
  const startIdxRef = useRef(0)
  const endIdxRef   = useRef(n - 1)

  // React state drives sliders + preview
  const [startIdx, setStartIdx] = useState(0)
  const [endIdx,   setEndIdx]   = useState(n - 1)

  const preview = useMemo(
    () => calcPreview(trackPoints, startIdx, endIdx),
    [trackPoints, startIdx, endIdx],
  )

  // ── Leaflet setup (runs once on mount) ─────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || !trackPoints?.length) return

    import('leaflet').then(L => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      const map = L.map(mapContainerRef.current, { zoomControl: true, scrollWheelZoom: true })
      mapRef.current = map
      LRef.current   = L

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const all = trackPoints.map(p => [p.lat, p.lon])

      // Initial full track (all kept)
      const initLine = L.polyline(all, KEPT_STYLE).addTo(map)
      linesRef.current = { trimStart: null, kept: initLine, trimEnd: null }

      // ── Redraw helper (captures L, map, trackPoints, n, linesRef) ──────────
      function redraw(s, e) {
        const { trimStart, kept, trimEnd } = linesRef.current
        if (trimStart) map.removeLayer(trimStart)
        if (kept)      map.removeLayer(kept)
        if (trimEnd)   map.removeLayer(trimEnd)

        const ts = s > 0     ? L.polyline(all.slice(0, s + 1), TRIM_STYLE) : null
        const k  =             L.polyline(all.slice(s, e + 1), KEPT_STYLE)
        const te = e < n - 1 ? L.polyline(all.slice(e, n),    TRIM_STYLE) : null

        if (ts) ts.addTo(map)
        k.addTo(map)
        if (te) te.addTo(map)

        linesRef.current = { trimStart: ts, kept: k, trimEnd: te }
      }

      redrawRef.current = redraw

      // ── Markers ───────────────────────────────────────────────────────────
      function buildIcon(color) {
        return L.divIcon({
          className: '',
          html: `<div style="width:20px;height:20px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.55);cursor:grab"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
      }

      const startMarker = L.marker(all[0], {
        draggable: true,
        icon: buildIcon('#22c55e'),
        zIndexOffset: 1000,
      }).bindTooltip('Start — drag to trim', { direction: 'top' }).addTo(map)

      const endMarker = L.marker(all[n - 1], {
        draggable: true,
        icon: buildIcon('#ef4444'),
        zIndexOffset: 1000,
      }).bindTooltip('End — drag to trim', { direction: 'top' }).addTo(map)

      startMarkerRef.current = startMarker
      endMarkerRef.current   = endMarker

      startMarker.on('dragend', () => {
        const { lat, lng } = startMarker.getLatLng()
        const raw = nearestIdx(lat, lng, trackPoints)
        const idx = Math.min(raw, endIdxRef.current - 1)
        startIdxRef.current = idx
        startMarker.setLatLng([trackPoints[idx].lat, trackPoints[idx].lon])
        setStartIdx(idx)
        redraw(idx, endIdxRef.current)
      })

      endMarker.on('dragend', () => {
        const { lat, lng } = endMarker.getLatLng()
        const raw = nearestIdx(lat, lng, trackPoints)
        const idx = Math.max(raw, startIdxRef.current + 1)
        endIdxRef.current = idx
        endMarker.setLatLng([trackPoints[idx].lat, trackPoints[idx].lon])
        setEndIdx(idx)
        redraw(startIdxRef.current, idx)
      })

      map.fitBounds(L.polyline(all).getBounds(), { padding: [24, 24] })
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Slider handlers ────────────────────────────────────────────────────────
  function handleStart(raw) {
    const idx = Math.min(Number(raw), endIdxRef.current - 1)
    startIdxRef.current = idx
    setStartIdx(idx)
    startMarkerRef.current?.setLatLng([trackPoints[idx].lat, trackPoints[idx].lon])
    redrawRef.current?.(idx, endIdxRef.current)
  }

  function handleEnd(raw) {
    const idx = Math.max(Number(raw), startIdxRef.current + 1)
    endIdxRef.current = idx
    setEndIdx(idx)
    endMarkerRef.current?.setLatLng([trackPoints[idx].lat, trackPoints[idx].lon])
    redrawRef.current?.(startIdxRef.current, idx)
  }

  function handleReset() {
    startIdxRef.current = 0
    endIdxRef.current   = n - 1
    setStartIdx(0)
    setEndIdx(n - 1)
    startMarkerRef.current?.setLatLng([trackPoints[0].lat,      trackPoints[0].lon])
    endMarkerRef.current?.setLatLng([trackPoints[n - 1].lat, trackPoints[n - 1].lon])
    redrawRef.current?.(0, n - 1)
  }

  const trimming  = startIdx > 0 || endIdx < n - 1
  const pctStart  = Math.round((startIdx / (n - 1)) * 100)
  const pctEnd    = Math.round((endIdx   / (n - 1)) * 100)
  const keptCount = endIdx - startIdx + 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0a0a0f' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
           style={{ background: '#111118', borderColor: '#1f1f2e' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Scissors size={17} className="text-blue-400 flex-shrink-0" />
          <span className="font-semibold text-white text-[15px]">Trim GPS Track</span>
          <span className="hidden sm:block text-xs text-gray-500 truncate">
            · drag the green / red markers, or use the sliders
          </span>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white transition-colors flex-shrink-0"
          style={{ background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = '#1f1f2e'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <X size={20} />
        </button>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 min-h-0 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Kept / Trimmed legend */}
        <div className="absolute bottom-3 left-3 z-[1000] rounded-xl px-3 py-2.5 text-xs space-y-1.5 pointer-events-none"
             style={{ background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-2 text-gray-200">
            <div className="w-5 h-1.5 rounded-full bg-blue-500" />
            <span>Kept</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-5 h-1.5 rounded-full bg-red-500 opacity-50" />
            <span>Trimmed</span>
          </div>
        </div>

        {/* Point counter */}
        <div className="absolute bottom-3 right-3 z-[1000] rounded-xl px-2.5 py-1.5 text-xs text-gray-400 pointer-events-none tabular-nums"
             style={{ background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)' }}>
          {keptCount.toLocaleString()} / {n.toLocaleString()} pts
        </div>
      </div>

      {/* ── Controls panel ── */}
      <div className="flex-shrink-0 border-t p-4 space-y-4"
           style={{ background: '#111118', borderColor: '#1f1f2e' }}>

        {/* Track bar — visual overview of selection */}
        <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#1f1f2e' }}>
          {/* trimmed-start (red) */}
          <div
            className="absolute top-0 left-0 h-full"
            style={{ width: `${pctStart}%`, background: 'rgba(239,68,68,.45)' }}
          />
          {/* kept (blue) */}
          <div
            className="absolute top-0 h-full bg-blue-500"
            style={{ left: `${pctStart}%`, width: `${pctEnd - pctStart}%` }}
          />
          {/* trimmed-end (red) */}
          <div
            className="absolute top-0 right-0 h-full"
            style={{ width: `${100 - pctEnd}%`, background: 'rgba(239,68,68,.45)' }}
          />
        </div>

        {/* Start slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-gray-300">Start</span>
            </div>
            <span className="text-xs text-gray-600 tabular-nums">{pctStart}%</span>
          </div>
          <input
            type="range" min={0} max={n - 2} value={startIdx}
            onChange={e => handleStart(e.target.value)}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#22c55e', background: '#1f1f2e' }}
          />
        </div>

        {/* End slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs font-medium text-gray-300">End</span>
            </div>
            <span className="text-xs text-gray-600 tabular-nums">{pctEnd}%</span>
          </div>
          <input
            type="range" min={1} max={n - 1} value={endIdx}
            onChange={e => handleEnd(e.target.value)}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#ef4444', background: '#1f1f2e' }}
          />
        </div>

        {/* Preview stats */}
        {preview && (
          <div className="grid grid-cols-3 gap-2">
            <StatChip label="Distance" value={formatDistance(preview.dist)} />
            <StatChip
              label="Duration"
              value={preview.duration ? formatDuration(Math.round(preview.duration)) : '—'}
            />
            <StatChip label="Elev ↑" value={formatElevation(preview.elevGain || 0)} />
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleReset}
            title="Reset to full track"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
            style={{ background: '#1f1f2e' }}
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 transition-colors"
            style={{ background: '#1f1f2e' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(startIdx, endIdx)}
            disabled={saving || !trimming}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving
              ? <Loader2 size={15} className="animate-spin" />
              : <Save size={15} />}
            Save Trim
          </button>
        </div>

      </div>
    </div>
  )
}

function StatChip({ label, value }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: '#1a1a28' }}>
      <div className="text-[11px] text-gray-600 mb-1">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  )
}
