import { useMemo, useState, useRef, useCallback } from 'react'

const W = 800
const H = 200
const PAD = { top: 8, right: 16, bottom: 40, left: 64 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

const WALK_THRESHOLD = 600 // 10:00/km in s/km

const RUN_COLOR  = '#3b82f6'
const WALK_COLOR = '#f59e0b'

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toSecs(t) {
  if (t == null) return null
  if (typeof t === 'number') return t
  const ms = Date.parse(t)
  return isNaN(ms) ? null : ms / 1000
}

function nearestPoint(sampled, distKm) {
  let lo = 0, hi = sampled.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sampled[mid].d < distKm) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(sampled[lo - 1].d - distKm) < Math.abs(sampled[lo].d - distKm)) lo--
  return sampled[lo]
}

export default function WalkRunChart({ trackPoints, hoverDist, onHoverChange }) {
  const svgRef     = useRef(null)
  const wrapperRef = useRef(null)
  const [localHover, setLocalHover] = useState(null)

  const data = useMemo(() => {
    if (!trackPoints?.length) return null

    const raw = []
    let cumDist = 0
    let prev = null

    for (const p of trackPoints) {
      if (p.lat == null || p.lon == null) { prev = p; continue }

      if (prev && prev.lat != null && prev.lon != null) {
        const segDist = haversineKm(prev.lat, prev.lon, p.lat, p.lon)
        cumDist += Math.max(0, segDist)

        let pace = null

        const t     = toSecs(p.time)
        const prevT = toSecs(prev.time)
        if (t != null && prevT != null && segDist > 0.005) {
          const segTime = t - prevT
          if (segTime > 0 && segTime < 120)
            pace = segTime / segDist
        }

        if (pace == null && p.speed != null && p.speed > 0.1)
          pace = 1000 / p.speed

        if (pace != null && pace >= 90 && pace <= 1500)
          raw.push({ d: cumDist, pace })
      }
      prev = p
    }

    if (raw.length < 10) return null

    // Same rolling-window smoothing as PaceChart
    const WIN = 20
    const smoothed = raw.map((p, i) => {
      const lo = Math.max(0, i - WIN)
      const hi = Math.min(raw.length - 1, i + WIN)
      let sum = 0
      for (let j = lo; j <= hi; j++) sum += raw[j].pace
      return { d: p.d, pace: sum / (hi - lo + 1) }
    })

    const step    = Math.ceil(smoothed.length / 600)
    const sampled = step > 1 ? smoothed.filter((_, i) => i % step === 0) : smoothed
    if (sampled.length < 2) return null

    const maxDist = sampled[sampled.length - 1].d

    // Collapse into contiguous run / walk segments
    const segments = []
    let cur = null
    for (const pt of sampled) {
      const walking = pt.pace > WALK_THRESHOLD
      if (!cur || cur.walking !== walking) {
        if (cur) cur.dEnd = pt.d
        segments.push((cur = { walking, dStart: pt.d, dEnd: pt.d }))
      } else {
        cur.dEnd = pt.d
      }
    }
    if (cur) cur.dEnd = maxDist

    // Stats for header
    const walkKm = segments
      .filter(s => s.walking)
      .reduce((sum, s) => sum + (s.dEnd - s.dStart), 0)
    const walkPct = maxDist > 0 ? Math.round((walkKm / maxDist) * 100) : 0

    // All running → don't bother showing this chart
    if (walkPct === 0) return null

    return { sampled, segments, maxDist, walkKm, walkPct }
  }, [trackPoints])

  if (!data) return null
  const { sampled, segments, maxDist, walkKm, walkPct } = data

  const scaleX = d => (d / maxDist) * INNER_W

  const xTickStep = maxDist > 10 ? Math.ceil(maxDist / 10) : maxDist > 3 ? 1 : 0.5
  const xTicks = []
  for (let v = 0; v <= maxDist + 0.001; v += xTickStep) xTicks.push(parseFloat(v.toFixed(1)))

  const handleMouseMove = useCallback((e) => {
    const svg     = svgRef.current
    const wrapper = wrapperRef.current
    if (!svg || !wrapper) return
    const svgPt = svg.createSVGPoint()
    svgPt.x = e.clientX; svgPt.y = e.clientY
    const svgCoord  = svgPt.matrixTransform(svg.getScreenCTM().inverse())
    const clampedX  = Math.max(0, Math.min(INNER_W, svgCoord.x - PAD.left))
    const distKm    = (clampedX / INNER_W) * maxDist
    const pt        = nearestPoint(sampled, distKm)
    const walking   = pt.pace > WALK_THRESHOLD
    const wRect     = wrapper.getBoundingClientRect()
    setLocalHover({
      svgX: scaleX(pt.d), walking,
      mouseX: e.clientX - wRect.left, mouseY: e.clientY - wRect.top, pt,
    })
    onHoverChange?.(distKm)
  }, [sampled, maxDist, scaleX, onHoverChange])

  const handleMouseLeave = useCallback(() => {
    setLocalHover(null)
    onHoverChange?.(null)
  }, [onHoverChange])

  const extPt     = (hoverDist != null && !localHover) ? nearestPoint(sampled, hoverDist) : null
  const crosshairX = localHover ? localHover.svgX : extPt ? scaleX(extPt.d) : null
  const crosshairColor = localHover
    ? (localHover.walking ? WALK_COLOR : RUN_COLOR)
    : extPt
      ? (extPt.pace > WALK_THRESHOLD ? WALK_COLOR : RUN_COLOR)
      : RUN_COLOR

  const wrapperWidth = wrapperRef.current?.offsetWidth ?? W
  const flipLeft     = localHover && (localHover.mouseX / wrapperWidth) > 0.65
  const svgScale     = wrapperWidth / W
  const extTipX      = (extPt && crosshairX != null) ? (PAD.left + crosshairX) * svgScale : null
  const extTipY      = extTipX != null ? (PAD.top + INNER_H / 2) * svgScale : null
  const extFlipLeft  = extTipX != null && (extTipX / wrapperWidth) > 0.65

  const hoverWalking = localHover?.walking ?? (extPt ? extPt.pace > WALK_THRESHOLD : null)
  const hoverPt      = localHover?.pt ?? extPt

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Walk / Run</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {hoverPt ? (
            <span className={`font-semibold ${
              hoverWalking
                ? localHover ? 'text-amber-500' : 'text-amber-400/70'
                : localHover ? 'text-blue-500'  : 'text-blue-400/70'
            }`}>
              {hoverWalking ? 'Walking' : 'Running'} · {hoverPt.d.toFixed(2)} km
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: WALK_COLOR }} />
                {walkPct}% walking ({walkKm.toFixed(1)} km)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: RUN_COLOR }} />
                {100 - walkPct}% running
              </span>
            </>
          )}
        </div>
      </div>

      <div className="relative" ref={wrapperRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ display: 'block' }}
          aria-label="Walk / run segments over distance"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={e => { if (e.touches[0]) handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }) }}
          onTouchEnd={handleMouseLeave}
        >
          <defs>
            <clipPath id="walkClip">
              <rect x={0} y={0} width={INNER_W} height={INNER_H} />
            </clipPath>
          </defs>

          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {/* Coloured segment bars */}
            {segments.map((seg, i) => (
              <rect
                key={i}
                x={scaleX(seg.dStart).toFixed(1)}
                y={0}
                width={Math.max(1, scaleX(seg.dEnd) - scaleX(seg.dStart)).toFixed(1)}
                height={INNER_H}
                fill={seg.walking ? WALK_COLOR : RUN_COLOR}
                opacity={0.75}
                clipPath="url(#walkClip)"
              />
            ))}

            {/* X labels */}
            {xTicks.map(v => (
              <g key={v}>
                <line x1={scaleX(v)} x2={scaleX(v)} y1={INNER_H} y2={INNER_H + 4}
                  stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
                <text x={scaleX(v)} y={INNER_H + 18} textAnchor="middle"
                  fontSize={18} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
              </g>
            ))}
            <text x={INNER_W / 2} y={INNER_H + 32} textAnchor="middle"
              fontSize={16} fill="currentColor" className="text-gray-400 dark:text-gray-500">km</text>

            {/* Top + bottom borders */}
            <line x1={0} x2={INNER_W} y1={0}       y2={0}
              stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H}
              stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />

            {/* Crosshair */}
            {crosshairX != null && (
              <g>
                <line x1={crosshairX} x2={crosshairX} y1={0} y2={INNER_H}
                  stroke="white" strokeWidth={1.5} strokeDasharray="3 2"
                  opacity={localHover ? 0.8 : 0.45} />
              </g>
            )}

            <rect x={0} y={0} width={INNER_W} height={INNER_H} fill="transparent" style={{ cursor: 'crosshair' }} />
          </g>
        </svg>

        {localHover && (
          <div
            className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/90 dark:bg-gray-950/90 whitespace-nowrap shadow-lg"
            style={{
              left: localHover.mouseX, top: localHover.mouseY,
              transform: `translate(${flipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
            }}
          >
            {localHover.walking ? 'Walking' : 'Running'} · {localHover.pt.d.toFixed(2)} km
          </div>
        )}
        {extPt && extTipX != null && (
          <div
            className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/75 dark:bg-gray-950/75 whitespace-nowrap shadow-lg"
            style={{
              left: extTipX, top: extTipY,
              transform: `translate(${extFlipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
            }}
          >
            {extPt.pace > WALK_THRESHOLD ? 'Walking' : 'Running'} · {extPt.d.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  )
}
