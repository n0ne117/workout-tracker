import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown, Trophy, Loader2 } from 'lucide-react'
import {
  formatDuration, formatDistance, formatPace, formatSpeed,
  formatDate, formatSport, sportIcon, sportColorClass,
} from '../utils/format'
import clsx from 'clsx'

const STORAGE_KEY = 'workout_table_collapsed'
const STORAGE_VERSION = 2 // bump to clear stale state from old logic
const VERSION_KEY = 'workout_table_collapsed_v'

export function loadCollapsed() {
  try {
    if (localStorage.getItem(VERSION_KEY) !== String(STORAGE_VERSION)) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION))
      return {}
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch { return {} }
}
export function saveCollapsed(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// Default open: all months of the current year, plus last 3 calendar months
// even if they spill into the previous year.
function buildDefaultOpen() {
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() // 0-based

  const openYears = new Set([String(curYear)])
  const openMonths = new Set()

  // All months of the current year
  for (let m = 0; m <= curMonth; m++) {
    openMonths.add(`m-${curYear}-${m}`)
  }

  // Last 3 calendar months (handles Jan/Feb roll-back into previous year)
  for (let i = 0; i < 3; i++) {
    let m = curMonth - i
    let y = curYear
    if (m < 0) { m += 12; y -= 1 }
    openMonths.add(`m-${y}-${m}`)
    openYears.add(String(y))
  }

  return { openYears, openMonths }
}

const { openYears, openMonths } = buildDefaultOpen()

export function defaultCollapsed(key) {
  if (key.startsWith('y-')) return !openYears.has(key.slice(2))
  return !openMonths.has(key)
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export function groupWorkouts(items) {
  const map = new Map()
  for (const w of items) {
    const d = new Date(w.started_at)
    if (isNaN(d.getTime())) continue // skip workouts with invalid dates
    const year = d.getFullYear()
    const month = d.getMonth() // 0-based
    const yKey = String(year)
    const mKey = `${year}-${month}`
    if (!map.has(yKey)) map.set(yKey, { year, months: new Map() })
    const yEntry = map.get(yKey)
    if (!yEntry.months.has(mKey)) yEntry.months.set(mKey, { month, year, workouts: [] })
    yEntry.months.get(mKey).workouts.push(w)
  }
  // Sort years desc, months desc
  const years = [...map.values()].sort((a, b) => b.year - a.year)
  for (const y of years) {
    y.monthsArr = [...y.months.values()].sort((a, b) => b.month - a.month)
  }
  return years
}

function WorkoutRow({ workout, linkState }) {
  const isRun = ['running', 'trail_running', 'hiking', 'walking'].includes(workout.sport)
  const isCyc = ['cycling', 'mountain_biking', 'indoor_cycling'].includes(workout.sport)
  const d = new Date(workout.started_at)
  const dayStr = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })

  return (
    <tr className="group border-t border-gray-100 dark:border-gray-800/60 hover:bg-brand-50/40 dark:hover:bg-brand-900/10 transition-colors">
      <td className="py-2 px-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap w-20">
        {dayStr}
      </td>
      <td className="py-2 px-2 w-10">
        <span className={clsx('inline-flex items-center justify-center w-7 h-7 rounded text-base leading-none', sportColorClass(workout.sport))}>
          {sportIcon(workout.sport)}
        </span>
      </td>
      <td className="py-2 px-2 max-w-xs">
        <div className="flex items-center gap-1.5">
          <Link
            to={`/workouts/${workout.id}`}
            state={linkState}
            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 truncate transition-colors"
          >
            {workout.title}
          </Link>
          {workout.is_race && (
            <Trophy size={11} className="text-yellow-500 flex-shrink-0" />
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-xs text-right tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {formatDuration(workout.duration_seconds)}
      </td>
      <td className="py-2 px-3 text-xs text-right tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {formatDistance(workout.distance_meters)}
      </td>
      <td className="py-2 px-3 text-xs text-right tabular-nums text-gray-500 dark:text-gray-500 whitespace-nowrap">
        {isRun
          ? formatPace(workout.distance_meters, workout.moving_time_seconds || workout.duration_seconds)
          : isCyc
          ? formatSpeed(workout.avg_speed_ms)
          : workout.elevation_gain_meters != null
          ? `+${Math.round(workout.elevation_gain_meters)}m`
          : '—'}
      </td>
      <td className="py-2 px-3 text-xs text-right tabular-nums text-gray-500 dark:text-gray-500 whitespace-nowrap">
        {workout.avg_heart_rate ? `${workout.avg_heart_rate}bpm` : '—'}
      </td>
    </tr>
  )
}

function MonthSection({ mEntry, collapseKey, collapsed, onToggle, searching, linkState }) {
  const isCollapsed = searching ? false : (collapsed[collapseKey] ?? defaultCollapsed(collapseKey))
  const totalDist = mEntry.workouts.reduce((s, w) => s + (w.distance_meters || 0), 0)
  const totalTime = mEntry.workouts.reduce((s, w) => s + (w.duration_seconds || 0), 0)

  return (
    <>
      {/* Month header row */}
      <tr
        className="cursor-pointer select-none bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        onClick={() => onToggle(collapseKey)}
      >
        <td colSpan={7} className="py-1.5 px-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-gray-500">
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </span>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              {MONTH_NAMES[mEntry.month]}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-600 ml-1">
              {mEntry.workouts.length} workout{mEntry.workouts.length !== 1 ? 's' : ''}
              {totalDist > 0 && ` · ${(totalDist / 1000).toFixed(0)} km`}
              {totalTime > 0 && ` · ${Math.round(totalTime / 3600)}h`}
            </span>
          </div>
        </td>
      </tr>
      {!isCollapsed && mEntry.workouts.map(w => (
        <WorkoutRow key={w.id} workout={w} linkState={linkState} />
      ))}
    </>
  )
}

function YearSection({ yEntry, collapsed, onToggle, searching, linkState }) {
  const yKey = `y-${yEntry.year}`
  const isCollapsed = searching ? false : (collapsed[yKey] ?? defaultCollapsed(yKey))
  const totalWorkouts = yEntry.monthsArr.reduce((s, m) => s + m.workouts.length, 0)
  const totalDist = yEntry.monthsArr.reduce(
    (s, m) => s + m.workouts.reduce((ss, w) => ss + (w.distance_meters || 0), 0), 0
  )

  return (
    <>
      {/* Year header */}
      <tr
        className="cursor-pointer select-none bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        onClick={() => onToggle(yKey)}
      >
        <td colSpan={7} className="py-2 px-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
              {yEntry.year}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {totalWorkouts} workouts
              {totalDist > 0 && ` · ${(totalDist / 1000).toFixed(0)} km`}
            </span>
          </div>
        </td>
      </tr>
      {!isCollapsed && yEntry.monthsArr.map(mEntry => (
        <MonthSection
          key={`${yEntry.year}-${mEntry.month}`}
          mEntry={mEntry}
          collapseKey={`m-${yEntry.year}-${mEntry.month}`}
          collapsed={collapsed}
          onToggle={onToggle}
          searching={searching}
          linkState={linkState}
        />
      ))}
    </>
  )
}

// Accepts optional controlled props (collapsed + onToggle) from a parent that
// wants to own the state (Dashboard). Falls back to internal state when not
// provided (Races page, etc.).
export default function WorkoutTable({
  workouts, loading, hasMore, loadingMore, onLoadMore, search = '', linkState,
  collapsed: collapsedProp,
  onToggle: onToggleProp,
}) {
  const [localCollapsed, setLocalCollapsed] = useState(loadCollapsed)

  const isControlled = collapsedProp !== undefined
  const collapsed = isControlled ? collapsedProp : localCollapsed

  function toggle(key) {
    if (isControlled) {
      onToggleProp?.(key)
    } else {
      setLocalCollapsed(prev => {
        const next = { ...prev, [key]: !prev[key] }
        saveCollapsed(next)
        return next
      })
    }
  }

  const grouped = groupWorkouts(workouts)
  const searching = search.trim().length > 0

  if (loading) return null

  if (!workouts.length) {
    return (
      <div className="card p-12 text-center text-gray-400 dark:text-gray-600">
        <div className="mb-3 text-5xl opacity-40">🏃</div>
        <p className="font-medium">No workouts found</p>
        <p className="text-sm mt-1">Import a .fit, .gpx or .tcx file to get started</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 px-3 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide w-20">Date</th>
            <th className="py-2 px-2 w-10"></th>
            <th className="py-2 px-2 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Activity</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Time</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Dist</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Pace/Spd</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">HR</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(yEntry => (
            <YearSection
              key={yEntry.year}
              yEntry={yEntry}
              collapsed={collapsed}
              onToggle={toggle}
              searching={searching}
              linkState={linkState}
            />
          ))}
        </tbody>
      </table>
      {hasMore && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-3 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="btn-secondary text-sm"
          >
            {loadingMore ? <Loader2 size={15} className="animate-spin" /> : null}
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
