import { useState, useEffect } from 'react'
import { Loader2, Map, Clock, Activity, Mountain } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../hooks/useApi'
import {
  formatDistance, formatDurationLong, formatSport, periodRange, movingSeconds,
} from '../utils/format'
import SportIcon from './SportIcon'

/**
 * "How am I doing this week / month / year" — the view phones used to get
 * from MobileStats, now available at every width.
 *
 * Totals are computed here from the workout list rather than from /stats,
 * because /stats has no week granularity. It uses the same movingSeconds()
 * helper the backend mirrors, so the numbers agree with everything else.
 */
const PERIODS = [
  { key: 'week',  label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year' },
]

function Tile({ icon, value, label }) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1">
        {icon}
        <span className="text-[10px] sm:text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
        {value}
      </div>
    </div>
  )
}

export default function PeriodSummary() {
  const [period, setPeriod]   = useState('month')
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const { from, to } = periodRange(period)
    // page_size well above any plausible period count; the endpoint no longer
    // loads GPS tracks, so this is cheap.
    api.get(`/workouts?date_from=${from}&date_to=${to}&page_size=2000`)
      .then(res => { if (!cancelled) setWorkouts(res.items) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [period])

  const totals = workouts.reduce((acc, w) => ({
    distance:  acc.distance + (w.distance_meters || 0),
    moving:    acc.moving + (movingSeconds(w) || 0),
    elevation: acc.elevation + (w.elevation_gain_meters || 0),
  }), { distance: 0, moving: 0, elevation: 0 })

  const bySport = Object.entries(
    workouts.reduce((acc, w) => {
      const k = w.sport || 'other'
      acc[k] ??= { count: 0, distance: 0, moving: 0 }
      acc[k].count += 1
      acc[k].distance += w.distance_meters || 0
      acc[k].moving += movingSeconds(w) || 0
      return acc
    }, {}),
  ).sort((a, b) => b[1].moving - a[1].moving)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          This {period}
        </h2>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                period === p.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="card p-4 text-sm text-red-500">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={22} className="animate-spin text-brand-500" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 dark:text-gray-600">
          <Activity size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Nothing logged this {period} yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile icon={<Map size={14} />}      label="Distance"  value={formatDistance(totals.distance, { compact: true })} />
            <Tile icon={<Clock size={14} />}    label="Moving"    value={formatDurationLong(totals.moving)} />
            <Tile icon={<Activity size={14} />} label="Workouts"  value={workouts.length} />
            <Tile icon={<Mountain size={14} />} label="Elevation" value={`${Math.round(totals.elevation).toLocaleString()} m`} />
          </div>

          <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
            {bySport.map(([sport, s]) => (
              <div key={sport} className="flex items-center gap-3 px-4 py-3">
                <SportIcon sport={sport} size={16} />
                <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {formatSport(sport)}
                </span>
                <span className="text-xs text-gray-400 tabular-nums w-10 text-right">{s.count}×</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-20 text-right">
                  {s.distance > 0 ? formatDistance(s.distance, { compact: true }) : '—'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-16 text-right">
                  {formatDurationLong(s.moving)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
