import {
  Footprints, Bike, Waves, Dumbbell, Mountain,
  Activity, Zap, Wind, Timer, Trophy,
} from 'lucide-react'

// Map sport → lucide icon component
const SPORT_ICONS = {
  running:              Footprints,
  trail_running:        Mountain,
  cycling:              Bike,
  mountain_biking:      Bike,
  indoor_cycling:       Bike,
  swimming:             Waves,
  open_water_swimming:  Waves,
  hiking:               Footprints,
  walking:              Footprints,
  strength_training:    Dumbbell,
  calisthenics:         Dumbbell,
  cross_training:       Zap,
  motorbiking:          Bike,
  yoga:                 Wind,
  triathlon:            Trophy,
  rowing:               Waves,
  indoor_rowing:        Timer,
  skiing:               Mountain,
  snowboarding:         Mountain,
  other:                Activity,
}

export function getSportIcon(sport) {
  return SPORT_ICONS[sport] ?? Activity
}

// Solid fill colors for sport icon circles
export const SPORT_SOLID_BG = {
  running:              'bg-orange-500',
  trail_running:        'bg-emerald-600',
  cycling:              'bg-blue-500',
  mountain_biking:      'bg-amber-600',
  indoor_cycling:       'bg-violet-500',
  swimming:             'bg-cyan-500',
  open_water_swimming:  'bg-teal-500',
  hiking:               'bg-lime-600',
  walking:              'bg-green-500',
  strength_training:    'bg-red-500',
  calisthenics:         'bg-rose-500',
  cross_training:       'bg-indigo-500',
  motorbiking:          'bg-zinc-600',
  yoga:                 'bg-pink-500',
  triathlon:            'bg-purple-500',
  rowing:               'bg-sky-500',
  skiing:               'bg-sky-400',
  snowboarding:         'bg-slate-500',
  basketball:           'bg-orange-600',
  soccer:               'bg-green-600',
  tennis:               'bg-yellow-500',
  other:                'bg-gray-500',
}

export function sportSolidBg(sport) {
  return SPORT_SOLID_BG[sport] ?? SPORT_SOLID_BG.other
}

// Format helpers tuned for mobile (compact)
export function fmtDuration(seconds) {
  if (!seconds) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function fmtDistance(meters) {
  if (!meters) return null
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

export function fmtPace(meters, seconds) {
  if (!meters || !seconds) return null
  const spk = (seconds / meters) * 1000
  const m = Math.floor(spk / 60)
  const s = Math.round(spk % 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

export function fmtSpeed(ms) {
  if (!ms) return null
  return `${(ms * 3.6).toFixed(0)} km/h`
}

// Sports where pace (not speed) is the natural metric
export const PACE_SPORTS = new Set(['running', 'trail_running', 'walking', 'hiking'])

// "Today", "Yesterday", "Monday", "Apr 12"
export function relativeDay(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const today = new Date()
  const todayDate = today.toDateString()
  const dDate = d.toDateString()
  if (dDate === todayDate) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dDate === yesterday.toDateString()) return 'Yesterday'
  const diffMs = today - d
  if (diffMs < 7 * 86400000) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function fmtTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Get Monday of the current week
export function weekStart() {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  mon.setHours(0, 0, 0, 0)
  return mon
}

// Date range for a period
export function periodRange(period) {
  const now = new Date()
  const to = isoDate(now)
  if (period === 'week') {
    return { from: isoDate(weekStart()), to }
  }
  if (period === 'month') {
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0')
    return { from: `${y}-${m}-01`, to }
  }
  // year
  return { from: `${now.getFullYear()}-01-01`, to }
}

export function isoDate(d) {
  // Use local date components — toISOString() returns UTC which shifts the date
  // backwards in UTC+ timezones (e.g. local midnight Mon = Sunday in UTC)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
