import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../hooks/useApi'
import { WELLNESS_CHANGED } from '../hooks/useIntervalsSync'
import { formatDate, isoDate } from '../utils/format'
import {
  meta, formatValue, rollingMean, compareToUsual, parseDay, addDays,
  usualBand, records, monthlyMeans, weekdayMeans, insights,
} from '../utils/wellness'
import TrendChart from '../components/health/TrendChart'
import { Verdict, ToneIcon, TONE_TEXT } from '../components/health/Verdict'

const RANGES = [
  { key: '90d', label: '90 days', days: 90 },
  { key: '6m',  label: '6 months', days: 182 },
  { key: '1y',  label: '1 year', days: 365 },
  { key: '2y',  label: '2 years', days: 730 },
  { key: 'all', label: 'All', days: null },
]
const RANGE_KEY = 'health-metric-range'
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function loadRange() {
  try { return RANGES.find(r => r.key === localStorage.getItem(RANGE_KEY))?.key ?? '1y' } catch { return '1y' }
}

/** One wellness metric in depth: its history, records and what stands out. */
export default function HealthMetric() {
  const { field } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [range, setRange] = useState(loadRange)

  useEffect(() => {
    const load = () => api.get('/wellness').then(setData).catch(e => setError(e.message))
    load()
    window.addEventListener(WELLNESS_CHANGED, load)
    return () => window.removeEventListener(WELLNESS_CHANGED, load)
  }, [])

  function pickRange(key) {
    setRange(key)
    try { localStorage.setItem(RANGE_KEY, key) } catch { /* private mode */ }
  }

  const m = meta(field)
  const back = (
    <Link to="/health" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
      <ArrowLeft size={15} /> Health
    </Link>
  )

  if (error) return <div className="space-y-4">{back}<div className="card p-6 text-sm text-red-600 dark:text-red-400">Could not load health data: {error}</div></div>
  if (!data) return <div className="space-y-4">{back}<div className="card p-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div></div>
  if (!data.fields.includes(field)) {
    return <div className="space-y-4">{back}<div className="card p-6 text-sm text-gray-500 dark:text-gray-400">No {m.label} data recorded yet.</div></div>
  }

  return (
    <div className="space-y-6">
      {back}
      <MetricBody field={field} days={data.days} range={range} onRange={pickRange} />
    </div>
  )
}

