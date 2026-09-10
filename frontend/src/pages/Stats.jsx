import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import { formatSport, formatDuration, formatDistance, formatRateFromPace } from '../utils/format'
import SportIcon from '../components/SportIcon'
import { Loader2, TrendingUp, Activity, Map, Clock, Mountain, Trophy, ChevronLeft, ChevronRight } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="text-brand-500 dark:text-brand-400 flex-shrink-0">{icon}</div>
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
        {sub && <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
      </div>
    </div>
  )
}

// SVG bar chart – pure, no library
function BarChart({ data, valueKey, labelKey, colorFn, height = 160, unit = '' }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  const barW = Math.max(4, Math.floor(600 / data.length) - 2)
  const svgW = Math.max(600, data.length * (barW + 2))

  return (
    <div>
      <svg
        viewBox={`0 0 ${svgW} ${height + 24}`}
        width="100%"
        className="select-none"
        style={{ display: 'block' }}
      >
        {data.map((d, i) => {
          const barH = Math.max(2, (d[valueKey] / max) * height)
          const x = i * (barW + 2)
          const y = height - barH
          return (
            <g key={i}>
              <rect
                x={x} y={y} width={barW} height={barH}
                fill={colorFn ? colorFn(d, i) : '#3b82f6'}
                opacity={0.85}
                rx={2}
              />
              <text
                x={x + barW / 2} y={height + 14}
                textAnchor="middle" fontSize={9}
                fill="currentColor" opacity={0.5}
              >
                {d[labelKey]}
              </text>
              <title>{`${d[labelKey]}${d.year ? ' ' + d.year : ''}: ${d[valueKey]}${unit}`}</title>
              <rect x={x} y={0} width={barW} height={height + 20} fill="transparent" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// GitHub-style heatmap
function Heatmap({ heatmap }) {
  if (!heatmap || !Object.keys(heatmap).length) return null

  // Build 52-week grid ending today
  const today = new Date()
  const weeks = []
  // Start from Sunday 52 weeks ago
  const start = new Date(today)
  start.setDate(start.getDate() - 364 - start.getDay())

  for (let w = 0; w < 53; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start)
      cur.setDate(start.getDate() + w * 7 + d)
      const iso = cur.toISOString().slice(0, 10)
      week.push({ date: iso, count: heatmap[iso] || 0, future: cur > today })
    }
    weeks.push(week)
  }

  const max = Math.max(...Object.values(heatmap), 1)
  const cellSize = 11
  const gap = 2

  function cellColor(count, future) {
    if (future || count === 0) return null
    const intensity = Math.min(count / max, 1)
    // 4 levels
    if (intensity < 0.25) return '#bfdbfe'
    if (intensity < 0.5) return '#60a5fa'
    if (intensity < 0.75) return '#2563eb'
    return '#1d4ed8'
  }

  const DAY_LABELS = ['S','M','T','W','T','F','S']
  const totalWidth = weeks.length * (cellSize + gap)

  return (
    <div>
      <svg
        viewBox={`0 0 ${totalWidth + 20} ${(cellSize + gap) * 7 + 20}`}
        width="100%"
        className="select-none"
        style={{ display: 'block' }}
      >
        {/* Day labels */}
        {DAY_LABELS.map((l, i) => (
          <text key={i} x={0} y={i * (cellSize + gap) + cellSize - 2}
            fontSize={8} fill="currentColor" opacity={0.4}>{l}</text>
        ))}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            const color = cellColor(day.count, day.future)
            return (
              <g key={`${wi}-${di}`}>
                <rect
                  x={wi * (cellSize + gap) + 18}
                  y={di * (cellSize + gap)}
                  width={cellSize} height={cellSize}
                  fill={color || 'currentColor'}
                  opacity={color ? 1 : 0.07}
                  rx={2}
                />
                {day.count > 0 && <title>{day.date}: {day.count} workout{day.count > 1 ? 's' : ''}</title>}
              </g>
            )
          })
        )}
      </svg>
    </div>
  )
}

