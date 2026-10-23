/**
 * Wellness metrics: how to name, explain and format each Intervals.icu
 * field, and the arithmetic behind the Health page (rolling averages,
 * comparisons with your usual).
 *
 * Fields not listed here still appear — the page shows every numeric field
 * the server sends — just with a label derived from the field name.
 */

// Intervals.icu's own 1–4 wellness scales, each worded its own way; 1 is
// always the good end.
const scale = words => `Your own rating, 1 – 4: ${words}.`

export const GROUPS = ['Recovery', 'Sleep', 'Body', 'Activity', 'How you feel', 'Nutrition', 'Training', 'Other']

/**
 * label/unit/group: how a field is shown.
 * desc:   what the number is, in one line.
 * good:   what to look for — shown on demand.
 * better: 'higher' | 'lower' when one direction is good for nearly everyone;
 *         left out when it depends on your goal (weight) or isn't a health
 *         signal at all (training volume), so the page never calls it
 *         "better" or "worse".
 */
export const METRICS = {
  restingHR: {
    label: 'Resting HR', unit: 'bpm', group: 'Recovery', better: 'lower',
    desc: 'Heart rate at full rest, usually measured overnight or on waking.',
    good: 'Lower than your usual tends to mean you are recovered. A rise of a few beats over several days often comes with fatigue, illness, stress, heat or alcohol.',
  },
  hrv: {
    label: 'HRV (rMSSD)', unit: 'ms', group: 'Recovery', better: 'higher',
    desc: 'Heart rate variability: how much the gap between heartbeats varies.',
    good: 'Higher than your usual suggests your body is recovered and relaxed; a drop points to fatigue, stress or illness. Values differ hugely between people — only compare with your own.',
  },
  hrvSDNN: {
    label: 'HRV (SDNN)', unit: 'ms', group: 'Recovery', better: 'higher',
    desc: 'Heart rate variability, measured as the spread of beat-to-beat intervals.',
    good: 'Same story as rMSSD: higher than your usual is a sign of good recovery. Compare only with your own values.',
  },
  readiness: {
    label: 'Readiness', group: 'Recovery', better: 'higher',
    desc: 'Your device’s overall readiness score, combining sleep, HRV and recent load.',
    good: 'Higher means the device thinks you are ready for harder training.',
  },
  baevskySI: {
    label: 'Baevsky stress index', group: 'Recovery', digits: 1, better: 'lower',
    desc: 'How strongly the body’s stress system is active, read from heart rhythm.',
    good: 'Lower is more relaxed. It rises with hard training, poor sleep, illness and mental stress.',
  },

  sleepSecs: {
    label: 'Sleep', unit: 'h', group: 'Sleep', scale: 1 / 3600, digits: 1, better: 'higher',
    desc: 'Total time asleep.',
    good: 'Most adults need 7–9 hours; in hard training blocks more helps recovery. A run of short nights shows up in HRV and resting HR a day or two later.',
  },
  sleepScore: {
    label: 'Sleep score', group: 'Sleep', better: 'higher',
    desc: 'Your device’s 0–100 rating of the night.',
    good: 'Higher is better. Above about 80 is usually rated good.',
  },
  sleepQuality: {
    label: 'Sleep quality', group: 'Sleep', better: 'lower',
    desc: scale('1 great, 2 good, 3 average, 4 poor'),
    good: 'Lower numbers are better nights.',
  },
  avgSleepingHR: {
    label: 'Sleeping HR', unit: 'bpm', group: 'Sleep', better: 'lower',
    desc: 'Average heart rate while asleep.',
    good: 'Lower than usual means a restful night. It runs high after hard or late training, big late meals, alcohol, heat or when you are getting ill.',
  },
  respiration: {
    label: 'Respiration', unit: 'br/min', group: 'Sleep', digits: 1,
    desc: 'Breaths per minute while asleep.',
    good: 'Very stable for each person, so the change matters more than the number. A clear rise above your usual can come before an illness.',
  },
  spO2: {
    label: 'SpO₂', unit: '%', group: 'Sleep', digits: 1, better: 'higher',
    desc: 'How saturated your blood is with oxygen.',
    good: 'Normally 95–100 %. Lower readings are expected at altitude; repeated low values at home are worth mentioning to a doctor.',
  },

  weight: {
    label: 'Weight', unit: 'kg', group: 'Body', digits: 1,
    desc: 'Body weight.',
    good: 'Day-to-day swings of a kilo are mostly water and food. Look at the 7-day line, not single days.',
  },
  bodyFat: {
    label: 'Body fat', unit: '%', group: 'Body', digits: 1,
    desc: 'Share of body weight that is fat.',
    good: 'Home scales measure this loosely and it moves with hydration — trust the trend over weeks.',
  },
  abdomen: {
    label: 'Abdomen', unit: 'cm', group: 'Body', digits: 1,
    desc: 'Waist circumference.',
    good: 'A simple, reliable trend for body composition.',
  },
  vo2max: {
    label: 'VO₂max', unit: 'ml/kg/min', group: 'Body', digits: 1, better: 'higher',
    desc: 'Estimated maximum oxygen uptake — the size of your aerobic engine.',
    good: 'Higher is fitter. Watch estimates react to heat, terrain and fatigue, so the trend over weeks counts more than one reading.',
  },
  systolic: {
    label: 'Systolic BP', unit: 'mmHg', group: 'Body', better: 'lower',
    desc: 'Upper blood pressure value, while the heart beats.',
    good: 'Below 120 is considered optimal, 120–139 elevated, 140 or more high.',
  },
  diastolic: {
    label: 'Diastolic BP', unit: 'mmHg', group: 'Body', better: 'lower',
    desc: 'Lower blood pressure value, between beats.',
    good: 'Below 80 is considered optimal, 80–89 elevated, 90 or more high.',
  },
  bloodGlucose: {
    label: 'Blood glucose', unit: 'mmol/L', group: 'Body', digits: 1,
    desc: 'Blood sugar level.',
    good: 'Fasting values of roughly 4–5.5 mmol/L are typical; it rises after meals and during hard efforts.',
  },
  lactate: {
    label: 'Lactate', unit: 'mmol/L', group: 'Body', digits: 1,
    desc: 'Blood lactate, from a finger-prick test.',
    good: 'Depends entirely on when and how hard you were going when it was measured.',
  },

  steps: {
    label: 'Steps', group: 'Activity', better: 'higher',
    desc: 'Steps taken during the day, training included.',
    good: 'More everyday movement helps recovery and health; around 7,000–10,000 a day is a common target.',
  },
  floorsClimbed: {
    label: 'Floors climbed', group: 'Activity', better: 'higher',
    desc: 'Flights of stairs (about 3 m of climb each).',
    good: 'More is more everyday activity.',
  },

  soreness:   { label: 'Soreness',   group: 'How you feel', better: 'lower', desc: scale('1 low, 2 average, 3 high, 4 extreme'),   good: 'Lower is better. Several days of high soreness means recovery is not keeping up.' },
  fatigue:    { label: 'Fatigue',    group: 'How you feel', better: 'lower', desc: scale('1 low, 2 average, 3 high, 4 extreme'),   good: 'Lower is better. Feeling tired for days on end is worth a lighter week.' },
  stress:     { label: 'Stress',     group: 'How you feel', better: 'lower', desc: scale('1 low, 2 average, 3 high, 4 extreme'),   good: 'Lower is better. Life stress uses up the same recovery as training does.' },
  mood:       { label: 'Mood',       group: 'How you feel', better: 'lower', desc: scale('1 great, 2 good, 3 OK, 4 grumpy'),       good: 'Lower is better. A drop in mood is one of the earliest signs of overreaching.' },
  motivation: { label: 'Motivation', group: 'How you feel', better: 'lower', desc: scale('1 extreme, 2 high, 3 average, 4 low'),   good: 'Lower numbers mean more motivated.' },
  injury:     { label: 'Injury',     group: 'How you feel', better: 'lower', desc: scale('1 none, 2 niggle, 3 poor, 4 injured'),   good: 'Lower is better. Track niggles early, before they become injuries.' },
  hydration:  { label: 'Hydration',  group: 'How you feel', better: 'lower', desc: scale('1 good, 2 OK, 3 poor, 4 bad'),            good: 'Lower is better hydrated.' },

  kcalConsumed:    { label: 'Calories eaten', unit: 'kcal', group: 'Nutrition', desc: 'Energy eaten during the day.',  good: 'Should roughly cover what training and daily life burn; under-eating for long stretches stalls recovery.' },
  carbohydrates:   { label: 'Carbohydrates',  unit: 'g',    group: 'Nutrition', desc: 'Carbohydrates eaten.',          good: 'The main fuel for hard and long training.' },
  protein:         { label: 'Protein',        unit: 'g',    group: 'Nutrition', desc: 'Protein eaten.',                good: 'Endurance athletes are usually advised about 1.2–1.6 g per kg of body weight.' },
  fatTotal:        { label: 'Fat',            unit: 'g',    group: 'Nutrition', desc: 'Fat eaten.',                    good: '' },
  hydrationVolume: { label: 'Water',                        group: 'Nutrition', digits: 1, desc: 'Fluid drunk during the day.', good: '' },

  trainingLoad:    { label: 'Training load', group: 'Training', desc: 'Training load of the day’s workouts added up (Intervals.icu).', good: 'Neither good nor bad on its own — it is the input the other numbers react to.' },
  trainingMinutes: { label: 'Training time', unit: 'min', group: 'Training', desc: 'Time spent training that day.', good: '' },
  ctl:      { label: 'Fitness (CTL)',        group: 'Training', digits: 1, desc: 'Fitness: your training load averaged over about six weeks.', good: 'Rises slowly as you train consistently.' },
  atl:      { label: 'Fatigue (ATL)',        group: 'Training', digits: 1, desc: 'Fatigue: your training load averaged over about a week.',  good: 'Spikes after hard weeks and falls quickly with rest.' },
  rampRate: { label: 'Ramp rate',            group: 'Training', digits: 1, desc: 'How fast fitness is rising, per week.', good: 'Up to about 5–8 per week is sustainable for most; much faster raises injury and illness risk.' },
  ctlLoad:  { label: 'Load (fitness input)', group: 'Training', digits: 1, desc: 'The day’s load as Intervals.icu feeds it into fitness.', good: '' },
  atlLoad:  { label: 'Load (fatigue input)', group: 'Training', digits: 1, desc: 'The day’s load as Intervals.icu feeds it into fatigue.', good: '' },
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

/**
 * `average: true` keeps one decimal even on a whole number, so a column of
 * averages doesn't mix "51" with "51.2".
 */
export function formatValue(field, raw, { unit = true, average = false } = {}) {
  const v = displayValue(field, raw)
  if (v == null || Number.isNaN(v)) return '—'
  const m = meta(field)
  const digits = m.digits ?? (Math.abs(v) >= 100 || (!average && Number.isInteger(v)) ? 0 : 1)
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
    out.push({ date: d.date, value: v, mean: recent.reduce((s, p) => s + p.v, 0) / recent.length })
  }
  return out
}

