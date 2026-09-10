import {
  Footprints, Mountain, MountainSnow, Bike, Waves, Dumbbell, Activity,
  Zap, Wind, Timer, Trophy, Snowflake, Ship, Anchor, Gamepad2, RotateCw,
  Heart, Sparkles, Sailboat, PersonStanding, Volleyball, Swords, TreePine,
} from 'lucide-react'

/**
 * Single source of truth for everything sport-shaped.
 *
 * Previously this lived in three places that had drifted apart — emoji in
 * utils/format.js (31 sports), lucide icons in mobile/utils.js (20 sports),
 * and pixel art in components/SportIcon.jsx (unused). Keys here mirror
 * SPORT_CATEGORIES in backend/app/models.py exactly.
 *
 * `metric` decides how speed is expressed:
 *   'pace'  → min/km        (running, walking, …)
 *   'swim'  → min/100m      (the convention swimmers actually use)
 *   'speed' → km/h          (cycling, skating, …)
 *   null    → no distance-based metric is meaningful (strength, yoga, …)
 *
 * Tailwind class strings are written out in full because the JIT compiler
 * cannot see dynamically interpolated class names.
 */
const SPORTS = {
  running:             { label: 'Running',           icon: Footprints,      metric: 'pace',  solid: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',    dot: 'text-orange-500' },
  trail_running:       { label: 'Trail Running',     icon: Mountain,        metric: 'pace',  solid: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'text-emerald-600' },
  walking:             { label: 'Walking',           icon: Footprints,      metric: 'pace',  solid: 'bg-green-500',   badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',        dot: 'text-green-500' },
  hiking:              { label: 'Hiking',            icon: TreePine,          metric: 'pace',  solid: 'bg-lime-600',    badge: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',            dot: 'text-lime-600' },
  cycling:             { label: 'Cycling',           icon: Bike,            metric: 'speed', solid: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',            dot: 'text-blue-500' },
  mountain_biking:     { label: 'Mountain Biking',   icon: Bike,            metric: 'speed', solid: 'bg-amber-600',   badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',        dot: 'text-amber-600' },
  indoor_cycling:      { label: 'Indoor Cycling',    icon: Bike,            metric: 'speed', solid: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',    dot: 'text-violet-500' },
  motorbiking:         { label: 'Motorbiking',       icon: Bike,            metric: 'speed', solid: 'bg-zinc-600',    badge: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300',            dot: 'text-zinc-600' },
  swimming:            { label: 'Swimming',          icon: Waves,           metric: 'swim',  solid: 'bg-cyan-500',    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',            dot: 'text-cyan-500' },
  open_water_swimming: { label: 'Open Water Swim',   icon: Waves,           metric: 'swim',  solid: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',            dot: 'text-teal-500' },
  rowing:              { label: 'Rowing',            icon: Sailboat,        metric: 'speed', solid: 'bg-sky-500',     badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',                dot: 'text-sky-500' },
  indoor_rowing:       { label: 'Indoor Rowing',     icon: Timer,           metric: 'speed', solid: 'bg-sky-600',     badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',                dot: 'text-sky-600' },
  sup:                 { label: 'SUP',               icon: Ship,            metric: 'speed', solid: 'bg-sky-400',     badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',                dot: 'text-sky-400' },
  diving:              { label: 'Diving',            icon: Anchor,          metric: null,    solid: 'bg-blue-700',    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',            dot: 'text-blue-700' },
  snorkeling:          { label: 'Snorkeling',        icon: Anchor,          metric: null,    solid: 'bg-cyan-600',    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',            dot: 'text-cyan-600' },
  skiing:              { label: 'Skiing',            icon: Snowflake,       metric: 'speed', solid: 'bg-sky-300',     badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',                dot: 'text-sky-300' },
  snowboarding:        { label: 'Snowboarding',      icon: MountainSnow,    metric: 'speed', solid: 'bg-slate-500',   badge: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',        dot: 'text-slate-500' },
  ice_skating:         { label: 'Ice Skating',       icon: Snowflake,       metric: 'speed', solid: 'bg-cyan-400',    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',            dot: 'text-cyan-400' },
  inline_skating:      { label: 'Inline Skating',    icon: RotateCw,        metric: 'speed', solid: 'bg-indigo-400',  badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',    dot: 'text-indigo-400' },
  climbing:            { label: 'Climbing',          icon: MountainSnow,    metric: null,    solid: 'bg-stone-600',   badge: 'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300',        dot: 'text-stone-600' },
  strength_training:   { label: 'Strength Training', icon: Dumbbell,        metric: null,    solid: 'bg-red-500',     badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',                dot: 'text-red-500' },
  calisthenics:        { label: 'Calisthenics',      icon: PersonStanding,  metric: null,    solid: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',            dot: 'text-rose-500' },
  cross_training:      { label: 'Cross Training',    icon: Zap,             metric: null,    solid: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',    dot: 'text-indigo-500' },
  power_circle:        { label: 'Power Circle',      icon: Heart,           metric: null,    solid: 'bg-orange-600',  badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',    dot: 'text-orange-600' },
  jump_rope:           { label: 'Jump Rope',         icon: Sparkles,        metric: null,    solid: 'bg-yellow-500',  badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',    dot: 'text-yellow-500' },
  yoga:                { label: 'Yoga',              icon: Wind,            metric: null,    solid: 'bg-pink-500',    badge: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',            dot: 'text-pink-500' },
  basketball:          { label: 'Basketball',        icon: Volleyball,      metric: null,    solid: 'bg-orange-600',  badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',    dot: 'text-orange-600' },
  soccer:              { label: 'Soccer',            icon: Volleyball,      metric: null,    solid: 'bg-green-600',   badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',        dot: 'text-green-600' },
  tennis:              { label: 'Tennis',            icon: Swords,          metric: null,    solid: 'bg-yellow-600',  badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',    dot: 'text-yellow-600' },
  playing:             { label: 'Playing',           icon: Gamepad2,        metric: null,    solid: 'bg-fuchsia-500', badge: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300', dot: 'text-fuchsia-500' },
  triathlon:           { label: 'Triathlon',         icon: Trophy,          metric: 'pace',  solid: 'bg-purple-500',  badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',    dot: 'text-purple-500' },
  other:               { label: 'Other',             icon: Activity,        metric: null,    solid: 'bg-gray-500',    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',               dot: 'text-gray-500' },
}

const FALLBACK = SPORTS.other

export function sportMeta(sport) {
  return SPORTS[sport] || FALLBACK
}

export function sportLabel(sport) {
  return SPORTS[sport]?.label || sport?.replace(/_/g, ' ') || 'Other'
}

export function sportIconComponent(sport) {
  return sportMeta(sport).icon
}

export function sportSolidClass(sport) {
  return sportMeta(sport).solid
}

export function sportBadgeClass(sport) {
  return sportMeta(sport).badge
}

export function sportDotClass(sport) {
  return sportMeta(sport).dot
}

export function sportMetric(sport) {
  return sportMeta(sport).metric
}

export function isPaceSport(sport) {
  const m = sportMetric(sport)
  return m === 'pace' || m === 'swim'
}

/** Every known sport key, in the order declared above. */
export const ALL_SPORTS = Object.keys(SPORTS)
