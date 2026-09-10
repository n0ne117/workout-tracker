export function formatDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatDistance(meters) {
  if (!meters) return '—'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

export function formatPace(meters, seconds) {
  if (!meters || !seconds) return '—'
  const secsPerKm = (seconds / meters) * 1000
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

export function formatSpeed(ms) {
  if (!ms) return '—'
  return `${(ms * 3.6).toFixed(1)} km/h`
}

export function formatElevation(meters) {
  if (meters == null) return '—'
  return `${Math.round(meters)} m`
}

export function formatHR(bpm) {
  if (!bpm) return '—'
  return `${bpm} bpm`
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatDatetime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const SPORT_LABELS = {
  basketball: 'Basketball',
  calisthenics: 'Calisthenics',
  climbing: 'Climbing',
  cross_training: 'Cross Training',
  cycling: 'Cycling',
  diving: 'Diving',
  hiking: 'Hiking',
  ice_skating: 'Ice Skating',
  indoor_cycling: 'Indoor Cycling',
  indoor_rowing: 'Indoor Rowing',
  inline_skating: 'Inline Skating',
  jump_rope: 'Jump Rope',
  motorbiking: 'Motorbiking',
  mountain_biking: 'Mountain Biking',
  open_water_swimming: 'Open Water Swim',
  playing: 'Playing',
  power_circle: 'Power Circle',
  rowing: 'Rowing',
  running: 'Running',
  skiing: 'Skiing',
  snorkeling: 'Snorkeling',
  snowboarding: 'Snowboarding',
  soccer: 'Soccer',
  strength_training: 'Strength Training',
  sup: 'SUP',
  swimming: 'Swimming',
  tennis: 'Tennis',
  trail_running: 'Trail Running',
  triathlon: 'Triathlon',
  walking: 'Walking',
  yoga: 'Yoga',
  other: 'Other',
}

export function formatSport(sport) {
  return SPORT_LABELS[sport] || sport?.replace(/_/g, ' ') || 'Other'
}

const SPORT_ICONS = {
  basketball: '🏀',
  calisthenics: '🤸',
  climbing: '🧗',
  cross_training: '⚡',
  cycling: '🚴',
  diving: '🤿',
  hiking: '🥾',
  ice_skating: '⛸️',
  indoor_cycling: '🚲',
  indoor_rowing: '🛶',
  inline_skating: '🛼',
  jump_rope: '🪢',
  motorbiking: '🏍️',
  mountain_biking: '🚵',
  open_water_swimming: '🌊',
  playing: '🎮',
  power_circle: '🔄',
  rowing: '🚣',
  running: '🏃',
  skiing: '⛷️',
  snorkeling: '🤿',
  snowboarding: '🏂',
  soccer: '⚽',
  strength_training: '🏋️',
  sup: '🏄',
  swimming: '🏊',
  tennis: '🎾',
  trail_running: '🏔️',
  triathlon: '🏅',
  walking: '🚶',
  yoga: '🧘',
  other: '💪',
}

export function sportIcon(sport) {
  return SPORT_ICONS[sport] || '💪'
}


const SPORT_COLORS = {
  basketball: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  calisthenics: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  climbing: 'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300',
  cross_training: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  cycling: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  diving: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  hiking: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
  ice_skating: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  indoor_cycling: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  indoor_rowing: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  inline_skating: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  jump_rope: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  motorbiking: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300',
  mountain_biking: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  open_water_swimming: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  playing: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  power_circle: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  rowing: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  running: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  skiing: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  snorkeling: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  snowboarding: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
  soccer: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  strength_training: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  sup: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  swimming: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  tennis: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  trail_running: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  triathlon: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  walking: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  yoga: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

export function sportColorClass(sport) {
  return SPORT_COLORS[sport] || SPORT_COLORS.other
}
