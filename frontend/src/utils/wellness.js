/**
 * Wellness metrics: how to name and format each Intervals.icu field, and the
 * arithmetic behind the Health page (rolling averages, correlations).
 *
 * Fields not listed here still appear — the page shows every numeric field
 * the server sends — just with a label derived from the field name.
 */

const SCALE_1_4 = 'Intervals.icu scale: 1 is best, 4 is worst'

export const GROUPS = ['Recovery', 'Sleep', 'Body', 'Activity', 'How you feel', 'Nutrition', 'Training', 'Other']

export const METRICS = {
  restingHR:       { label: 'Resting HR',          unit: 'bpm',       group: 'Recovery' },
  hrv:             { label: 'HRV (rMSSD)',         unit: 'ms',        group: 'Recovery' },
  hrvSDNN:         { label: 'HRV (SDNN)',          unit: 'ms',        group: 'Recovery' },
  readiness:       { label: 'Readiness',                              group: 'Recovery' },
  baevskySI:       { label: 'Baevsky stress index',                   group: 'Recovery', digits: 1 },

  sleepSecs:       { label: 'Sleep',               unit: 'h',         group: 'Sleep', scale: 1 / 3600, digits: 1 },
  sleepScore:      { label: 'Sleep score',                            group: 'Sleep' },
  sleepQuality:    { label: 'Sleep quality',                          group: 'Sleep', note: SCALE_1_4 },
  avgSleepingHR:   { label: 'Sleeping HR',         unit: 'bpm',       group: 'Sleep' },
  respiration:     { label: 'Respiration',         unit: 'br/min',    group: 'Sleep', digits: 1 },
  spO2:            { label: 'SpO₂',                unit: '%',         group: 'Sleep', digits: 1 },

  weight:          { label: 'Weight',              unit: 'kg',        group: 'Body', digits: 1 },
  bodyFat:         { label: 'Body fat',            unit: '%',         group: 'Body', digits: 1 },
  abdomen:         { label: 'Abdomen',             unit: 'cm',        group: 'Body', digits: 1 },
  vo2max:          { label: 'VO₂max',              unit: 'ml/kg/min', group: 'Body', digits: 1 },
  systolic:        { label: 'Systolic BP',         unit: 'mmHg',      group: 'Body' },
  diastolic:       { label: 'Diastolic BP',        unit: 'mmHg',      group: 'Body' },
  bloodGlucose:    { label: 'Blood glucose',       unit: 'mmol/L',    group: 'Body', digits: 1 },
  lactate:         { label: 'Lactate',             unit: 'mmol/L',    group: 'Body', digits: 1 },

  steps:           { label: 'Steps',                                  group: 'Activity' },
  floorsClimbed:   { label: 'Floors climbed',                         group: 'Activity' },

  soreness:        { label: 'Soreness',                               group: 'How you feel', note: SCALE_1_4 },
  fatigue:         { label: 'Fatigue',                                group: 'How you feel', note: SCALE_1_4 },
  stress:          { label: 'Stress',                                 group: 'How you feel', note: SCALE_1_4 },
  mood:            { label: 'Mood',                                   group: 'How you feel', note: SCALE_1_4 },
  motivation:      { label: 'Motivation',                             group: 'How you feel', note: SCALE_1_4 },
  injury:          { label: 'Injury',                                 group: 'How you feel', note: SCALE_1_4 },
  hydration:       { label: 'Hydration',                              group: 'How you feel', note: SCALE_1_4 },

  kcalConsumed:    { label: 'Calories eaten',      unit: 'kcal',      group: 'Nutrition' },
  carbohydrates:   { label: 'Carbohydrates',       unit: 'g',         group: 'Nutrition' },
  protein:         { label: 'Protein',             unit: 'g',         group: 'Nutrition' },
  fatTotal:        { label: 'Fat',                 unit: 'g',         group: 'Nutrition' },
  hydrationVolume: { label: 'Water',                                  group: 'Nutrition', digits: 1 },

  trainingLoad:    { label: 'Training load',                          group: 'Training', note: 'Sum of the day’s workouts' },
  trainingMinutes: { label: 'Training time',       unit: 'min',       group: 'Training', note: 'Sum of the day’s workouts' },
  ctl:             { label: 'Fitness (CTL)',                          group: 'Training', digits: 1 },
  atl:             { label: 'Fatigue (ATL)',                          group: 'Training', digits: 1 },
  rampRate:        { label: 'Ramp rate',                              group: 'Training', digits: 1 },
  ctlLoad:         { label: 'Load (fitness input)',                   group: 'Training', digits: 1 },
  atlLoad:         { label: 'Load (fatigue input)',                   group: 'Training', digits: 1 },
}

/** Headline tiles, in this order, for whichever of them have data. */
export const HEADLINE = ['restingHR', 'hrv', 'sleepSecs', 'sleepScore', 'weight', 'steps', 'vo2max', 'readiness']

export function meta(field) {
  return METRICS[field] ?? {
    label: field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()),
    group: 'Other',
  }
}

