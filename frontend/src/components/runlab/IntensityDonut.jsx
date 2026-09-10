import { useState, useEffect } from 'react'
import { api } from '../../hooks/useApi'
import InfoTip from './InfoTip'

const EXPLAINER = "Elite runners spend ~80% of their time easy (zones 1–2) and 20% hard (zones 3–5). Most hobby runners run their easy days too hard and their hard days too easy. This chart shows your balance."

const ZONES = [
  { key: 'z1', label: 'Z1 Recovery', color: '#94a3b8', fill: 'bg-slate-400' },
  { key: 'z2', label: 'Z2 Aerobic',  color: '#3b82f6', fill: 'bg-blue-500' },
  { key: 'z3', label: 'Z3 Tempo',    color: '#22c55e', fill: 'bg-green-500' },
  { key: 'z4', label: 'Z4 Threshold',color: '#f97316', fill: 'bg-orange-500' },
  { key: 'z5', label: 'Z5 VO2max',   color: '#ef4444', fill: 'bg-red-500' },
]

const WINDOWS = [7, 28, 90]

function fmtTime(s) {
  if (!s) return '0m'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// SVG arc for a donut slice
function polarToXY(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function donutPath(cx, cy, ro, ri, startDeg, endDeg) {
  const o1 = polarToXY(cx, cy, ro, startDeg)
  const o2 = polarToXY(cx, cy, ro, endDeg)
  const i1 = polarToXY(cx, cy, ri, endDeg)
  const i2 = polarToXY(cx, cy, ri, startDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${ro} ${ro} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${ri} ${ri} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

export default function IntensityDonut() {
  const [window, setWindow]   = useState(28)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/runlab/balance?window=${window}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [window])

  const zones = data?.zone_times ?? {}
  const total = ZONES.reduce((s, z) => s + (zones[z.key] || 0), 0)
  const easyPct = total > 0
    ? Math.round(((zones.z1 || 0) + (zones.z2 || 0)) / total * 100)
    : null

  // Build slices
  const slices = []
  let angle = 0
  for (const z of ZONES) {
    const secs = zones[z.key] || 0
    const sweep = total > 0 ? (secs / total) * 358 : 0  // 358 to leave a tiny gap
    if (sweep > 0.5) {
      slices.push({ ...z, startDeg: angle, endDeg: angle + sweep, secs })
    }
    angle += sweep
  }

  const CX = 60, CY = 60, RO = 52, RI = 34

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Intensity Balance</h3>
          <InfoTip text={EXPLAINER} />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
          {WINDOWS.map(w => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`px-2 py-1 font-medium transition-colors ${
                window === w
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-gray-600">
          No HR zone data in this period
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="flex-shrink-0">
            <svg width={120} height={120} viewBox="0 0 120 120">
              {slices.length > 0 ? slices.map((s, i) => (
                <path
                  key={i}
                  d={donutPath(CX, CY, RO, RI, s.startDeg, s.endDeg)}
                  fill={s.color}
                />
              )) : (
                <circle cx={CX} cy={CY} r={RO} fill="none" stroke="#e5e7eb" strokeWidth={RO - RI} />
              )}
              {/* Center label */}
              <text x={CX} y={CY - 6} textAnchor="middle" fontSize={15} fontWeight="700"
                fill="currentColor" className="text-gray-900 dark:text-white">
                {easyPct ?? '—'}%
              </text>
              <text x={CX} y={CY + 10} textAnchor="middle" fontSize={9}
                fill="#94a3b8">
                Easy
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5">
            {ZONES.map(z => {
              const secs = zones[z.key] || 0
              const pct  = total > 0 ? Math.round(secs / total * 100) : 0
              return (
                <div key={z.key} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${z.fill}`} />
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">{z.label}</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums w-8 text-right">
                    {pct}%
                  </span>
                  <span className="text-xs text-gray-400 tabular-nums w-12 text-right">{fmtTime(secs)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
