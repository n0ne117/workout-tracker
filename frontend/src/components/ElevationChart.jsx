import { useMemo, useState, useRef, useCallback } from 'react'

const W = 800
const H = 488
const PAD = { top: 12, right: 16, bottom: 40, left: 64 }
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

export default function ElevationChart({ trackPoints, hoverDist, onHoverChange }) {
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
      if (p.ele != null) pts.push({ d: cumDist, ele: p.ele })
      prev = p
    }
    if (pts.length < 10) return null
    const step = Math.ceil(pts.length / 600)
    const sampled = step > 1 ? pts.filter((_, i) => i % step === 0) : pts
    const maxDist = sampled[sampled.length - 1].d
    const eles = sampled.map(p => p.ele)
    const minEle = Math.min(...eles)
    const maxEle = Math.max(...eles)
    const range = maxEle - minEle
    if (range < 5) return null
    const pad = range * 0.08
    const yMin = minEle - pad
    const yMax = maxEle + pad
    return { sampled, maxDist, yMin, yMax, minEle, maxEle }
  }, [trackPoints])

  if (!data) return null
  const { sampled, maxDist, yMin, yMax, minEle, maxEle } = data

  const scaleX = d => (d / maxDist) * INNER_W
  const scaleY = ele => INNER_H - ((ele - yMin) / (yMax - yMin)) * INNER_H

  const rawStep = (yMax - yMin) / 5
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const yTickStep = Math.ceil(rawStep / magnitude) * magnitude
  const yTicks = []
  for (let v = Math.ceil(yMin / yTickStep) * yTickStep; v <= yMax + 0.001; v += yTickStep)
    yTicks.push(Math.round(v))

  const xTickStep = maxDist > 10 ? Math.ceil(maxDist / 10) : maxDist > 3 ? 1 : 0.5
  const xTicks = []
  for (let v = 0; v <= maxDist + 0.001; v += xTickStep) xTicks.push(parseFloat(v.toFixed(1)))

  const polyPoints = sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.ele).toFixed(1)}`).join(' ')

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

    setLocalHover({ svgX: scaleX(pt.d), svgY: scaleY(pt.ele), mouseX, mouseY, pt })
    onHoverChange?.(distKm)
  }, [sampled, maxDist, scaleX, scaleY, onHoverChange])

  const handleMouseLeave = useCallback(() => {
    setLocalHover(null)
    onHoverChange?.(null)
  }, [onHoverChange])

  // Crosshair driven by external hover when this chart isn't being hovered
  const extPt = (hoverDist != null && !localHover) ? nearestPoint(sampled, hoverDist) : null

  const crosshairX = localHover ? localHover.svgX : extPt ? scaleX(extPt.d) : null
  const crosshairY = localHover ? localHover.svgY : extPt ? scaleY(extPt.ele) : null

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
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Elevation</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {headerPt ? (
            <>
              <span className={`font-semibold ${localHover ? 'text-green-500' : 'text-green-400/70'}`}>
                {Math.round(headerPt.ele)} m
              </span>
              <span>{headerPt.d.toFixed(2)} km</span>
            </>
          ) : (
            <>
              <span>min {Math.round(minEle)} m</span>
              <span>max {Math.round(maxEle)} m</span>
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
          aria-label="Elevation over distance"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.03" />
            </linearGradient>
            <clipPath id="eleClip">
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
              points={[`0,${INNER_H}`, ...sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.ele).toFixed(1)}`),
                `${scaleX(sampled[sampled.length - 1].d).toFixed(1)},${INNER_H}`].join(' ')}
              fill="url(#eleGrad)" clipPath="url(#eleClip)" />
            <polyline points={polyPoints} fill="none" stroke="#22c55e"
              strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#eleClip)" />

            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H}
              stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />

            {crosshairX != null && (
              <g>
                <line x1={crosshairX} x2={crosshairX} y1={0} y2={INNER_H}
                  stroke="#22c55e" strokeWidth={1} strokeDasharray="3 2"
                  opacity={localHover ? 0.6 : 0.35} />
                <circle cx={crosshairX} cy={crosshairY} r={4} fill="#22c55e" stroke="white"
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
            {Math.round(localHover.pt.ele)} m · {localHover.pt.d.toFixed(2)} km
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
            {Math.round(extPt.ele)} m · {extPt.d.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  )
}