// Horizontal sport bar chart
function SportBreakdown({ bySport, metric = 'count' }) {
  if (!bySport) return null
  const sorted = Object.entries(bySport)
    .map(([sport, v]) => ({ sport, value: v[metric] }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const max = sorted[0]?.value || 1

  const SPORT_COLORS = {
    running: '#f97316', trail_running: '#22c55e', cycling: '#3b82f6',
    mountain_biking: '#f59e0b', swimming: '#06b6d4', hiking: '#84cc16',
    walking: '#10b981', indoor_cycling: '#8b5cf6', strength_training: '#ef4444',
    yoga: '#ec4899', cross_training: '#6366f1', triathlon: '#a855f7',
    rowing: '#14b8a6', skiing: '#0ea5e9', snowboarding: '#64748b',
    tennis: '#eab308', soccer: '#22c55e', basketball: '#f97316', other: '#6b7280',
  }

  return (
    <div className="space-y-2">
      {sorted.map(({ sport, value }) => (
        <div key={sport} className="flex items-center gap-3">
          <div className="w-28 flex items-center gap-1.5 flex-shrink-0">
            <SportIcon sport={sport} size={14} variant="plain" />
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{formatSport(sport)}</span>
          </div>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(value / max) * 100}%`,
                backgroundColor: SPORT_COLORS[sport] || '#6b7280',
                opacity: 0.8,
              }}
            />
          </div>
          <span className="text-xs font-mono text-gray-500 w-16 text-right flex-shrink-0">{
            metric === 'distance_km' ? `${value.toFixed(0)} km`
            : metric === 'moving_hours' ? `${value.toFixed(0)}h`
            : value
          }</span>
        </div>
      ))}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartMetric, setChartMetric] = useState('distance_km')
  const [sportMetric, setSportMetric] = useState('count')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    api.get('/workouts/stats').then(setStats).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={28} className="animate-spin text-brand-500" />
    </div>
  )
  if (!stats || stats.total === 0) return (
    <div className="card p-12 text-center text-gray-400">No workouts yet.</div>
  )

  const thisYear = new Date().getFullYear()
  const lastYear = thisYear - 1
  const byYear = Object.fromEntries((stats.by_year || []).map(y => [y.year, y]))

  const availableYears = [...new Set((stats.by_month || []).map(d => d.year))].sort()
  const minYear = availableYears[0] ?? thisYear
  const maxYear = availableYears[availableYears.length - 1] ?? thisYear
  const monthDataForYear = (stats.by_month || []).filter(d => d.year === selectedYear)

  const CHART_METRIC_OPTS = [
    { key: 'distance_km', label: 'Distance' },
    { key: 'moving_hours', label: 'Time' },
    { key: 'count', label: 'Count' },
  ]
  const SPORT_METRIC_OPTS = [
    { key: 'count', label: 'Activities' },
    { key: 'distance_km', label: 'Distance' },
    { key: 'moving_hours', label: 'Time' },
  ]

  const chartUnit = chartMetric === 'distance_km' ? ' km' : chartMetric === 'moving_hours' ? 'h' : ''

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Statistics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={<Activity size={20} />} label="Total" value={stats.total} sub="activities" />
        <StatCard icon={<Map size={20} />} label="Distance" value={`${stats.total_distance_km.toLocaleString()} km`} />
        <StatCard icon={<Clock size={20} />} label="Moving Time" value={`${stats.total_moving_hours.toLocaleString()} h`}
          sub={`${stats.total_elapsed_hours.toLocaleString()} h elapsed`} />
        <StatCard icon={<Mountain size={20} />} label="Elevation" value={`${stats.total_elevation_m.toLocaleString()} m`} />
        <StatCard icon={<Trophy size={20} />} label="Races" value={stats.races} />
      </div>

      {/* Year comparison */}
      {byYear[thisYear] && byYear[lastYear] && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Year Comparison</h2>
          <div className="grid grid-cols-2 gap-4">
            {[thisYear, lastYear].map(yr => {
              const y = byYear[yr]
              if (!y) return null
              return (
                <div key={yr}>
                  <div className="text-lg font-bold text-gray-900 dark:text-white mb-2">{yr}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Activities</span><span className="font-mono">{y.count}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Distance</span><span className="font-mono">{y.distance_km} km</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Time</span><span className="font-mono">{y.moving_hours} h</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Activity heatmap */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Activity Heatmap</h2>
        <Heatmap heatmap={stats.heatmap} />
      </div>

      {/* Monthly volume chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Monthly Volume</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedYear(y => Math.max(y - 1, minYear))}
                disabled={selectedYear <= minYear}
                className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold text-gray-900 dark:text-white w-12 text-center tabular-nums">
                {selectedYear}
              </span>
              <button
                onClick={() => setSelectedYear(y => Math.min(y + 1, maxYear))}
                disabled={selectedYear >= maxYear}
                className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
            {CHART_METRIC_OPTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setChartMetric(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartMetric === key
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <BarChart
          data={monthDataForYear}
          valueKey={chartMetric}
          labelKey="month_name"
          unit={chartUnit}
          colorFn={(d) => {
            const hue = (d.month - 1) * 30
            return `hsl(${200 + hue * 0.3}, 70%, 55%)`
          }}
        />
      </div>

      {/* Sport breakdown */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">By Sport</h2>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
            {SPORT_METRIC_OPTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSportMetric(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  sportMetric === key
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <SportBreakdown bySport={stats.by_sport} metric={sportMetric} />
      </div>

      {/* PRs */}
      {stats.prs && Object.keys(stats.prs).length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">Personal Records</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(stats.prs).map(([sport, pr]) => (
              <div key={sport} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <SportIcon sport={sport} size={16} variant="plain" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatSport(sport)}</span>
                </div>
                <div className="space-y-1">
                  {pr.longest_m && (
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Longest</span>
                      <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{formatDistance(pr.longest_m)}</span>
                    </div>
                  )}
                  {(() => {
                    const rate = formatRateFromPace(pr.fastest_pace_s_per_km, sport)
                    if (!rate) return null
                    return (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{rate.label}</span>
                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{rate.value}</span>
                      </div>
                    )
                  })()}
                  {pr.highest_elevation_m && (
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Most elevation</span>
                      <span className="font-mono font-medium text-gray-700 dark:text-gray-300">+{pr.highest_elevation_m} m</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
