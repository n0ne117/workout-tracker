import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api, buildWorkoutQuery } from '../hooks/useApi'
import WorkoutTable from '../components/WorkoutTable'
import FilterBar from '../components/FilterBar'
import { Trophy, Ruler, Zap, Loader2 } from 'lucide-react'
import { formatDuration, formatDistance, formatPace } from '../utils/format'

// Distances in meters with ±tolerance
const RACE_DISTANCES = [
  { key: '5k',     label: '5K',            target: 5000,    tol: 400   },
  { key: '10k',    label: '10K',           target: 10000,   tol: 600   },
  { key: 'half',   label: '½ Marathon',    target: 21097,   tol: 2000  },
  { key: 'full',   label: 'Marathon',      target: 42195,   tol: 3000  },
]

function bestForDistance(workouts, target, tol) {
  // Among workouts within tolerance, pick fastest (lowest moving_time or duration)
  return workouts
    .filter(w => w.distance_meters && Math.abs(w.distance_meters - target) <= tol)
    .reduce((best, w) => {
      const t = w.moving_time_seconds || w.duration_seconds
      if (!t) return best
      if (!best) return w
      const bestT = best.moving_time_seconds || best.duration_seconds
      return t < bestT ? w : best
    }, null)
}

function farthestRace(workouts) {
  return workouts.reduce((best, w) => {
    if (!w.distance_meters) return best
    if (!best || w.distance_meters > best.distance_meters) return w
    return best
  }, null)
}

function RaceStat({ label, sublabel, value, sub, to }) {
  const inner = (
    <div className="card p-4 flex flex-col gap-1 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </div>
      <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">{value}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
      {sublabel && <div className="text-xs text-brand-500 mt-0.5">{sublabel}</div>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

export default function Races() {
  const [filters, setFilters] = useState({ page: 1, pageSize: 500, isRace: true })
  const [workouts, setWorkouts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildWorkoutQuery(filters)
      const res = await api.get(`/workouts?${q}`)
      setWorkouts(res.items)
      setTotal(res.total)
    } catch {}
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  const publicFilters = { ...filters, isRace: undefined }
  function handleFilterChange(f) {
    setFilters({ ...f, isRace: true })
  }

  // All races across all filters (use full unfiltered list for PRs)
  const stats = useMemo(() => {
    if (!workouts.length) return null
    const farthest = farthestRace(workouts)
    const bests = RACE_DISTANCES.map(d => ({
      ...d,
      workout: bestForDistance(workouts, d.target, d.tol),
    })).filter(d => d.workout)
    return { farthest, bests }
  }, [workouts])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Trophy size={22} className="text-yellow-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Races &amp; Competitions</h1>
        {!loading && (
          <span className="text-sm text-gray-400">({total})</span>
        )}
      </div>

      {/* PR header row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.farthest && (
            <RaceStat
              label="Farthest"
              value={formatDistance(stats.farthest.distance_meters)}
              sub={formatPace(stats.farthest.distance_meters, stats.farthest.moving_time_seconds || stats.farthest.duration_seconds)}
              sublabel={stats.farthest.title}
              to={`/workouts/${stats.farthest.id}`}
            />
          )}
          {stats.bests.map(({ key, label, workout }) => {
            const t = workout.moving_time_seconds || workout.duration_seconds
            return (
              <RaceStat
                key={key}
                label={label}
                value={formatDuration(t)}
                sub={formatPace(workout.distance_meters, t)}
                sublabel={workout.title}
                to={`/workouts/${workout.id}`}
              />
            )
          })}
        </div>
      )}

      <FilterBar filters={publicFilters} onChange={handleFilterChange} />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-brand-500" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 dark:text-gray-600">
          <Trophy size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No races yet</p>
          <p className="text-sm mt-1">Mark a workout as a race on its detail page</p>
        </div>
      ) : (
        <WorkoutTable workouts={workouts} loading={false} search="__expand_all__" linkState={{ from: 'races' }} />
      )}
    </div>
  )
}
