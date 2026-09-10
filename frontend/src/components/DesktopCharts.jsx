import { useMemo, useRef, useState, useCallback } from 'react'

// Matches PaceChart: compact line charts at 180px CSS height
const W = 800
const H = 200
const PAD = { top: 12, right: 16, bottom: 32, left: 52 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom
const CSS_H = 180

const WALK_THRESHOLD = 600

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
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

function buildTrackData(trackPoints, field, transform, filterFn) {
  if (!trackPoints?.length) return null
  const pts = []
  let cumDist = 0, prev = null
  for (const p of trackPoints) {
    if (p.lat == null || p.lon == null) { prev = p; continue }
    if (prev?.lat != null && prev?.lon != null)
      cumDist += haversineKm(prev.lat, prev.lon, p.lat, p.lon)
    const raw = p[field]
    if (raw != null) {
      const val = transform ? transform(raw) : raw
      if (val != null && isFinite(val) && (!filterFn || filterFn(val)))
        pts.push({ d: cumDist, val })
    }
    prev = p
  }
  if (pts.length < 2) return null
  const step = Math.ceil(pts.length / 600)
  const sampled = step > 1 ? pts.filter((_, i) => i % step === 0) : pts
  const maxDist = sampled[sampled.length - 1].d
  if (maxDist < 0.01) return null
  const vals = sampled.map(p => p.val)
  const minVal = Math.min(...vals), maxVal = Math.max(...vals)
  const range = maxVal - minVal
  const pad = Math.max(range * 0.1, maxVal * 0.03, 1)
  return { sampled, maxDist, yMin: Math.max(0, minVal - pad), yMax: maxVal + pad, minVal, maxVal }
}

// Tooltip offset helpers (desktop uses fixed CSS height)
function useSvgScale(wrapperRef) {
  const wrapperWidth = wrapperRef.current?.offsetWidth ?? W
  const svgScale   = Math.min(wrapperWidth / W, CSS_H / H)
  const svgOffsetX = (wrapperWidth - W * svgScale) / 2
  const svgOffsetY = (CSS_H - H * svgScale) / 2
  return { wrapperWidth, svgScale, svgOffsetX, svgOffsetY }
}

// ── Generic desktop line chart ─────────────────────────────────────────────────
function DesktopLineChart({
  trackPoints, field, transform, filterFn,
  color, gradId, clipId,
  title, unit,
  formatVal = v => Math.round(v),
  formatYTick = v => Math.round(v),
  invertY = false,
  hoverDist, onHoverChange,
}) {
  const svgRef     = useRef(null)
  const wrapperRef = useRef(null)
  const [localHover, setLocalHover] = useState(null)

  const data = useMemo(
    () => buildTrackData(trackPoints, field, transform, filterFn),
    [trackPoints, field, transform, filterFn]
  )

  if (!data) return null
  const { sampled, maxDist, yMin, yMax, minVal, maxVal } = data

  const scaleX = d => (d / maxDist) * INNER_W
  const scaleY = val => invertY
    ? ((val - yMin) / (yMax - yMin)) * INNER_H
    : INNER_H - ((val - yMin) / (yMax - yMin)) * INNER_H

  const rawStep = (yMax - yMin) / 4
  const magnitude = rawStep > 0 ? Math.pow(10, Math.floor(Math.log10(rawStep))) : 1
  const yTickStep = Math.max(0.001, Math.ceil(rawStep / magnitude) * magnitude)
  const yTicks = []
  for (let v = Math.ceil(yMin / yTickStep) * yTickStep; v <= yMax + 0.001; v += yTickStep)
    yTicks.push(parseFloat(v.toFixed(4)))

  const xTickStep = maxDist > 10 ? Math.ceil(maxDist / 10) : maxDist > 3 ? 1 : 0.5
  const xTicks = []
  for (let v = 0; v <= maxDist + 0.001; v += xTickStep)
    xTicks.push(parseFloat(v.toFixed(1)))

  const polyPoints = sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.val).toFixed(1)}`).join(' ')
  const fillPoints = [`0,${INNER_H}`, ...sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.val).toFixed(1)}`),
    `${scaleX(sampled[sampled.length - 1].d).toFixed(1)},${INNER_H}`].join(' ')

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current; const wrapper = wrapperRef.current
    if (!svg || !wrapper) return
    const svgPt = svg.createSVGPoint()
    svgPt.x = e.clientX; svgPt.y = e.clientY
    const svgCoord = svgPt.matrixTransform(svg.getScreenCTM().inverse())
    const distKm = Math.max(0, Math.min(INNER_W, svgCoord.x - PAD.left)) / INNER_W * maxDist
    const pt = nearestPoint(sampled, distKm)
    const wRect = wrapper.getBoundingClientRect()
    setLocalHover({ svgX: scaleX(pt.d), svgY: scaleY(pt.val), mouseX: e.clientX - wRect.left, mouseY: e.clientY - wRect.top, pt })
    onHoverChange?.(distKm)
  }, [sampled, maxDist])

  const handleMouseLeave = useCallback(() => { setLocalHover(null); onHoverChange?.(null) }, [onHoverChange])

  const extPt  = (hoverDist != null && !localHover) ? nearestPoint(sampled, hoverDist) : null
  const crossX = localHover ? localHover.svgX : extPt ? scaleX(extPt.d) : null
  const crossY = localHover ? localHover.svgY : extPt ? scaleY(extPt.val) : null
  const headerPt = localHover?.pt ?? extPt

  const { wrapperWidth, svgScale, svgOffsetX, svgOffsetY } = useSvgScale(wrapperRef)
  const flipLeft    = localHover && (localHover.mouseX / wrapperWidth) > 0.65
  const extTipX     = (extPt && crossX != null) ? svgOffsetX + (PAD.left + crossX) * svgScale : null
  const extTipY     = (extPt && crossY != null) ? svgOffsetY + (PAD.top  + crossY) * svgScale : null
  const extFlipLeft = extTipX != null && (extTipX / wrapperWidth) > 0.65

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {headerPt ? (
            <span className={`font-semibold ${localHover ? '' : 'opacity-60'}`} style={{ color }}>
              {formatVal(headerPt.val)} {unit} · {headerPt.d.toFixed(2)} km
            </span>
          ) : (
            <span>avg {formatVal((minVal + maxVal) / 2)} · max {formatVal(maxVal)} {unit}</span>
          )}
        </div>
      </div>
      <div className="relative" ref={wrapperRef}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: CSS_H, display: 'block' }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
            <clipPath id={clipId}><rect x={0} y={0} width={INNER_W} height={INNER_H} /></clipPath>
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {yTicks.map(v => (
              <g key={v}>
                <line x1={0} x2={INNER_W} y1={scaleY(v)} y2={scaleY(v)} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={1} />
                <text x={-6} y={scaleY(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="currentColor" className="text-gray-400 dark:text-gray-500">{formatYTick(v)}</text>
              </g>
            ))}
            {xTicks.map(v => (
              <g key={v}>
                <line x1={scaleX(v)} x2={scaleX(v)} y1={INNER_H} y2={INNER_H + 4} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
                <text x={scaleX(v)} y={INNER_H + 14} textAnchor="middle" fontSize={11} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
              </g>
            ))}
            <text x={INNER_W / 2} y={INNER_H + 28} textAnchor="middle" fontSize={10} fill="currentColor" className="text-gray-400 dark:text-gray-500">km</text>
            <polygon points={fillPoints} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`} />
            <polyline points={polyPoints} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipId})`} />
            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
            {crossX != null && (
              <g>
                <line x1={crossX} x2={crossX} y1={0} y2={INNER_H} stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={localHover ? 0.6 : 0.35} />
                <circle cx={crossX} cy={crossY} r={4} fill={color} stroke="white" strokeWidth={1.5} opacity={localHover ? 1 : 0.5} />
              </g>
            )}
            <rect x={0} y={0} width={INNER_W} height={INNER_H} fill="transparent" style={{ cursor: 'crosshair' }} />
          </g>
        </svg>
        {localHover && (
          <div className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/90 dark:bg-gray-950/90 whitespace-nowrap shadow-lg"
            style={{ left: localHover.mouseX, top: localHover.mouseY, transform: `translate(${flipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
            {formatVal(localHover.pt.val)} {unit} · {localHover.pt.d.toFixed(2)} km
          </div>
        )}
        {extPt && extTipX != null && (
          <div className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/75 dark:bg-gray-950/75 whitespace-nowrap shadow-lg"
            style={{ left: extTipX, top: extTipY, transform: `translate(${extFlipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
            {formatVal(extPt.val)} {unit} · {extPt.d.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  )
}

// ── Heart Rate ─────────────────────────────────────────────────────────────────
export function HeartRateChart({ trackPoints, hoverDist, onHoverChange }) {
  const svgRef = useRef(null); const wrapperRef = useRef(null)
  const [localHover, setLocalHover] = useState(null)

  const data = useMemo(() => {
    if (!trackPoints?.length) return null
    const pts = []; let cumDist = 0, prev = null
    for (const p of trackPoints) {
      if (p.lat == null || p.lon == null) { prev = p; continue }
      if (prev?.lat != null && prev?.lon != null) cumDist += haversineKm(prev.lat, prev.lon, p.lat, p.lon)
      if (p.hr != null) pts.push({ d: cumDist, hr: p.hr })
      prev = p
    }
    if (pts.length < 2) return null
    const step = Math.ceil(pts.length / 600)
    const sampled = step > 1 ? pts.filter((_, i) => i % step === 0) : pts
    const maxDist = sampled[sampled.length - 1].d
    const hrs = sampled.map(p => p.hr)
    return { sampled, maxDist, minHR: Math.max(0, Math.min(...hrs) - 5), maxHR: Math.max(...hrs) + 5 }
  }, [trackPoints])

  if (!data) return null
  const { sampled, maxDist, minHR, maxHR } = data

  const scaleX = d  => (d / maxDist) * INNER_W
  const scaleY = hr => INNER_H - ((hr - minHR) / (maxHR - minHR)) * INNER_H

  const yTickStep = Math.ceil((maxHR - minHR) / 5 / 10) * 10
  const yTicks = []
  for (let v = Math.ceil(minHR / yTickStep) * yTickStep; v <= maxHR; v += yTickStep) yTicks.push(v)
  const xTickStep = maxDist > 10 ? Math.ceil(maxDist / 10) : maxDist > 3 ? 1 : 0.5
  const xTicks = []
  for (let v = 0; v <= maxDist + 0.001; v += xTickStep) xTicks.push(parseFloat(v.toFixed(1)))

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current; const wrapper = wrapperRef.current; if (!svg || !wrapper) return
    const svgPt = svg.createSVGPoint(); svgPt.x = e.clientX; svgPt.y = e.clientY
    const svgCoord = svgPt.matrixTransform(svg.getScreenCTM().inverse())
    const distKm = Math.max(0, Math.min(INNER_W, svgCoord.x - PAD.left)) / INNER_W * maxDist
    const pt = nearestPoint(sampled, distKm)
    const wRect = wrapper.getBoundingClientRect()
    setLocalHover({ svgX: scaleX(pt.d), svgY: scaleY(pt.hr), mouseX: e.clientX - wRect.left, mouseY: e.clientY - wRect.top, pt })
    onHoverChange?.(distKm)
  }, [sampled, maxDist])
  const handleMouseLeave = useCallback(() => { setLocalHover(null); onHoverChange?.(null) }, [onHoverChange])

  const extPt  = (hoverDist != null && !localHover) ? nearestPoint(sampled, hoverDist) : null
  const crossX = localHover ? localHover.svgX : extPt ? scaleX(extPt.d) : null
  const crossY = localHover ? localHover.svgY : extPt ? scaleY(extPt.hr) : null
  const { wrapperWidth, svgScale, svgOffsetX, svgOffsetY } = useSvgScale(wrapperRef)
  const flipLeft    = localHover && (localHover.mouseX / wrapperWidth) > 0.65
  const extTipX     = (extPt && crossX != null) ? svgOffsetX + (PAD.left + crossX) * svgScale : null
  const extTipY     = (extPt && crossY != null) ? svgOffsetY + (PAD.top  + crossY) * svgScale : null
  const extFlipLeft = extTipX != null && (extTipX / wrapperWidth) > 0.65
  const headerPt    = localHover?.pt ?? extPt
  const avgHr       = Math.round(sampled.reduce((s, p) => s + p.hr, 0) / sampled.length)

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Heart Rate</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {headerPt ? (
            <><span className={`font-semibold ${localHover ? 'text-red-500' : 'text-red-400/70'}`}>{headerPt.hr} bpm</span><span>{headerPt.d.toFixed(2)} km</span></>
          ) : (
            <><span>avg {avgHr} bpm</span><span>max {Math.max(...sampled.map(p => p.hr))} bpm</span></>
          )}
        </div>
      </div>
      <div className="relative" ref={wrapperRef}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: CSS_H, display: 'block' }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <defs>
            <linearGradient id="dtHrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id="dtHrClip"><rect x={0} y={0} width={INNER_W} height={INNER_H} /></clipPath>
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {yTicks.map(v => (
              <g key={v}>
                <line x1={0} x2={INNER_W} y1={scaleY(v)} y2={scaleY(v)} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={1} />
                <text x={-6} y={scaleY(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
              </g>
            ))}
            {xTicks.map(v => (
              <g key={v}>
                <line x1={scaleX(v)} x2={scaleX(v)} y1={INNER_H} y2={INNER_H + 4} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
                <text x={scaleX(v)} y={INNER_H + 14} textAnchor="middle" fontSize={11} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
              </g>
            ))}
            <text x={INNER_W / 2} y={INNER_H + 28} textAnchor="middle" fontSize={10} fill="currentColor" className="text-gray-400 dark:text-gray-500">km</text>
            <polygon points={[`0,${INNER_H}`, ...sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.hr).toFixed(1)}`), `${scaleX(sampled[sampled.length-1].d).toFixed(1)},${INNER_H}`].join(' ')}
              fill="url(#dtHrGrad)" clipPath="url(#dtHrClip)" />
            <polyline points={sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.hr).toFixed(1)}`).join(' ')} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#dtHrClip)" />
            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
            {crossX != null && (
              <g>
                <line x1={crossX} x2={crossX} y1={0} y2={INNER_H} stroke="#ef4444" strokeWidth={1} strokeDasharray="3 2" opacity={localHover ? 0.6 : 0.35} />
                <circle cx={crossX} cy={crossY} r={4} fill="#ef4444" stroke="white" strokeWidth={1.5} opacity={localHover ? 1 : 0.5} />
              </g>
            )}
            <rect x={0} y={0} width={INNER_W} height={INNER_H} fill="transparent" style={{ cursor: 'crosshair' }} />
          </g>
        </svg>
        {localHover && (
          <div className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/90 dark:bg-gray-950/90 whitespace-nowrap shadow-lg"
            style={{ left: localHover.mouseX, top: localHover.mouseY, transform: `translate(${flipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
            {localHover.pt.hr} bpm · {localHover.pt.d.toFixed(2)} km
          </div>
        )}
        {extPt && extTipX != null && (
          <div className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/75 dark:bg-gray-950/75 whitespace-nowrap shadow-lg"
            style={{ left: extTipX, top: extTipY, transform: `translate(${extFlipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
            {extPt.hr} bpm · {extPt.d.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  )
}

// ── Elevation ──────────────────────────────────────────────────────────────────
export function ElevationChart({ trackPoints, hoverDist, onHoverChange }) {
  const svgRef = useRef(null); const wrapperRef = useRef(null)
  const [localHover, setLocalHover] = useState(null)

  const data = useMemo(() => {
    if (!trackPoints?.length) return null
    const pts = []; let cumDist = 0, prev = null
    for (const p of trackPoints) {
      if (p.lat == null || p.lon == null) { prev = p; continue }
      if (prev?.lat != null && prev?.lon != null) cumDist += haversineKm(prev.lat, prev.lon, p.lat, p.lon)
      if (p.ele != null) pts.push({ d: cumDist, ele: p.ele })
      prev = p
    }
    if (pts.length < 10) return null
    const step = Math.ceil(pts.length / 600)
    const sampled = step > 1 ? pts.filter((_, i) => i % step === 0) : pts
    const maxDist = sampled[sampled.length - 1].d
    const eles = sampled.map(p => p.ele)
    const minEle = Math.min(...eles), maxEle = Math.max(...eles)
    const range = maxEle - minEle
    if (range < 5) return null
    const pad = range * 0.08
    return { sampled, maxDist, yMin: minEle - pad, yMax: maxEle + pad, minEle, maxEle }
  }, [trackPoints])

  if (!data) return null
  const { sampled, maxDist, yMin, yMax, minEle, maxEle } = data

  const scaleX = d   => (d / maxDist) * INNER_W
  const scaleY = ele => INNER_H - ((ele - yMin) / (yMax - yMin)) * INNER_H

  const rawStep = (yMax - yMin) / 5
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const yTickStep = Math.ceil(rawStep / magnitude) * magnitude
  const yTicks = []
  for (let v = Math.ceil(yMin / yTickStep) * yTickStep; v <= yMax + 0.001; v += yTickStep) yTicks.push(Math.round(v))
  const xTickStep = maxDist > 10 ? Math.ceil(maxDist / 10) : maxDist > 3 ? 1 : 0.5
  const xTicks = []
  for (let v = 0; v <= maxDist + 0.001; v += xTickStep) xTicks.push(parseFloat(v.toFixed(1)))

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current; const wrapper = wrapperRef.current; if (!svg || !wrapper) return
    const svgPt = svg.createSVGPoint(); svgPt.x = e.clientX; svgPt.y = e.clientY
    const svgCoord = svgPt.matrixTransform(svg.getScreenCTM().inverse())
    const distKm = Math.max(0, Math.min(INNER_W, svgCoord.x - PAD.left)) / INNER_W * maxDist
    const pt = nearestPoint(sampled, distKm)
    const wRect = wrapper.getBoundingClientRect()
    setLocalHover({ svgX: scaleX(pt.d), svgY: scaleY(pt.ele), mouseX: e.clientX - wRect.left, mouseY: e.clientY - wRect.top, pt })
    onHoverChange?.(distKm)
  }, [sampled, maxDist])
  const handleMouseLeave = useCallback(() => { setLocalHover(null); onHoverChange?.(null) }, [onHoverChange])

  const extPt  = (hoverDist != null && !localHover) ? nearestPoint(sampled, hoverDist) : null
  const crossX = localHover ? localHover.svgX : extPt ? scaleX(extPt.d) : null
  const crossY = localHover ? localHover.svgY : extPt ? scaleY(extPt.ele) : null
  const { wrapperWidth, svgScale, svgOffsetX, svgOffsetY } = useSvgScale(wrapperRef)
  const flipLeft    = localHover && (localHover.mouseX / wrapperWidth) > 0.65
  const extTipX     = (extPt && crossX != null) ? svgOffsetX + (PAD.left + crossX) * svgScale : null
  const extTipY     = (extPt && crossY != null) ? svgOffsetY + (PAD.top  + crossY) * svgScale : null
  const extFlipLeft = extTipX != null && (extTipX / wrapperWidth) > 0.65
  const headerPt    = localHover?.pt ?? extPt

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Elevation</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {headerPt ? (
            <><span className={`font-semibold ${localHover ? 'text-green-500' : 'text-green-400/70'}`}>{Math.round(headerPt.ele)} m</span><span>{headerPt.d.toFixed(2)} km</span></>
          ) : (
            <><span>min {Math.round(minEle)} m</span><span>max {Math.round(maxEle)} m</span></>
          )}
        </div>
      </div>
      <div className="relative" ref={wrapperRef}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: CSS_H, display: 'block' }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <defs>
            <linearGradient id="dtEleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.03" />
            </linearGradient>
            <clipPath id="dtEleClip"><rect x={0} y={0} width={INNER_W} height={INNER_H} /></clipPath>
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {yTicks.map(v => (
              <g key={v}>
                <line x1={0} x2={INNER_W} y1={scaleY(v)} y2={scaleY(v)} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={1} />
                <text x={-6} y={scaleY(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
              </g>
            ))}
            {xTicks.map(v => (
              <g key={v}>
                <line x1={scaleX(v)} x2={scaleX(v)} y1={INNER_H} y2={INNER_H + 4} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
                <text x={scaleX(v)} y={INNER_H + 14} textAnchor="middle" fontSize={11} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
              </g>
            ))}
            <text x={INNER_W / 2} y={INNER_H + 28} textAnchor="middle" fontSize={10} fill="currentColor" className="text-gray-400 dark:text-gray-500">km</text>
            <polygon points={[`0,${INNER_H}`, ...sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.ele).toFixed(1)}`), `${scaleX(sampled[sampled.length-1].d).toFixed(1)},${INNER_H}`].join(' ')}
              fill="url(#dtEleGrad)" clipPath="url(#dtEleClip)" />
            <polyline points={sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.ele).toFixed(1)}`).join(' ')} fill="none" stroke="#22c55e" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#dtEleClip)" />
            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
            {crossX != null && (
              <g>
                <line x1={crossX} x2={crossX} y1={0} y2={INNER_H} stroke="#22c55e" strokeWidth={1} strokeDasharray="3 2" opacity={localHover ? 0.6 : 0.35} />
                <circle cx={crossX} cy={crossY} r={4} fill="#22c55e" stroke="white" strokeWidth={1.5} opacity={localHover ? 1 : 0.5} />
              </g>
            )}
            <rect x={0} y={0} width={INNER_W} height={INNER_H} fill="transparent" style={{ cursor: 'crosshair' }} />
          </g>
        </svg>
        {localHover && (
          <div className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/90 dark:bg-gray-950/90 whitespace-nowrap shadow-lg"
            style={{ left: localHover.mouseX, top: localHover.mouseY, transform: `translate(${flipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
            {Math.round(localHover.pt.ele)} m · {localHover.pt.d.toFixed(2)} km
          </div>
        )}
        {extPt && extTipX != null && (
          <div className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/75 dark:bg-gray-950/75 whitespace-nowrap shadow-lg"
            style={{ left: extTipX, top: extTipY, transform: `translate(${extFlipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
            {Math.round(extPt.ele)} m · {extPt.d.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  )
}

// ── Walk / Run ─────────────────────────────────────────────────────────────────
const RUN_COLOR  = '#3b82f6'
const WALK_COLOR = '#f59e0b'

function toSecs(t) {
  if (t == null) return null
  if (typeof t === 'number') return t
  const ms = Date.parse(t); return isNaN(ms) ? null : ms / 1000
}

export function WalkRunChart({ trackPoints, hoverDist, onHoverChange }) {
  const svgRef = useRef(null); const wrapperRef = useRef(null)
  const [localHover, setLocalHover] = useState(null)

  const data = useMemo(() => {
    if (!trackPoints?.length) return null
    const raw = []; let cumDist = 0, prev = null
    for (const p of trackPoints) {
      if (p.lat == null || p.lon == null) { prev = p; continue }
      if (prev?.lat != null && prev?.lon != null) {
        const segDist = haversineKm(prev.lat, prev.lon, p.lat, p.lon)
        cumDist += Math.max(0, segDist)
        let pace = null
        const t = toSecs(p.time), prevT = toSecs(prev.time)
        if (t != null && prevT != null && segDist > 0.005) {
          const st = t - prevT
          if (st > 0 && st < 120) pace = st / segDist
        }
        if (pace == null && p.speed != null && p.speed > 0.1) pace = 1000 / p.speed
        if (pace != null && pace >= 90 && pace <= 1500) raw.push({ d: cumDist, pace })
      }
      prev = p
    }
    if (raw.length < 10) return null
    const WIN = 20
    const smoothed = raw.map((p, i) => {
      const lo = Math.max(0, i - WIN), hi = Math.min(raw.length - 1, i + WIN)
      let sum = 0; for (let j = lo; j <= hi; j++) sum += raw[j].pace
      return { d: p.d, pace: sum / (hi - lo + 1) }
    })
    const step = Math.ceil(smoothed.length / 600)
    const sampled = step > 1 ? smoothed.filter((_, i) => i % step === 0) : smoothed
    if (sampled.length < 2) return null
    const maxDist = sampled[sampled.length - 1].d
    const segments = []; let cur = null
    for (const pt of sampled) {
      const walking = pt.pace > WALK_THRESHOLD
      if (!cur || cur.walking !== walking) { if (cur) cur.dEnd = pt.d; segments.push((cur = { walking, dStart: pt.d, dEnd: pt.d })) }
      else cur.dEnd = pt.d
    }
    if (cur) cur.dEnd = maxDist
    const walkKm = segments.filter(s => s.walking).reduce((sum, s) => sum + (s.dEnd - s.dStart), 0)
    const walkPct = maxDist > 0 ? Math.round((walkKm / maxDist) * 100) : 0
    if (walkPct === 0) return null
    return { sampled, segments, maxDist, walkKm, walkPct }
  }, [trackPoints])

  if (!data) return null
  const { sampled, segments, maxDist, walkKm, walkPct } = data

  // Use a compact bar height for desktop
  const BAR_H = 100
  const BAR_PAD = { top: 8, right: 16, bottom: 32, left: 52 }
  const BAR_IW = W - BAR_PAD.left - BAR_PAD.right
  const BAR_IH = BAR_H - BAR_PAD.top - BAR_PAD.bottom

  const scaleX = d => (d / maxDist) * BAR_IW
  const xTickStep = maxDist > 10 ? Math.ceil(maxDist / 10) : maxDist > 3 ? 1 : 0.5
  const xTicks = []
  for (let v = 0; v <= maxDist + 0.001; v += xTickStep) xTicks.push(parseFloat(v.toFixed(1)))

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current; const wrapper = wrapperRef.current; if (!svg || !wrapper) return
    const svgPt = svg.createSVGPoint(); svgPt.x = e.clientX; svgPt.y = e.clientY
    const svgCoord = svgPt.matrixTransform(svg.getScreenCTM().inverse())
    const distKm = Math.max(0, Math.min(BAR_IW, svgCoord.x - BAR_PAD.left)) / BAR_IW * maxDist
    const pt = nearestPoint(sampled, distKm)
    const wRect = wrapper.getBoundingClientRect()
    setLocalHover({ svgX: scaleX(pt.d), walking: pt.pace > WALK_THRESHOLD, mouseX: e.clientX - wRect.left, mouseY: e.clientY - wRect.top, pt })
    onHoverChange?.(distKm)
  }, [sampled, maxDist])
  const handleMouseLeave = useCallback(() => { setLocalHover(null); onHoverChange?.(null) }, [onHoverChange])

  const extPt = (hoverDist != null && !localHover) ? nearestPoint(sampled, hoverDist) : null
  const crossX = localHover ? localHover.svgX : extPt ? scaleX(extPt.d) : null

  const { wrapperWidth, svgScale, svgOffsetX } = useSvgScale(wrapperRef)
  // For a bar chart, use fixed bar height for external tooltip Y
  const barCssH = 80
  const barSvgScale = Math.min(wrapperWidth / W, barCssH / BAR_H)
  const barOffsetX  = (wrapperWidth - W * barSvgScale) / 2
  const barOffsetY  = (barCssH - BAR_H * barSvgScale) / 2
  const extTipX     = (extPt && crossX != null) ? barOffsetX + (BAR_PAD.left + crossX) * barSvgScale : null
  const extTipY     = extTipX != null ? barOffsetY + (BAR_PAD.top + BAR_IH / 2) * barSvgScale : null
  const extFlipLeft = extTipX != null && (extTipX / wrapperWidth) > 0.65
  const flipLeft    = localHover && (localHover.mouseX / wrapperWidth) > 0.65
  const hoverWalking = localHover?.walking ?? (extPt ? extPt.pace > WALK_THRESHOLD : null)
  const hoverPt      = localHover?.pt ?? extPt

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Walk / Run</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {hoverPt ? (
            <span className={`font-semibold ${hoverWalking ? (localHover ? 'text-amber-500' : 'text-amber-400/70') : (localHover ? 'text-blue-500' : 'text-blue-400/70')}`}>
              {hoverWalking ? 'Walking' : 'Running'} · {hoverPt.d.toFixed(2)} km
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: WALK_COLOR }} />{walkPct}% walking ({walkKm.toFixed(1)} km)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: RUN_COLOR }} />{100 - walkPct}% running</span>
            </>
          )}
        </div>
      </div>
      <div className="relative" ref={wrapperRef}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${BAR_H}`} className="w-full" style={{ height: barCssH, display: 'block' }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <defs><clipPath id="dtWrClip"><rect x={0} y={0} width={BAR_IW} height={BAR_IH} /></clipPath></defs>
          <g transform={`translate(${BAR_PAD.left},${BAR_PAD.top})`}>
            {segments.map((seg, i) => (
              <rect key={i} x={scaleX(seg.dStart).toFixed(1)} y={0}
                width={Math.max(1, scaleX(seg.dEnd) - scaleX(seg.dStart)).toFixed(1)} height={BAR_IH}
                fill={seg.walking ? WALK_COLOR : RUN_COLOR} opacity={0.75} clipPath="url(#dtWrClip)" />
            ))}
            {xTicks.map(v => (
              <g key={v}>
                <line x1={scaleX(v)} x2={scaleX(v)} y1={BAR_IH} y2={BAR_IH + 4} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
                <text x={scaleX(v)} y={BAR_IH + 14} textAnchor="middle" fontSize={11} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
              </g>
            ))}
            <text x={BAR_IW / 2} y={BAR_IH + 28} textAnchor="middle" fontSize={10} fill="currentColor" className="text-gray-400 dark:text-gray-500">km</text>
            <line x1={0} x2={BAR_IW} y1={0}     y2={0}     stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
            <line x1={0} x2={BAR_IW} y1={BAR_IH} y2={BAR_IH} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />
            {crossX != null && <line x1={crossX} x2={crossX} y1={0} y2={BAR_IH} stroke="white" strokeWidth={1.5} strokeDasharray="3 2" opacity={localHover ? 0.8 : 0.45} />}
            <rect x={0} y={0} width={BAR_IW} height={BAR_IH} fill="transparent" style={{ cursor: 'crosshair' }} />
          </g>
        </svg>
        {localHover && (
          <div className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/90 dark:bg-gray-950/90 whitespace-nowrap shadow-lg"
            style={{ left: localHover.mouseX, top: localHover.mouseY, transform: `translate(${flipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
            {localHover.walking ? 'Walking' : 'Running'} · {localHover.pt.d.toFixed(2)} km
          </div>
        )}
        {extPt && extTipX != null && (
          <div className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900/75 dark:bg-gray-950/75 whitespace-nowrap shadow-lg"
            style={{ left: extTipX, top: extTipY, transform: `translate(${extFlipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
            {extPt.pace > WALK_THRESHOLD ? 'Walking' : 'Running'} · {extPt.d.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  )
}

// ── Generic wrappers ───────────────────────────────────────────────────────────
const CADENCE_RPM_SPORTS = new Set(['cycling', 'mountain_biking', 'indoor_cycling', 'motorbiking'])

function fmtPaceVal(v) {
  if (!v || !isFinite(v)) return '–'
  const m = Math.floor(v), s = Math.round((v - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function PowerChart({ trackPoints, hoverDist, onHoverChange }) {
  return <DesktopLineChart trackPoints={trackPoints} field="power" filterFn={v => v > 0 && v < 3000}
    color="#eab308" gradId="dtPowGrad" clipId="dtPowClip" title="Power" unit="W" hoverDist={hoverDist} onHoverChange={onHoverChange} />
}

export function CadenceChart({ trackPoints, sport, hoverDist, onHoverChange }) {
  const unit = CADENCE_RPM_SPORTS.has(sport) ? 'rpm' : 'spm'
  return <DesktopLineChart trackPoints={trackPoints} field="cad" filterFn={v => v > 0 && v < 300}
    color="#a855f7" gradId="dtCadGrad" clipId="dtCadClip" title="Cadence" unit={unit} hoverDist={hoverDist} onHoverChange={onHoverChange} />
}

export function VerticalOscillationChart({ trackPoints, hoverDist, onHoverChange }) {
  return <DesktopLineChart trackPoints={trackPoints} field="vertical_oscillation" filterFn={v => v > 0 && v < 30}
    color="#06b6d4" gradId="dtVoGrad" clipId="dtVoClip" title="Vertical Oscillation" unit="cm"
    formatVal={v => v.toFixed(1)} formatYTick={v => v.toFixed(1)} hoverDist={hoverDist} onHoverChange={onHoverChange} />
}

export function GroundContactChart({ trackPoints, hoverDist, onHoverChange }) {
  return <DesktopLineChart trackPoints={trackPoints} field="ground_contact_time" filterFn={v => v > 50 && v < 1000}
    color="#14b8a6" gradId="dtGctGrad" clipId="dtGctClip" title="Ground Contact Time" unit="ms" hoverDist={hoverDist} onHoverChange={onHoverChange} />
}
