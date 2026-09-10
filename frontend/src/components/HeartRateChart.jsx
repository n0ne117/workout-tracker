import { useMemo, useState, useRef, useCallback } from 'react'

const W = 800
const H = 488
const PAD = { top: 12, right: 16, bottom: 40, left: 56 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

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

export default function HeartRateChart({ trackPoints, maxHr, hoverDist, onHoverChange }) {
  const svgRef = useRef(null)
  const wrapperRef = useRef(null)
  const [localHover, setLocalHover] = useState(null)

  const data = useMemo(() => {
    if (!trackPoints?.length) return null
    const pts = []
    let cumDist = 0
    let prev = null
    for (const p of trackPoints) {
      if (p.lat == null || p.lon == null) { prev = p; continue }
      if (prev && prev.lat != null && prev.lon != null)
        cumDist += haversineKm(prev.lat, prev.lon, p.lat, p.lon)
      if (p.hr != null) pts.push({ d: cumDist, hr: p.hr })
      prev = p
    }
    if (pts.length < 2) return null
    const step = Math.ceil(pts.length / 600)
    const sampled = step > 1 ? pts.filter((_, i) => i % step === 0) : pts
    const maxDist = sampled[sampled.length - 1].d
    const hrs = sampled.map(p => p.hr)
    const minHR = Math.max(0, Math.min(...hrs) - 5)
    const maxHR = Math.max(...hrs) + 5
    return { sampled, maxDist, minHR, maxHR }
  }, [trackPoints])

  if (!data) return null
  const { sampled, maxDist, minHR, maxHR } = data

  const scaleX = d => (d / maxDist) * INNER_W
  const scaleY = hr => INNER_H - ((hr - minHR) / (maxHR - minHR)) * INNER_H

  const yTickStep = Math.ceil((maxHR - minHR) / 5 / 10) * 10
  const yTicks = []
  for (let v = Math.ceil(minHR / yTickStep) * yTickStep; v <= maxHR; v += yTickStep) yTicks.push(v)

  const xTickStep = maxDist > 10 ? Math.ceil(maxDist / 10) : maxDist > 3 ? 1 : 0.5
  const xTicks = []
  for (let v = 0; v <= maxDist + 0.001; v += xTickStep) xTicks.push(parseFloat(v.toFixed(1)))

  const points = sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.hr).toFixed(1)}`).join(' ')

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current
    const wrapper = wrapperRef.current
    if (!svg || !wrapper) return

    // Accurate coordinate mapping via SVG transform matrix
    const svgPt = svg.createSVGPoint()
    svgPt.x = e.clientX
    svgPt.y = e.clientY
    const svgCoord = svgPt.matrixTransform(svg.getScreenCTM().inverse())

    const innerX = svgCoord.x - PAD.left
    const clampedX = Math.max(0, Math.min(INNER_W, innerX))
    const distKm = (clampedX / INNER_W) * maxDist
    const pt = nearestPoint(sampled, distKm)

    // Tooltip: mouse position relative to the wrapper div
    const wRect = wrapper.getBoundingClientRect()
    const mouseX = e.clientX - wRect.left
    const mouseY = e.clientY - wRect.top

    setLocalHover({ svgX: scaleX(pt.d), svgY: scaleY(pt.hr), mouseX, mouseY, pt })
    onHoverChange?.(distKm)
  }, [sampled, maxDist, scaleX, scaleY, onHoverChange])

  const handleMouseLeave = useCallback(() => {
    setLocalHover(null)
    onHoverChange?.(null)
  }, [onHoverChange])

  // Crosshair driven by external hover when this chart isn't being hovered
  const extPt = (hoverDist != null && !localHover) ? nearestPoint(sampled, hoverDist) : null

  const crosshairX = localHover ? localHover.svgX : extPt ? scaleX(extPt.d) : null
  const crosshairY = localHover ? localHover.svgY : extPt ? scaleY(extPt.hr) : null

  const wrapperWidth = wrapperRef.current?.offsetWidth ?? W
  const flipLeft = localHover && (localHover.mouseX / wrapperWidth) > 0.65

  // With no fixed CSS height the SVG is always width-limited, so scale = width / W
  const svgScale = wrapperWidth / W
  const extTipX = (extPt && crosshairX != null) ? (PAD.left + crosshairX) * svgScale : null
  const extTipY = (extPt && crosshairY != null) ? (PAD.top  + crosshairY) * svgScale : null
  const extFlipLeft = extTipX != null && (extTipX / wrapperWidth) > 0.65

  const headerPt = localHover?.pt ?? extPt

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Heart Rate</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {headerPt ? (
            <>
              <span className={`font-semibold ${localHover ? 'text-red-500' : 'text-red-400/70'}`}>
                {headerPt.hr} bpm
              </span>
              <span>{headerPt.d.toFixed(2)} km</span>
            </>
          ) : (
            <>
              <span>avg {Math.round(sampled.reduce((s, p) => s + p.hr, 0) / sampled.length)} bpm</span>
              <span>max {Math.max(...sampled.map(p => p.hr))} bpm</span>
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
          aria-label="Heart rate over distance"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id="hrClip">
              <rect x={0} y={0} width={INNER_W} height={INNER_H} />
            </clipPath>
          </defs>

          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {yTicks.map(v => (
              <g key={v}>
                <line x1={0} x2={INNER_W} y1={scaleY(v)} y2={scaleY(v)}
                  stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={1} />
                <text x={-6} y={scaleY(v)} textAnchor="end" dominantBaseline="middle"
                  fontSize={18} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
              </g>
            ))}

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

            <polygon
              points={[`0,${INNER_H}`, ...sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.hr).toFixed(1)}`),
                `${scaleX(sampled[sampled.length - 1].d).toFixed(1)},${INNER_H}`].join(' ')}
              fill="url(#hrGrad)" clipPath="url(#hrClip)" />
            <polyline points={points} fill="none" stroke="#ef4444"
              strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#hrClip)" />

            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H}
              stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />

            {crosshairX != null && (
              <g>
                <line x1={crosshairX} x2={crosshairX} y1={0} y2={INNER_H}
                  stroke="#ef4444" strokeWidth={1} strokeDasharray="3 2"
                  opacity={localHover ? 0.6 : 0.35} />
                <circle cx={crosshairX} cy={crosshairY} r={4} fill="#ef4444" stroke="white"
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
              left: localHover.mouseX,
              top: localHover.mouseY,
              transform: `translate(${flipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
            }}
          >
            {localHover.pt.hr} bpm · {localHover.pt.d.toFixed(2)} km
          </div>
        )}
        {extPt && extTipX != null && (
          <div
            className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/75 dark:bg-gray-950/75 whitespace-nowrap shadow-lg"
            style={{
              left: extTipX,
              top: extTipY,
              transform: `translate(${extFlipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
            }}
          >
            {extPt.hr} bpm · {extPt.d.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  )
}
