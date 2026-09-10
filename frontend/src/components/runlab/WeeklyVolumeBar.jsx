import { useState, useEffect } from 'react'
import { api } from '../../hooks/useApi'
import InfoTip from './InfoTip'

const W   = 600
const H   = 180
const PAD = { top: 16, right: 16, bottom: 36, left: 36 }
const IW  = W - PAD.left - PAD.right
const IH  = H - PAD.top - PAD.bottom

const EXPLAINER = "Your weekly running distance over the last 3 months. The line is your 4-week rolling average — it should rise gently, not spike."

function fmtWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function WeeklyVolumeBar() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/runlab/balance?window=84')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const weeks  = data?.weekly_volume ?? []
  const maxKm  = Math.max(...weeks.map(w => w.km), 1)
  const ceil   = maxKm * 1.15   // headroom above tallest bar

  // 4-week rolling average
  const rollingAvg = weeks.map((_, i) => {
    const slice = weeks.slice(Math.max(0, i - 3), i + 1)
    return slice.reduce((s, w) => s + w.km, 0) / slice.length
  })

  const scaleY = v => IH - (v / ceil) * IH
  const barW   = IW / Math.max(weeks.length, 1)
  const barPad = barW * 0.18

  const avgPts = rollingAvg
    .map((v, i) => `${(barW * i + barW / 2).toFixed(1)},${scaleY(v).toFixed(1)}`)
    .join(' ')

  // Nice Y ticks: 0, max/2, max (round up to nearest 5 or 10)
  const tickStep = ceil > 50 ? 20 : ceil > 20 ? 10 : ceil > 10 ? 5 : 2
  const yTicks = []
  for (let v = 0; v <= ceil + tickStep; v += tickStep) yTicks.push(v)

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Weekly Volume</h3>
          <InfoTip text={EXPLAINER} />
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">last 12 weeks</span>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : weeks.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-gray-600">
          No running data yet
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ height: 160, display: 'block' }}
          >
            <g transform={`translate(${PAD.left},${PAD.top})`}>

              {/* Y grid lines + labels */}
              {yTicks.filter(v => v <= ceil).map(v => (
                <g key={v}>
                  <line x1={0} x2={IW} y1={scaleY(v)} y2={scaleY(v)}
                    stroke="currentColor"
                    className={v === 0 ? 'text-gray-200 dark:text-gray-700' : 'text-gray-100 dark:text-gray-800'}
                    strokeWidth={1} />
                  <text x={-5} y={scaleY(v)} textAnchor="end" dominantBaseline="middle"
                    fontSize={9} fill="currentColor" className="text-gray-400 dark:text-gray-500">
                    {v}
                  </text>
                </g>
              ))}

              {/* Bars */}
              {weeks.map((w, i) => {
                const x          = barW * i + barPad
                const barHeight  = Math.max(2, (w.km / ceil) * IH)
                const y          = IH - barHeight
                const isThisWeek = i === weeks.length - 1
                return (
                  <g key={w.week_start}>
                    <rect
                      x={x} y={y}
                      width={barW - barPad * 2}
                      height={barHeight}
                      fill={isThisWeek ? 'rgba(59,130,246,0.9)' : 'rgba(59,130,246,0.55)'}
                      rx={2}
                    />
                    {/* km label above bar — only if tall enough */}
                    {w.km > 0 && barHeight > 16 && (
                      <text
                        x={barW * i + barW / 2} y={y - 3}
                        textAnchor="middle" fontSize={8}
                        fill="currentColor" className="text-gray-500 dark:text-gray-400">
                        {w.km}
                      </text>
                    )}
                    {/* X label — every 3rd bar */}
                    {i % 3 === 0 && (
                      <text
                        x={barW * i + barW / 2} y={IH + 14}
                        textAnchor="middle" fontSize={9}
                        fill="currentColor" className="text-gray-400 dark:text-gray-500">
                        {fmtWeekLabel(w.week_start)}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* 4-week rolling average line */}
              <polyline
                points={avgPts}
                fill="none"
                stroke="#f97316"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

            </g>
          </svg>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm bg-blue-400/70 inline-block" /> Weekly km
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-orange-400 inline-block rounded" /> 4-week avg
            </span>
          </div>
        </>
      )}
    </div>
  )
}