// ── Compared with your usual ────────────────────────────────────────────────

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * The latest `recent` days against the `baseline` days before them.
 *
 * verdict: 'better' | 'worse' when the metric has a good direction,
 *          'higher' | 'lower' when it doesn't, and 'usual' when the change is
 *          under half the metric's normal day-to-day spread — so ordinary
 *          noise never gets a colour.
 */
export function compareToUsual(series, field, { recent = 7, baseline = 28 } = {}) {
  if (!series.length) return null
  const last = series[series.length - 1].date
  const from = addDays(last, -(recent - 1))
  const baseFrom = addDays(from, -baseline)
  const now = series.filter(p => p.date >= from).map(p => p.value)
  const base = series.filter(p => p.date >= baseFrom && p.date < from).map(p => p.value)
  if (!now.length || base.length < 5) return null

  const current = mean(now), usual = mean(base)
  const sd = Math.sqrt(mean(base.map(v => (v - usual) ** 2)))
  const delta = current - usual
  const better = meta(field).better
  let verdict
  if (sd === 0 ? delta === 0 : Math.abs(delta) < sd * 0.5) verdict = 'usual'
  else if (!better) verdict = delta > 0 ? 'higher' : 'lower'
  else verdict = (delta > 0) === (better === 'higher') ? 'better' : 'worse'
  return { current, usual, delta, verdict, days: now.length }
}

