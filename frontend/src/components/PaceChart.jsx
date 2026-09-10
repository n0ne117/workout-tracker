import { useMemo, useState, useRef, useCallback } from 'react'

const W = 800
const H = 200
const PAD = { top: 12, right: 16, bottom: 32, left: 52 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

// 10 min/km in s/km — walk threshold reference line
const WALK_THRESHOLD = 600

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

function fmtPace(spk) {
  const m = Math.floor(spk / 60)
  const s = Math.round(spk % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PaceChart({ trackPoints, hoverDist, onHoverChange }) {
  const svgRef = useRef(null)
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

        // Path 1: derive pace from time delta (FIT/GPX ISO strings or Intervals.icu integer offsets)
        const t     = toSecs(p.time)
        const prevT = toSecs(prev.time)
        if (t != null && prevT != null && segDist > 0.005) {
          const segTime = t - prevT
          if (segTime > 0 && segTime < 120)
            pace = segTime / segDist // s/km
        }

        // Path 2: fall back to the speed field stored by the FIT parser / Intervals.icu streams (m/s)
        if (pace == null && p.speed != null && p.speed > 0.1)
          pace = 1000 / p.speed // s/km

        if (pace != null && pace >= 90 && pace <= 1500) // 1:30 – 25:00 /km sanity range
          raw.push({ d: cumDist, pace })
      }
      prev = p
    }

    if (raw.length < 10) return null

    // Rolling-window smoothing (±20 pts) to kill GPS noise
    const WIN = 20
    const smoothed = raw.map((p, i) => {
      const lo = Math.max(0, i - WIN)
      const hi = Math.min(raw.length - 1, i + WIN)
      let sum = 0
      for (let j = lo; j <= hi; j++) sum += raw[j].pace
      return { d: p.d, pace: sum / (hi - lo + 1) }
    })

    // Downsample to ≤600 points
    const step = Math.ceil(smoothed.length / 600)
    const sampled = step > 1 ? smoothed.filter((_, i) => i % step === 0) : smoothed
    if (sampled.length < 2) return null

    const maxDist = sampled[sampled.length - 1].d
    const sorted  = [...sampled.map(p => p.pace)].sort((a, b) => a - b)
    const p05     = sorted[Math.floor(sorted.length * 0.05)]
    const p95     = sorted[Math.floor(sorted.length * 0.95)]
    const margin  = (p95 - p05) * 0.12 || 30
    const yMin    = Math.max(60, p05 - margin)
    const yMax    = p95 + margin
    const median  = sorted[Math.floor(sorted.length / 2)]

    return { sampled, maxDist, yMin, yMax, median }
  }, [trackPoints])

  if (!data) return null
  const { sampled, maxDist, yMin, yMax, median } = data

  // Fast pace → small Y value → top of chart (peaks = fast sections)
  const scaleX = d    => (d / maxDist) * INNER_W
  const scaleY = pace => ((pace - yMin) / (yMax - yMin)) * INNER_H

  // Y ticks in pace units
  const paceRange = yMax - yMin
  const rawStep   = paceRange / 5
  const tickStep  = rawStep >= 90 ? Math.ceil(rawStep / 60) * 60 : rawStep >= 30 ? 30 : 15
  const yTicks    = []
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax + 0.1; v += tickStep) yTicks.push(v)

  const xTickStep = maxDist > 10 ? Math.ceil(maxDist / 10) : maxDist > 3 ? 1 : 0.5
  const xTicks = []
  for (let v = 0; v <= maxDist + 0.001; v += xTickStep) xTicks.push(parseFloat(v.toFixed(1)))

  const polyPoints = sampled
    .map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.pace).toFixed(1)}`)
    .join(' ')

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
    const wRect     = wrapper.getBoundingClientRect()
    setLocalHover({
      svgX: scaleX(pt.d), svgY: scaleY(pt.pace),
      mouseX: e.clientX - wRect.left, mouseY: e.clientY - wRect.top, pt,
    })
    onHoverChange?.(distKm)
  }, [sampled, maxDist, scaleX, scaleY, onHoverChange])

  const handleMouseLeave = useCallback(() => {
    setLocalHover(null)
    onHoverChange?.(null)
  }, [onHoverChange])

  const extPt      = (hoverDist != null && !localHover) ? nearestPoint(sampled, hoverDist) : null
  const crosshairX = localHover ? localHover.svgX : extPt ? scaleX(extPt.d)    : null
  const crosshairY = localHover ? localHover.svgY : extPt ? scaleY(extPt.pace) : null

  const wrapperWidth = wrapperRef.current?.offsetWidth ?? W
  const flipLeft     = localHover && (localHover.mouseX / wrapperWidth) > 0.65
  const svgScale     = Math.min(wrapperWidth / W, 180 / H)
  const svgOffsetX   = (wrapperWidth - W * svgScale) / 2
  const svgOffsetY   = (180 - H * svgScale) / 2
  const extTipX      = (extPt && crosshairX != null) ? svgOffsetX + (PAD.left + crosshairX) * svgScale : null
  const extTipY      = (extPt && crosshairY != null) ? svgOffsetY + (PAD.top  + crosshairY) * svgScale : null
  const extFlipLeft  = extTipX != null && (extTipX / wrapperWidth) > 0.65

  const headerPt = localHover?.pt ?? extPt

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pace</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {headerPt ? (
            <>
              <span className={`font-semibold ${localHover ? 'text-orange-500' : 'text-orange-400/70'}`}>
                {fmtPace(headerPt.pace)}/km
              </span>
              <span>{headerPt.d.toFixed(2)} km</span>
            </>
          ) : (
            <span>avg {fmtPace(median)}/km</span>
          )}
        </div>
      </div>

      <div className="relative" ref={wrapperRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 180, display: 'block' }}
          aria-label="Pace over distance"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f97316" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id="paceClip">
              <rect x={0} y={0} width={INNER_W} height={INNER_H} />
            </clipPath>
          </defs>

          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {/* Grid + Y labels */}
            {yTicks.map(v => (
              <g key={v}>
                <line x1={0} x2={INNER_W} y1={scaleY(v)} y2={scaleY(v)}
                  stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={1} />
                <text x={-6} y={scaleY(v)} textAnchor="end" dominantBaseline="middle"
                  fontSize={11} fill="currentColor" className="text-gray-400 dark:text-gray-500">
                  {fmtPace(v)}
                </text>
              </g>
            ))}

            {/* X labels */}
            {xTicks.map(v => (
              <g key={v}>
                <line x1={scaleX(v)} x2={scaleX(v)} y1={INNER_H} y2={INNER_H + 4}
                  stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
                <text x={scaleX(v)} y={INNER_H + 14} textAnchor="middle"
                  fontSize={11} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
              </g>
            ))}
            <text x={INNER_W / 2} y={INNER_H + 28} textAnchor="middle"
              fontSize={10} fill="currentColor" className="text-gray-400 dark:text-gray-500">km</text>

            {/* Walk threshold reference line */}
            {WALK_THRESHOLD >= yMin && WALK_THRESHOLD <= yMax && (
              <g>
                <line x1={0} x2={INNER_W} y1={scaleY(WALK_THRESHOLD)} y2={scaleY(WALK_THRESHOLD)}
                  stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" opacity={0.55} />
                <text x={INNER_W + 2} y={scaleY(WALK_THRESHOLD)} dominantBaseline="middle"
                  fontSize={9} fill="#f59e0b" opacity={0.7}>10′</text>
              </g>
            )}

            {/* Fill + line */}
            <polygon
              points={[
                `0,${INNER_H}`,
                ...sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.pace).toFixed(1)}`),
                `${scaleX(sampled[sampled.length - 1].d).toFixed(1)},${INNER_H}`,
              ].join(' ')}
              fill="url(#paceGrad)" clipPath="url(#paceClip)"
            />
            <polyline points={polyPoints} fill="none" stroke="#f97316"
              strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#paceClip)" />

            {/* Baseline */}
            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H}
              stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />

            {/* Crosshair */}
            {crosshairX != null && (
              <g>
                <line x1={crosshairX} x2={crosshairX} y1={0} y2={INNER_H}
                  stroke="#f97316" strokeWidth={1} strokeDasharray="3 2"
                  opacity={localHover ? 0.6 : 0.35} />
                <circle cx={crosshairX} cy={crosshairY} r={4} fill="#f97316" stroke="white"
                  strokeWidth={1.5} opacity={localHover ? 1 : 0.5} />
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
            {fmtPace(localHover.pt.pace)}/km · {localHover.pt.d.toFixed(2)} km
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
            {fmtPace(extPt.pace)}/km · {extPt.d.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  )
}
