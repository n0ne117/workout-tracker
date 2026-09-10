// Zone-distribution and secondary metric charts, shared by every screen size.
//
// Recovered from the old mobile/MobileCharts.jsx: the desktop WorkoutDetail
// page already imported HrZoneChart and PowerZoneChart from it, so these were
// never really mobile-specific. Renamed to say what they are rather than which
// layout used to own them.
import { useMemo, useRef, useState, useCallback } from 'react'

// ── SVG canvas constants ───────────────────────────────────────────────────────
const W = 800
const H = 488
const PAD = { top: 8, right: 12, bottom: 34, left: 64 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

// ── Shared utilities ───────────────────────────────────────────────────────────
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

function fmtZoneTime(secs) {
  if (!secs) return '–'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.round(secs % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
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
  const step = Math.ceil(pts.length / 400)
  const sampled = step > 1 ? pts.filter((_, i) => i % step === 0) : pts
  const maxDist = sampled[sampled.length - 1].d
  if (maxDist < 0.01) return null
  const vals = sampled.map(p => p.val)
  const minVal = Math.min(...vals), maxVal = Math.max(...vals)
  const range = maxVal - minVal
  const pad = Math.max(range * 0.1, maxVal * 0.03, 1)
  return { sampled, maxDist, yMin: Math.max(0, minVal - pad), yMax: maxVal + pad, minVal, maxVal }
}

// ── Generic track line chart ───────────────────────────────────────────────────
// invertY=true: lower values render higher on screen (used for pace charts)
export function MobileTrackChart({
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

  // Y ticks
  const rawStep = (yMax - yMin) / 4
  const magnitude = rawStep > 0 ? Math.pow(10, Math.floor(Math.log10(rawStep))) : 1
  const yTickStep = Math.max(0.001, Math.ceil(rawStep / magnitude) * magnitude)
  const yTicks = []
  for (let v = Math.ceil(yMin / yTickStep) * yTickStep; v <= yMax + 0.001; v += yTickStep)
    yTicks.push(parseFloat(v.toFixed(4)))

  // X ticks
  const xTickStep = maxDist > 10 ? Math.ceil(maxDist / 10) : maxDist > 3 ? 1 : 0.5
  const xTicks = []
  for (let v = 0; v <= maxDist + 0.001; v += xTickStep)
    xTicks.push(parseFloat(v.toFixed(1)))

  const polyPoints = sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.val).toFixed(1)}`).join(' ')

  function pointerMove(clientX, clientY) {
    const svg = svgRef.current
    const wrapper = wrapperRef.current
    if (!svg || !wrapper) return
    const svgPt = svg.createSVGPoint()
    svgPt.x = clientX; svgPt.y = clientY
    const svgCoord = svgPt.matrixTransform(svg.getScreenCTM().inverse())
    const distKm = Math.max(0, Math.min(INNER_W, svgCoord.x - PAD.left)) / INNER_W * maxDist
    const pt = nearestPoint(sampled, distKm)
    const wRect = wrapper.getBoundingClientRect()
    setLocalHover({ svgX: scaleX(pt.d), svgY: scaleY(pt.val), mouseX: clientX - wRect.left, mouseY: clientY - wRect.top, pt })
    onHoverChange?.(distKm)
  }

  const handleMouseMove  = useCallback(e => pointerMove(e.clientX, e.clientY), [sampled, maxDist])
  const handleTouchMove  = useCallback(e => { if (e.touches[0]) pointerMove(e.touches[0].clientX, e.touches[0].clientY) }, [sampled, maxDist])
  const handlePointerEnd = useCallback(() => { setLocalHover(null); onHoverChange?.(null) }, [onHoverChange])

  const extPt = (hoverDist != null && !localHover) ? nearestPoint(sampled, hoverDist) : null
  const crossX = localHover ? localHover.svgX : extPt ? scaleX(extPt.d) : null
  const crossY = localHover ? localHover.svgY : extPt ? scaleY(extPt.val) : null

  const wrapperW  = wrapperRef.current?.offsetWidth ?? W
  const flipLeft  = localHover && (localHover.mouseX / wrapperW) > 0.65
  const headerPt  = localHover?.pt ?? extPt

  // Polygon fill path
  const fillPoints = [
    `0,${INNER_H}`,
    ...sampled.map(p => `${scaleX(p.d).toFixed(1)},${scaleY(p.val).toFixed(1)}`),
    `${scaleX(sampled[sampled.length - 1].d).toFixed(1)},${INNER_H}`,
  ].join(' ')

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {headerPt ? (
            <span className="font-semibold" style={{ color }}>{formatVal(headerPt.val)} {unit} · {headerPt.d.toFixed(2)} km</span>
          ) : (
            <span>avg {formatVal((minVal + maxVal) / 2)} · max {formatVal(maxVal)} {unit}</span>
          )}
        </div>
      </div>

      <div className="relative" ref={wrapperRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handlePointerEnd}
          onTouchMove={handleTouchMove}
          onTouchEnd={handlePointerEnd}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={INNER_W} height={INNER_H} />
            </clipPath>
          </defs>

          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {yTicks.map(v => (
              <g key={v}>
                <line x1={0} x2={INNER_W} y1={scaleY(v)} y2={scaleY(v)}
                  stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={1} />
                <text x={-6} y={scaleY(v)} textAnchor="end" dominantBaseline="middle"
                  fontSize={18} fill="currentColor" className="text-gray-400 dark:text-gray-500">
                  {formatYTick(v)}
                </text>
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

            <polygon points={fillPoints} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`} />
            <polyline points={polyPoints} fill="none" stroke={color}
              strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipId})`} />

            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H}
              stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1} />

            {crossX != null && (
              <g>
                <line x1={crossX} x2={crossX} y1={0} y2={INNER_H}
                  stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={localHover ? 0.6 : 0.35} />
                <circle cx={crossX} cy={crossY} r={4} fill={color} stroke="white"
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
            {formatVal(localHover.pt.val)} {unit} · {localHover.pt.d.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  )
}

// ── Zone distribution bar chart ────────────────────────────────────────────────
const HR_ZONE_COLORS  = ['#94a3b8', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#e879f9']
const PWR_ZONE_COLORS = ['#94a3b8', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f87171', '#e879f9']

export function MobileZoneChart({ zoneTimes, zoneColors, title }) {
  if (!zoneTimes?.length) return null
  const total = zoneTimes.reduce((s, t) => s + (t || 0), 0)
  if (total === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      <div className="space-y-2">
        {zoneTimes.map((secs, i) => {
          const pct = total > 0 ? (secs || 0) / total * 100 : 0
          const bg = zoneColors[i] ?? '#9ca3af'
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-gray-400 w-5 flex-shrink-0">Z{i + 1}</span>
              <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: bg }}
                />
              </div>
              <span className="text-[11px] text-gray-400 w-14 text-right flex-shrink-0 tabular-nums">
                {fmtZoneTime(secs)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Pace: speed in m/s → min/km (lower = faster, invertY so faster appears higher)
export function PaceChart({ trackPoints, hoverDist, onHoverChange }) {
  const fmtPaceVal = useCallback(v => {
    if (!v || !isFinite(v)) return '–'
    const m = Math.floor(v)
    const s = Math.round((v - m) * 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }, [])

  return (
    <MobileTrackChart
      trackPoints={trackPoints}
      field="speed"
      transform={ms => ms > 0.2 ? 1000 / (ms * 60) : null}
      filterFn={v => v >= 1.5 && v <= 25}
      color="#f97316"
      gradId="paceGrad"
      clipId="paceClip"
      title="Pace"
      unit="/km"
      formatVal={fmtPaceVal}
      formatYTick={fmtPaceVal}
      invertY={true}
      hoverDist={hoverDist}
      onHoverChange={onHoverChange}
    />
  )
}

const CADENCE_RPM_SPORTS = new Set(['cycling', 'mountain_biking', 'indoor_cycling', 'motorbiking'])

export function CadenceChart({ trackPoints, sport, hoverDist, onHoverChange }) {
  const unit = CADENCE_RPM_SPORTS.has(sport) ? 'rpm' : 'spm'
  return (
    <MobileTrackChart
      trackPoints={trackPoints}
      field="cad"
      filterFn={v => v > 0 && v < 300}
      color="#a855f7"
      gradId="cadGrad"
      clipId="cadClip"
      title="Cadence"
      unit={unit}
      hoverDist={hoverDist}
      onHoverChange={onHoverChange}
    />
  )
}

export function PowerChart({ trackPoints, hoverDist, onHoverChange }) {
  return (
    <MobileTrackChart
      trackPoints={trackPoints}
      field="power"
      filterFn={v => v > 0 && v < 3000}
      color="#eab308"
      gradId="powerGrad"
      clipId="powerClip"
      title="Power"
      unit="W"
      hoverDist={hoverDist}
      onHoverChange={onHoverChange}
    />
  )
}

export function VerticalOscillationChart({ trackPoints, hoverDist, onHoverChange }) {
  return (
    <MobileTrackChart
      trackPoints={trackPoints}
      field="vertical_oscillation"
      filterFn={v => v > 0 && v < 30}
      color="#06b6d4"
      gradId="voGrad"
      clipId="voClip"
      title="Vertical Oscillation"
      unit="cm"
      formatVal={v => v.toFixed(1)}
      formatYTick={v => v.toFixed(1)}
      hoverDist={hoverDist}
      onHoverChange={onHoverChange}
    />
  )
}

export function GroundContactChart({ trackPoints, hoverDist, onHoverChange }) {
  return (
    <MobileTrackChart
      trackPoints={trackPoints}
      field="ground_contact_time"
      filterFn={v => v > 50 && v < 1000}
      color="#14b8a6"
      gradId="gctGrad"
      clipId="gctClip"
      title="Ground Contact Time"
      unit="ms"
      hoverDist={hoverDist}
      onHoverChange={onHoverChange}
    />
  )
}

export function HrZoneChart({ zoneTimes }) {
  return <MobileZoneChart zoneTimes={zoneTimes?.slice(0, 5)} zoneColors={HR_ZONE_COLORS} title="Time in HR Zones" />
}

export function PowerZoneChart({ zoneTimes }) {
  return <MobileZoneChart zoneTimes={zoneTimes} zoneColors={PWR_ZONE_COLORS} title="Time in Power Zones" />
}