// ── Detail view: history statistics and insights ────────────────────────────

const DAY_MS = 86_400_000
const sdOf = xs => { const m = mean(xs); return Math.sqrt(mean(xs.map(v => (v - m) ** 2))) }

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Values in [from, to] (inclusive ISO dates). */
function between(series, from, to) {
  return series.filter(p => p.date >= from && p.date <= to).map(p => p.value)
}

/**
 * Each day's "usual range": the 4 weeks before it, average ± one typical
 * swing (standard deviation). Roughly two days in three fall inside it.
 */
export function usualBand(series, window = 28) {
  const out = []
  const recent = []
  for (const p of series) {
    const t = parseDay(p.date).getTime()
    while (recent.length && t - recent[0].t > window * DAY_MS) recent.shift()
    if (recent.length >= 7) {
      const vs = recent.map(r => r.v)
      const m = mean(vs), sd = sdOf(vs)
      out.push({ date: p.date, lo: m - sd, hi: m + sd })
    }
    recent.push({ t, v: p.value })
  }
  return out
}

/** Best and worst day — or highest and lowest, for metrics without a good direction. */
export function records(series, field) {
  if (!series.length) return null
  let max = series[0], min = series[0]
  for (const p of series) {
    if (p.value > max.value) max = p
    if (p.value < min.value) min = p
  }
  const better = meta(field).better
  if (better === 'higher') return [{ label: 'Best', ...max, tone: 'better' }, { label: 'Worst', ...min, tone: 'worse' }]
  if (better === 'lower')  return [{ label: 'Best', ...min, tone: 'better' }, { label: 'Worst', ...max, tone: 'worse' }]
  return [{ label: 'Highest', ...max, tone: 'neutral' }, { label: 'Lowest', ...min, tone: 'neutral' }]
}