/** A stored value in display units (sleep seconds → hours). */
export function displayValue(field, raw) {
  if (raw == null) return null
  const m = meta(field)
  return m.scale ? raw * m.scale : raw
}

export function formatValue(field, raw, { unit = true } = {}) {
  const v = displayValue(field, raw)
  if (v == null || Number.isNaN(v)) return '—'
  const m = meta(field)
  const digits = m.digits ?? (Math.abs(v) >= 100 || Number.isInteger(v) ? 0 : 1)
  const text = v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
  return unit && m.unit ? `${text} ${m.unit}` : text
}

/** 'YYYY-MM-DD' as a local date — new Date(string) would read it as UTC. */
export function parseDay(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso, n) {
  const d = parseDay(iso)
  d.setDate(d.getDate() + n)
  const pad = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Trailing mean over the last `window` calendar days that have a value,
 * one entry per day that has a value. Gaps do not pull the average down.
 */
export function rollingMean(days, field, window = 7) {
  const out = []
  const recent = []
  for (const d of days) {
    const v = d[field]
    if (v == null) continue
    const t = parseDay(d.date).getTime()
    recent.push({ t, v })
    while (recent.length && t - recent[0].t >= window * 86_400_000) recent.shift()
    out.push({ date: d.date, value: v, mean: recent.reduce((s, p) => s + p.v, 0) / recent.length, count: recent.length })
  }
  return out
}

export function pearson(pairs) {
  const n = pairs.length
  if (n < 3) return null
  let sx = 0, sy = 0
  for (const [x, y] of pairs) { sx += x; sy += y }
  const mx = sx / n, my = sy / n
  let cov = 0, vx = 0, vy = 0
  for (const [x, y] of pairs) {
    cov += (x - mx) * (y - my)
    vx += (x - mx) ** 2
    vy += (y - my) ** 2
  }
  if (vx === 0 || vy === 0) return null
  return cov / Math.sqrt(vx * vy)
}

/** Pairs that only restate each other — derived from the same input. */
function redundant(a, b) {
  const both = (x, y) => (a === x && b === y) || (a === y && b === x)
  if (meta(a).group === 'Training' && meta(b).group === 'Training') return true
  return both('hrv', 'hrvSDNN') || both('systolic', 'diastolic') || both('sleepSecs', 'sleepScore')
    || both('restingHR', 'avgSleepingHR')
}

// Model outputs that change slowly by construction. Against anything else
// that drifts over months they "correlate" without meaning anything.
const SLOW = new Set(['ctl', 'atl', 'rampRate', 'ctlLoad', 'atlLoad'])

const BASELINE_DAYS = 28
const MIN_BASELINE = 7
const MIN_DAYS = 20
const MIN_R = 0.2

/**
 * Each day's value against that metric's own trailing 4-week average.
 *
 * Correlating raw values mostly finds two things drifting over months — a
 * weight trend and a fitness build "moving together". Deviations ask the
 * useful question instead: on days X is above its usual, is Y too?
 */
function deviations(days, field) {
  const out = new Map()
  for (const p of rollingMean(days, field, BASELINE_DAYS)) {
    if (p.count >= MIN_BASELINE) out.set(p.date, { dev: p.value - p.mean, raw: p.value })
  }
  return out
}

/**
 * The strongest relationships in the data, strongest first.
 *
 * Same-day pairs between every two metrics, plus "the day after": training
 * load and time on one day against every other metric the next. Days where
 * either side is missing are skipped, so `n` is the number of days the pair
 * actually shares. Each pair holds [xDev, yDev, date, xRaw, yRaw].
 */
export function relationships(days, fields) {
  const usable = fields.filter(f => !SLOW.has(f))
  const dev = Object.fromEntries(usable.map(f => [f, deviations(days, f)]))
  const results = []

  const consider = (x, y, lag) => {
    const pairs = []
    for (const d of days) {
      const xv = dev[x].get(lag ? addDays(d.date, -lag) : d.date)
      const yv = dev[y].get(d.date)
      if (xv && yv) pairs.push([xv.dev, yv.dev, d.date, xv.raw, yv.raw])
    }
    if (pairs.length < MIN_DAYS) return
    const r = pearson(pairs)
    if (r == null || Math.abs(r) < MIN_R) return
    results.push({ x, y, lag, r, n: pairs.length, pairs })
  }

  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      if (!redundant(usable[i], usable[j])) consider(usable[i], usable[j], 0)
    }
  }
  for (const x of ['trainingLoad', 'trainingMinutes'].filter(f => usable.includes(f))) {
    for (const y of usable) {
      if (meta(y).group !== 'Training') consider(x, y, 1)
    }
  }
  return results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
}

export function strength(r) {
  const a = Math.abs(r)
  return a >= 0.5 ? 'strong' : a >= 0.3 ? 'moderate' : 'weak'
}

export function describe({ x, y, lag, r }) {
  const dir = r > 0 ? 'higher' : 'lower'
  const X = meta(x).label, Y = meta(y).label
  return lag
    ? `The day after more ${X} than usual, ${Y} tends to be ${dir} than usual`
    : `When ${X} is above usual, ${Y} tends to be ${dir} than usual`
}
