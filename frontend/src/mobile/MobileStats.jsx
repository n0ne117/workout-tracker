import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../hooks/useApi'
import { getSportIcon, sportSolidBg, fmtDistance, fmtDuration, periodRange, relativeDay, fmtTime } from './utils'
import { formatSport, formatDate } from '../utils/format'

const PERIODS = [
  { key: 'week',  label: 'Week'  },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year'  },
]

function StatBig({ value, label, sub }) {
  if (!value && value !== 0) return null
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
      <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-2">{label}</div>
    </div>
  )
}

function fmtDurationLong(seconds) {
  if (!seconds) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h >= 10) return `${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── Single workout row ─────────────────────────────────────────────────────────
function WorkoutRow({ workout, onClick }) {
  const bg       = sportSolidBg(workout.sport)
  const SportIcon = getSportIcon(workout.sport)
  const dist     = fmtDistance(workout.distance_meters)
  const dur      = fmtDuration(workout.duration_seconds)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5
                 active:bg-gray-50 dark:active:bg-gray-800 transition-colors
                 border-b border-gray-50 dark:border-gray-800 last:border-0"
    >
      <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
        <SportIcon size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {workout.title || formatSport(workout.sport)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {relativeDay(workout.started_at)} · {fmtTime(workout.started_at)}
          {dist ? ` · ${dist}` : ''}
          {dur  ? ` · ${dur}`  : ''}
        </p>
      </div>
      <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MobileStats() {
  const navigate = useNavigate()
  const [period, setPeriod]               = useState('month')
  const [workouts, setWorkouts]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [selectedSport, setSelectedSport] = useState(null)

  useEffect(() => {
    load()
  }, [period])

  // Clear sport selection when period changes
  useEffect(() => {
    setSelectedSport(null)
  }, [period])

  async function load() {
    setLoading(true)
    try {
      const { from, to } = periodRange(period)
      const data = await api.get(`/workouts?date_from=${from}&date_to=${to}&page_size=500`)
      const list = Array.isArray(data) ? data : (data.items ?? [])
      setWorkouts(list)
    } catch {}
    setLoading(false)
  }

  // Totals
  const totalDist = workouts.reduce((s, w) => s + (w.distance_meters  || 0), 0)
  const totalTime = workouts.reduce((s, w) => s + (w.duration_seconds || 0), 0)
  const totalElev = workouts.reduce((s, w) => s + (w.elevation_gain_meters || 0), 0)
  const totalCal  = workouts.reduce((s, w) => s + (w.calories         || 0), 0)
  const count     = workouts.length

  // Sport breakdown
  const sportMap = {}
  for (const w of workouts) {
    const s = w.sport || 'other'
    if (!sportMap[s]) sportMap[s] = { count: 0, dist: 0, time: 0 }
    sportMap[s].count++
    sportMap[s].dist += w.distance_meters || 0
    sportMap[s].time += w.duration_seconds || 0
  }
  const sportList = Object.entries(sportMap)
    .map(([sport, v]) => ({ sport, ...v }))
    .sort((a, b) => b.dist - a.dist || b.time - a.time)
  const maxDist = sportList[0]?.dist || 1

  // Workouts for selected sport (newest first)
  const sportWorkouts = selectedSport
    ? workouts.filter(w => (w.sport || 'other') === selectedSport)
        .slice().sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    : []

  return (
    <div className="pb-8">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm
                   px-4 pt-3 pb-3 border-b border-gray-100 dark:border-gray-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        {/* Title row */}
        <div className="flex items-center gap-2 mb-3">
          {selectedSport && (
            <button
              onClick={() => setSelectedSport(null)}
              className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center
                         shadow-sm active:scale-90 transition-transform flex-shrink-0 -ml-1"
            >
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            {selectedSport ? formatSport(selectedSport) : 'Stats'}
          </h1>
        </div>

        {/* Period pills */}
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                period === p.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 px-4 space-y-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white dark:bg-gray-900 animate-pulse" />
            ))}
          </div>
        ) : selectedSport ? (
          /* ── Sport workout list ── */
          <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm">
            {sportWorkouts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No workouts</p>
            ) : (
              sportWorkouts.map(w => (
                <WorkoutRow
                  key={w.id}
                  workout={w}
                  onClick={() => navigate(`/workouts/${w.id}`)}
                />
              ))
            )}
          </div>
        ) : count === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <p className="text-4xl mb-3">📊</p>
            <p className="font-medium">No workouts this {period}</p>
          </div>
        ) : (
          <>
            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatBig
                value={totalDist >= 1000 ? `${(totalDist / 1000).toFixed(1)} km` : totalDist > 0 ? `${Math.round(totalDist)} m` : null}
                label="Distance"
              />
              <StatBig value={fmtDurationLong(totalTime)} label="Time" />
              <StatBig
                value={String(count)}
                label={count === 1 ? 'Workout' : 'Workouts'}
              />
              <StatBig
                value={totalElev > 0 ? `${Math.round(totalElev).toLocaleString()} m` : null}
                label="Elevation ↑"
              />
            </div>

            {totalCal > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Calories</span>
                <span className="font-bold text-gray-900 dark:text-white">{totalCal.toLocaleString()} kcal</span>
              </div>
            )}

            {/* Sport breakdown */}
            {sportList.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">By sport</p>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {sportList.map(({ sport, count: sc, dist, time }) => {
                    const bg  = sportSolidBg(sport)
                    const pct = (dist / maxDist) * 100
                    const SI  = getSportIcon(sport)
                    return (
                      <button
                        key={sport}
                        onClick={() => setSelectedSport(sport)}
                        className="w-full px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                            <SI size={13} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                {formatSport(sport)}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-400">{sc}×</span>
                                <ChevronRight size={13} className="text-gray-300 dark:text-gray-600" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {dist > 0 && (
                            <span className="text-xs text-gray-500 w-16 flex-shrink-0">
                              {fmtDistance(dist)}
                            </span>
                          )}
                          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${bg} rounded-full transition-all duration-500`}
                              style={{ width: `${dist > 0 ? pct : Math.min((time / (totalTime || 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-12 text-right flex-shrink-0">
                            {fmtDurationLong(time)}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