/** Calendar-month averages, placed mid-month so they read as a line. */
export function monthlyMeans(series) {
  const months = new Map()
  for (const p of series) {
    const key = p.date.slice(0, 7)
    if (!months.has(key)) months.set(key, [])
    months.get(key).push(p.value)
  }
  return [...months].map(([key, vs]) => ({ date: `${key}-15`, value: mean(vs), mean: mean(vs), n: vs.length }))
}

/** Average per weekday, Monday first. */
export function weekdayMeans(series) {
  const buckets = WEEKDAYS.map(() => [])
  for (const p of series) buckets[(parseDay(p.date).getDay() + 6) % 7].push(p.value)
  return buckets.map((vs, i) => ({ day: WEEKDAYS[i], mean: vs.length ? mean(vs) : null, n: vs.length }))
}

/** 'better' | 'worse' | 'neutral' for a change of `delta`. */
function tone(field, delta) {
  const better = meta(field).better
  if (!better || delta === 0) return 'neutral'
  return (delta > 0) === (better === 'higher') ? 'better' : 'worse'
}

function changeWords(field, delta) {
  const amount = formatValue(field, Math.abs(delta))
  return delta > 0 ? `${amount} higher` : `${amount} lower`
}

/**
 * The value on the day after rest days, ordinary training days and hard
 * days (the top quarter of training loads). Null unless each group has
 * enough days to mean something.
 */
export function trainingEffect(days, field) {
  const byDate = new Map(days.map(d => [d.date, d]))
  const loads = days.map(d => d.trainingLoad).filter(v => v > 0).sort((a, b) => a - b)
  if (loads.length < 12) return null
  const hardFrom = loads[Math.floor(loads.length * 0.75)]
  const groups = { rest: [], moderate: [], hard: [] }
  for (const d of days) {
    const v = d[field]
    const load = byDate.get(addDays(d.date, -1))?.trainingLoad
    if (v == null || load == null) continue
    groups[load === 0 ? 'rest' : load >= hardFrom ? 'hard' : 'moderate'].push(v)
  }
  if (groups.rest.length < 8 || groups.hard.length < 8) return null
  const summary = vs => (vs.length ? { mean: mean(vs), n: vs.length } : null)
  return { hardFrom, rest: summary(groups.rest), moderate: summary(groups.moderate), hard: summary(groups.hard) }
}

