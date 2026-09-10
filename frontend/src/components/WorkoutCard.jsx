import { Link } from 'react-router-dom'
import { Trophy, MapPin, Heart, Zap, Clock, TrendingUp } from 'lucide-react'
import { formatDuration, formatDistance, formatDate, formatSport, sportIcon, sportColorClass, formatPace, formatSpeed } from '../utils/format'
import clsx from 'clsx'

export default function WorkoutCard({ workout }) {
  const isRunOrHike = ['running', 'trail_running', 'hiking', 'walking'].includes(workout.sport)
  const isCycling = ['cycling', 'mountain_biking', 'indoor_cycling'].includes(workout.sport)

  return (
    <Link
      to={`/workouts/${workout.id}`}
      className="card p-4 flex flex-col gap-3 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={clsx('badge', sportColorClass(workout.sport))}>
              {sportIcon(workout.sport)} {formatSport(workout.sport)}
            </span>
            {workout.is_race && (
              <span className="badge bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                <Trophy size={10} className="mr-1" /> Race
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mt-1 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {workout.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(workout.started_at)}</p>
        </div>
        {workout.has_track && (
          <MapPin size={16} className="text-gray-400 dark:text-gray-600 flex-shrink-0 mt-1" />
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={<Clock size={13} />}
          label="Time"
          value={formatDuration(workout.duration_seconds)}
        />
        <Stat
          icon={<MapPin size={13} />}
          label="Distance"
          value={formatDistance(workout.distance_meters)}
        />
        <Stat
          icon={<TrendingUp size={13} />}
          label={isRunOrHike ? 'Pace' : isCycling ? 'Speed' : 'Elev.'}
          value={
            isRunOrHike
              ? formatPace(workout.distance_meters, workout.moving_time_seconds || workout.duration_seconds)
              : isCycling
              ? formatSpeed(workout.avg_speed_ms)
              : workout.elevation_gain_meters != null
              ? `+${Math.round(workout.elevation_gain_meters)}m`
              : '—'
          }
        />
      </div>

      {/* HR / calories */}
      {(workout.avg_heart_rate || workout.calories) && (
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2">
          {workout.avg_heart_rate && (
            <span className="flex items-center gap-1">
              <Heart size={12} className="text-red-400" />
              {workout.avg_heart_rate} bpm
            </span>
          )}
          {workout.calories && (
            <span className="flex items-center gap-1">
              <Zap size={12} className="text-yellow-400" />
              {workout.calories} kcal
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-0.5 mb-0.5">
        {icon} {label}
      </span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}