function MetricBody({ field, days, range, onRange }) {
  const m = meta(field)
  const series = useMemo(() => rollingMean(days, field), [days, field])
  const band = useMemo(() => usualBand(series), [series])
  const found = useMemo(() => insights(series, days, field), [series, days, field])

  const latest = series[series.length - 1]
  const today = isoDate(new Date())
  const rangeDays = RANGES.find(r => r.key === range).days
  const from = rangeDays ? addDays(today, -(rangeDays - 1)) : series[0].date
  const shown = series.filter(p => p.date >= from)
  const shownBand = band.filter(b => b.date >= from)

  const avgOf = (start) => {
    const vs = series.filter(p => p.date >= start).map(p => p.value)
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
  }
  const cmp = compareToUsual(series, field, { recent: 1 })
  const usual = compareToUsual(series, field)
  const recs = records(series, field)

  const stats = [
    { label: 'Latest', value: latest.value, sub: formatDate(parseDay(latest.date)) },
    { label: '7-day average', value: latest.mean, average: true },
    { label: 'Usual', value: usual?.usual ?? cmp?.usual, sub: '4 weeks before this one', average: true },
    { label: '1-year average', value: avgOf(addDays(latest.date, -364)), average: true },
    ...recs.map(r => ({ label: r.label, value: r.value, sub: formatDate(parseDay(r.date)), tone: r.tone })),
  ]

  return <>
    {/* Title and what the number means */}
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{m.label}</h1>
        {cmp && <Verdict verdict={cmp.verdict} />}
      </div>
      {m.desc && <p className="text-gray-700 dark:text-gray-300">{m.desc}</p>}
      {m.good && <p className="text-sm text-gray-500 dark:text-gray-400 max-w-3xl">{m.good}</p>}
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map(s => (
        <div key={s.label} className="card p-4">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{s.label}</p>
          <p className={clsx('mt-1.5 text-xl font-bold leading-tight', TONE_TEXT[s.tone ?? 'neutral'])}>
            {formatValue(field, s.value, { average: s.average })}
          </p>
          {s.sub && <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{s.sub}</p>}
        </div>
      ))}
    </div>

    {found.length > 0 && (
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">What stands out</h2>
        <ul className="space-y-2.5">
          {found.map((f, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-gray-700 dark:text-gray-300">
              <ToneIcon tone={f.tone} />
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {/* History */}
    <div className="card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">History</h2>
        <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => onRange(r.key)}
                    className={clsx('px-3 py-1 rounded-md text-xs font-medium transition-colors',
                      range === r.key
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200')}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-500/40" /> each day</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-brand-600 dark:bg-brand-500" /> 7-day average</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2.5 rounded-sm bg-gray-200 dark:bg-gray-700" /> your usual range (4-week average ± typical swing)</span>
      </p>
      {shown.length >= 2
        ? <TrendChart field={field} series={shown} band={shownBand} domain={[from, today]} height={280}
                      dotRadius={2.25} dotOpacity={0.35} />
        : <p className="text-sm text-gray-500 dark:text-gray-400">Not enough data in this range.</p>}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <MonthlyCard field={field} series={series} />
      <WeekdayCard field={field} series={series} />
    </div>
  </>
}

function MonthlyCard({ field, series }) {
  const last = series[series.length - 1].date
  const months = monthlyMeans(series.filter(p => p.date > addDays(last, -730)))
  if (months.length < 3) return null
  const dayLabel = iso => `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
  return (
    <div className="card p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white">Monthly averages</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Last two years — the slow trend without the daily noise.</p>
      </div>
      <TrendChart field={field} series={months} domain={[months[0].date, months[months.length - 1].date]}
                  height={200} dotRadius={3.5} dotOpacity={0.9}
                  labels={{ day: dayLabel, value: 'avg', mean: null }} />
    </div>
  )
}

/** Average per weekday as bars around your overall average. */
function WeekdayCard({ field, series }) {
  const last = series[series.length - 1].date
  const year = series.filter(p => p.date > addDays(last, -365))
  const week = weekdayMeans(year)
  if (week.some(w => w.n < 4)) return null
  const overall = year.reduce((a, p) => a + p.value, 0) / year.length
  const devs = week.map(w => w.mean - overall)
  const maxDev = Math.max(...devs.map(Math.abs)) || 1
  const better = meta(field).better

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white">By weekday</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Last 12 months, against your average of {formatValue(field, overall)}.
          {better && ' Green: better than your average; red: worse.'}
        </p>
      </div>
      <ul className="space-y-1.5">
        {week.map((w, i) => {
          const dev = devs[i]
          const good = better ? (dev > 0) === (better === 'higher') : null
          const width = `${(Math.abs(dev) / maxDev) * 50}%`
          return (
            <li key={w.day} className="grid grid-cols-[2.5rem_1fr_5.5rem] items-center gap-3 text-xs">
              <span className="text-gray-500 dark:text-gray-400">{w.day.slice(0, 3)}</span>
              <div className="relative h-4">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600" />
                <div
                  className={clsx('absolute top-0.5 bottom-0.5',
                    good === null ? 'bg-brand-500/70' : good ? 'bg-green-500' : 'bg-red-500',
                    dev >= 0 ? 'rounded-r' : 'rounded-l')}
                  style={dev >= 0 ? { left: '50%', width } : { right: '50%', width }}
                />
              </div>
              <span className="text-right tabular-nums text-gray-800 dark:text-gray-200">{formatValue(field, w.mean, { average: true })}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
