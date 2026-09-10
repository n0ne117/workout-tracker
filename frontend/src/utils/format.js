import { sportMetric } from './sports'

const DASH = '—'

/**
 * Formatting helpers shared by every view.
 *
 * `compact` trades precision for width — it's what the old mobile-only
 * formatters did, and it's still the right choice inside narrow cards. The
 * difference is that both layouts now go through the same functions, so a
 * number can no longer disagree with itself across breakpoints.
 */

export function formatDuration(seconds, { compact = false } = {}) {
  if (!seconds) return DASH
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (compact) return h > 0 ? `${h}h ${m}m` : `${m}m`
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Long form for summary tiles: "12h 30m", "45m". */
export function formatDurationLong(seconds) {
  if (!seconds) return DASH
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

export function formatDistance(meters, { compact = false } = {}) {
  if (!meters) return DASH
  if (meters >= 1000) return `${(meters / 1000).toFixed(compact ? 1 : 2)} km`
  return `${Math.round(meters)} m`
}

export function formatPace(meters, seconds) {
  if (!meters || !seconds) return DASH
  const secsPerKm = (seconds / meters) * 1000
  return `${paceClock(secsPerKm)} /km`
}

/** Swimming convention: minutes and seconds per 100 m. */
export function formatSwimPace(meters, seconds) {
  if (!meters || !seconds) return DASH
  return `${paceClock((seconds / meters) * 100)} /100m`
}

export function formatSpeed(ms, { compact = false } = {}) {
  if (!ms) return DASH
  return `${(ms * 3.6).toFixed(compact ? 1 : 1)} km/h`
}

/** mm:ss from a seconds-per-unit value, rolling over past an hour. */
export function paceClock(secs) {
  if (!Number.isFinite(secs) || secs <= 0) return DASH
  const total = Math.round(secs)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Moving time for a workout, falling back to elapsed when the source didn't
 * record it.
 *
 * Always prefer this over `duration_seconds` for anything rate-shaped. Pace
 * from elapsed time counts every pause at a traffic light as running slowly:
 * one 8 km walk in this database reads 54:59/km elapsed versus 11:21/km
 * moving. Mirrors `_moving()` in backend/app/routers/workouts.py.
 */
export function movingSeconds(workout) {
  if (!workout) return null
  return workout.moving_time_seconds || workout.duration_seconds || null
}

/**
 * The headline rate for a workout, in whatever unit that sport actually uses,
 * always computed from moving time. Returns null when the sport has no
 * meaningful distance-based rate (strength training, yoga, …) or the data is
 * missing, so callers can simply omit the field.
 */
export function formatWorkoutRate(workout, { compact = false } = {}) {
  if (!workout?.distance_meters) return null
  const metric = sportMetric(workout.sport)
  if (!metric) return null

  const seconds = movingSeconds(workout)
  if (!seconds) return null

  if (metric === 'pace') return formatPace(workout.distance_meters, seconds)
  if (metric === 'swim') return formatSwimPace(workout.distance_meters, seconds)
  return formatSpeed(workout.distance_meters / seconds, { compact })
}

/**
 * Re-express a seconds-per-kilometre figure in whatever unit the sport uses.
 *
 * The /stats endpoint reports its "fastest" record as seconds per km for
 * every sport, which reads absurdly for anything wheeled — a 30 km/h ride
 * showed up as "2:00/km". Returns { label, value } so the caller can render
 * an honest row.
 */
export function formatRateFromPace(secsPerKm, sport) {
  if (!secsPerKm || secsPerKm <= 0) return null
  const metric = sportMetric(sport)

  if (metric === 'speed') {
    return { label: 'Best speed', value: `${(3600 / secsPerKm).toFixed(1)} km/h` }
  }
  if (metric === 'swim') {
    return { label: 'Best pace', value: `${paceClock(secsPerKm / 10)} /100m` }
  }
  return { label: 'Best pace', value: `${paceClock(secsPerKm)} /km` }
}

/** Label for whichever rate `formatWorkoutRate` produced. */
export function workoutRateLabel(sport) {
  const metric = sportMetric(sport)
  if (metric === 'pace') return 'Avg Pace'
  if (metric === 'swim') return 'Avg Pace'
  if (metric === 'speed') return 'Avg Speed'
  return null
}

export function formatElevation(meters) {
  if (meters == null) return DASH
  return `${Math.round(meters)} m`
}

export function formatHR(bpm) {
  if (!bpm) return DASH
  return `${bpm} bpm`
}

export function formatDate(dateStr) {
  if (!dateStr) return DASH
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatDatetime(dateStr) {
  if (!dateStr) return DASH
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/** "Today", "Yesterday", "Monday", "Apr 12" */
export function relativeDay(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  if (today - d < 7 * 86400000) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Local-date ISO string (YYYY-MM-DD).
 *
 * Deliberately not toISOString(), which converts to UTC and shifts the date
 * backwards for anyone east of Greenwich — local midnight Monday is Sunday
 * in UTC, so a "this week" filter would quietly start a day early.
 */
export function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week containing `from` (defaults to today). */
export function weekStart(from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

/** Inclusive date range for 'week' | 'month' | 'year'. */
export function periodRange(period, now = new Date()) {
  const to = isoDate(now)
  if (period === 'week') return { from: isoDate(weekStart(now)), to }
  if (period === 'month') {
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to }
  }
  return { from: `${now.getFullYear()}-01-01`, to }
}

// Re-exported so callers need only one import for sport-shaped formatting.
export { sportLabel as formatSport } from './sports'