/**
 * Plain-language findings about one metric's history, each with a tone so
 * the page can mark it better / worse / neutral.
 */
export function insights(series, days, field) {
  if (series.length < 14) return []
  const out = []
  const label = meta(field).label
  const last = series[series.length - 1].date
  const spread = sdOf(series.map(p => p.value))
  const notable = delta => Math.abs(delta) >= spread * 0.3

  // 1. Now against three months ago, 30-day windows.
  const now30 = between(series, addDays(last, -29), last)
  const then30 = between(series, addDays(last, -119), addDays(last, -90))
  if (now30.length >= 10 && then30.length >= 10) {
    const delta = mean(now30) - mean(then30)
    out.push(notable(delta)
      ? { tone: tone(field, delta), text: `Your 30-day average is ${changeWords(field, delta)} than three months ago (${formatValue(field, mean(then30))} → ${formatValue(field, mean(now30))}).` }
      : { tone: 'neutral', text: `Your 30-day average is about where it was three months ago (${formatValue(field, mean(now30))}).` })
  }

  // 2. Against the same time last year.
  const lastYear = between(series, addDays(last, -394), addDays(last, -365))
  if (now30.length >= 10 && lastYear.length >= 10) {
    const delta = mean(now30) - mean(lastYear)
    out.push(notable(delta)
      ? { tone: tone(field, delta), text: `Compared with this time last year you are ${changeWords(field, delta)} (${formatValue(field, mean(lastYear))} then).` }
      : { tone: 'neutral', text: `About the same as this time last year (${formatValue(field, mean(lastYear))} then).` })
  }

  // 3. How settled the last 90 days were.
  const band = new Map(usualBand(series).map(b => [b.date, b]))
  const recent = series.filter(p => p.date > addDays(last, -90) && band.has(p.date))
  if (recent.length >= 20) {
    let inside = 0, above = 0, below = 0
    for (const p of recent) {
      const b = band.get(p.date)
      if (p.value > b.hi) above++
      else if (p.value < b.lo) below++
      else inside++
    }
    const better = meta(field).better
    const worse = better === 'higher' ? below : better === 'lower' ? above : null
    const pct = Math.round((inside / recent.length) * 100)
    out.push({
      tone: 'neutral',
      text: `Over the last 90 days, ${pct} % of days were within your usual range` +
        (worse != null ? `; ${worse} day${worse === 1 ? ' was' : 's were'} clearly worse.` : ` (${above} above, ${below} below).`),
    })
  }

  // 4. What training the day before does to it.
  if (meta(field).group !== 'Training') {
    const effect = trainingEffect(days, field)
    if (effect) {
      const delta = effect.hard.mean - effect.rest.mean
      out.push(notable(delta)
        ? { tone: tone(field, delta),
            text: `The day after hard training (load ${Math.round(effect.hardFrom)}+), ${label} averages ${formatValue(field, effect.hard.mean)} — ${changeWords(field, delta)} than after a rest day (${formatValue(field, effect.rest.mean)}).` }
        : { tone: 'neutral', text: `Hard training barely shows in the next day's ${label}: ${formatValue(field, effect.hard.mean)} after hard days, ${formatValue(field, effect.rest.mean)} after rest days.` })
    }
  }

  // 5. Weekday rhythm, over the last year.
  const week = weekdayMeans(series.filter(p => p.date > addDays(last, -365))).filter(w => w.n >= 4)
  if (week.length === 7) {
    const sorted = [...week].sort((a, b) => a.mean - b.mean)
    const lo = sorted[0], hi = sorted[6]
    if (notable(hi.mean - lo.mean)) {
      const better = meta(field).better
      const [best, worst] = better === 'lower' ? [lo, hi] : [hi, lo]
      out.push({
        tone: 'neutral',
        text: better
          ? `${best.day}s are usually your best (${formatValue(field, best.mean)}), ${worst.day}s your worst (${formatValue(field, worst.mean)}).`
          : `Highest on ${hi.day}s (${formatValue(field, hi.mean)}), lowest on ${lo.day}s (${formatValue(field, lo.mean)}).`,
      })
    }
  }
  return out
}
