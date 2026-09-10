import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { api } from '../../hooks/useApi'
import InfoTip from './InfoTip'

const W = 900
const H = 220
const PAD = { top: 16, right: 20, bottom: 36, left: 48 }
const IW = W - PAD.left - PAD.right
const IH = H - PAD.top - PAD.bottom

const RANGES = ['3m', '6m', '1y', 'all']

const EXPLAINER = "This chart shows your training story. Blue is fitness (slow gain), red is fatigue (fast spikes after hard weeks), green/red area is how fresh you feel. Races are marked as vertical lines."

export default function PMCChart() {
  const [range, setRange]       = useState('6m')
  const [pmc, setPmc]           = useState([])
  const [races, setRaces]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [hover, setHover]       = useState(null)

  const svgRef     = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/runlab/pmc?range=${range}`),
      api.get('/race-calendar'),
    ]).then(([p, r]) => {
      setPmc(p)
      setRaces(r.filter(rc => ['planned', 'registered'].includes(rc.status)))
    }).catch(() => setPmc([])).finally(() => setLoading(false))
  }, [range])

  const { scaleX, scaleY, minDate, maxDate, minVal, maxVal, yTicks, xTicks } = useMemo(() => {
    if (!pmc.length) return {}
    const dates = pmc.map(d => new Date(d.date).getTime())
    const minDate = Math.min(...dates)
    const maxDate = Math.max(...dates)

    const allVals = pmc.flatMap(d => [d.ctl, d.atl, d.tsb]).filter(v => v != null)
    const rawMin = Math.min(0, ...allVals)
    const rawMax = Math.max(...allVals)
    const pad    = (rawMax - rawMin) * 0.08
    const minVal = rawMin - pad
    const maxVal = rawMax + pad

    const scaleX = t  => ((t - minDate) / (maxDate - minDate)) * IW
    const scaleY = v  => IH - ((v - minVal) / (maxVal - minVal)) * IH

    // Y ticks — ~5 nice values
    const range = rawMax - rawMin
    const step  = Math.ceil(range / 5 / 5) * 5 || 5
    const yTicks = []
    for (let v = Math.floor(rawMin / step) * step; v <= rawMax + step; v += step)
      yTicks.push(v)

    // X ticks — one per month
    const start = new Date(minDate); start.setDate(1)
    const end   = new Date(maxDate)
    const xTicks = []
    let d = new Date(start)
    while (d <= end) {
      xTicks.push(new Date(d))
      d.setMonth(d.getMonth() + 1)
    }

    return { scaleX, scaleY, minDate, maxDate, minVal, maxVal, yTicks, xTicks }
  }, [pmc])

  const zeroY = scaleY ? scaleY(0) : IH / 2

  // Build polyline point strings
  const ctlPts = pmc.map(d => `${scaleX(new Date(d.date).getTime()).toFixed(1)},${scaleY(d.ctl).toFixed(1)}`).join(' ')
  const atlPts = pmc.map(d => `${scaleX(new Date(d.date).getTime()).toFixed(1)},${scaleY(d.atl).toFixed(1)}`).join(' ')
  const tsbPts = pmc.map(d => `${scaleX(new Date(d.date).getTime()).toFixed(1)},${scaleY(d.tsb).toFixed(1)}`).join(' ')

  // TSB closed polygon for fill (closes to zero line)
  const tsbPolygon = pmc.length ? [
    `0,${zeroY.toFixed(1)}`,
    ...pmc.map(d => `${scaleX(new Date(d.date).getTime()).toFixed(1)},${scaleY(d.tsb).toFixed(1)}`),
    `${IW.toFixed(1)},${zeroY.toFixed(1)}`,
  ].join(' ') : ''

  // Race markers within date range
  const raceMarkers = races.filter(r => {
    const t = new Date(r.date).getTime()
    return t >= minDate && t <= maxDate
  })

  // Hover
  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current; const wrap = wrapperRef.current
    if (!svg || !wrap || !pmc.length || !scaleX) return
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const sp = pt.matrixTransform(svg.getScreenCTM().inverse())
    const ix  = sp.x - PAD.left
    const clx = Math.max(0, Math.min(IW, ix))
    const t   = minDate + (clx / IW) * (maxDate - minDate)
    // Find nearest point
    let best = pmc[0]; let bestDiff = Infinity
    for (const p of pmc) {
      const diff = Math.abs(new Date(p.date).getTime() - t)
      if (diff < bestDiff) { bestDiff = diff; best = p }
    }
    const wRect = wrap.getBoundingClientRect()
    setHover({ x: scaleX(new Date(best.date).getTime()), pt: best, mouseX: e.clientX - wRect.left, mouseY: e.clientY - wRect.top })
  }, [pmc, scaleX, minDate, maxDate])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  const wrapperWidth = wrapperRef.current?.offsetWidth ?? W
  const flipLeft = hover && (hover.mouseX / wrapperWidth) > 0.65

  if (loading) return (
    <div className="card p-4 h-64 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fitness / Fatigue / Form</h3>
          <InfoTip text={EXPLAINER} />
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> Fitness</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" /> Fatigue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Form</span>
          </div>
          {/* Range picker */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 font-medium transition-colors ${
                  range === r
                    ? 'bg-brand-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {pmc.length === 0 ? (
        <div className="flex items-center justify-center h-44 text-sm text-gray-400 dark:text-gray-600">
          Not enough data yet — sync more running activities.
        </div>
      ) : (
        <div className="relative" ref={wrapperRef}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ height: 200, display: 'block' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              {/* Clip positive TSB (green) */}
              <clipPath id="pmcPos">
                <rect x={0} y={0} width={IW} height={Math.max(0, zeroY)} />
              </clipPath>
              {/* Clip negative TSB (red) */}
              <clipPath id="pmcNeg">
                <rect x={0} y={Math.max(0, zeroY)} width={IW} height={Math.max(0, IH - zeroY)} />
              </clipPath>
            </defs>

            <g transform={`translate(${PAD.left},${PAD.top})`}>
              {/* Grid lines & y-axis */}
              {yTicks?.map(v => (
                <g key={v}>
                  <line x1={0} x2={IW} y1={scaleY(v)} y2={scaleY(v)}
                    stroke="currentColor"
                    className={v === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-100 dark:text-gray-800'}
                    strokeWidth={v === 0 ? 1.5 : 1} />
                  <text x={-6} y={scaleY(v)} textAnchor="end" dominantBaseline="middle"
                    fontSize={10} fill="currentColor" className="text-gray-400 dark:text-gray-500">{v}</text>
                </g>
              ))}

              {/* X-axis ticks */}
              {xTicks?.map((d, i) => (
                <g key={i}>
                  <line x1={scaleX(d.getTime())} x2={scaleX(d.getTime())}
                    y1={IH} y2={IH + 4}
                    stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={1} />
                  <text x={scaleX(d.getTime())} y={IH + 14} textAnchor="middle"
                    fontSize={10} fill="currentColor" className="text-gray-400 dark:text-gray-500">
                    {d.toLocaleDateString(undefined, { month: 'short' })}
                  </text>
                </g>
              ))}

              {/* Race markers */}
              {raceMarkers.map(r => {
                const x = scaleX(new Date(r.date).getTime())
                return (
                  <g key={r.id}>
                    <line x1={x} x2={x} y1={0} y2={IH}
                      stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
                    <text x={x + 3} y={8} fontSize={9} fill="#8b5cf6" opacity={0.8}>
                      {r.name?.split(' ').slice(0, 2).join(' ')}
                    </text>
                  </g>
                )
              })}

              {/* TSB area fill — positive (green) */}
              {tsbPolygon && (
                <polygon points={tsbPolygon} fill="rgba(34,197,94,0.18)" clipPath="url(#pmcPos)" />
              )}
              {/* TSB area fill — negative (red) */}
              {tsbPolygon && (
                <polygon points={tsbPolygon} fill="rgba(239,68,68,0.15)" clipPath="url(#pmcNeg)" />
              )}

              {/* ATL line (red, thinner) */}
              {atlPts && <polyline points={atlPts} fill="none" stroke="#f87171" strokeWidth={1.5} strokeLinejoin="round" />}

              {/* CTL line (blue, thick) */}
              {ctlPts && <polyline points={ctlPts} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" />}

              {/* TSB line */}
              {tsbPts && <polyline points={tsbPts} fill="none" stroke="#22c55e" strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4 2" />}

              {/* Hover crosshair */}
              {hover && (
                <g>
                  <line x1={hover.x} x2={hover.x} y1={0} y2={IH}
                    stroke="currentColor" className="text-gray-400 dark:text-gray-500"
                    strokeWidth={1} strokeDasharray="3 2" />
                  <circle cx={hover.x} cy={scaleY(hover.pt.ctl)} r={4} fill="#3b82f6" stroke="white" strokeWidth={1.5} />
                  <circle cx={hover.x} cy={scaleY(hover.pt.atl)} r={3.5} fill="#f87171" stroke="white" strokeWidth={1.5} />
                  <circle cx={hover.x} cy={scaleY(hover.pt.tsb)} r={3.5} fill="#22c55e" stroke="white" strokeWidth={1.5} />
                </g>
              )}

              {/* Invisible hit area */}
              <rect x={0} y={0} width={IW} height={IH} fill="transparent" style={{ cursor: 'crosshair' }} />
            </g>
          </svg>

          {/* Tooltip */}
          {hover && (
            <div
              className="pointer-events-none absolute z-10 px-3 py-2 rounded-xl text-xs
                         bg-gray-900/90 dark:bg-gray-950/90 text-white shadow-lg whitespace-nowrap"
              style={{
                left: hover.mouseX,
                top: hover.mouseY,
                transform: `translate(${flipLeft ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
              }}
            >
              <p className="font-semibold mb-1">
                {new Date(hover.pt.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-blue-300">Fitness: {hover.pt.ctl?.toFixed(1)}</p>
              <p className="text-red-300">Fatigue: {hover.pt.atl?.toFixed(1)}</p>
              <p className={hover.pt.tsb >= 0 ? 'text-green-300' : 'text-red-300'}>
                Form: {hover.pt.tsb?.toFixed(1)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
