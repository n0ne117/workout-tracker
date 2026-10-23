import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeartPulse, Loader2, RefreshCw, Table2, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../hooks/useApi'
import { WELLNESS_CHANGED } from '../hooks/useIntervalsSync'
import { formatDate, isoDate } from '../utils/format'
import {
  GROUPS, HEADLINE, meta, formatValue, rollingMean, compareToUsual, parseDay, addDays,
} from '../utils/wellness'
import TrendChart from '../components/health/TrendChart'
import { Verdict, Explainer } from '../components/health/Verdict'

const RANGES = [
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '6m',  label: '6 months', days: 182 },
  { key: '1y',  label: '1 year', days: 365 },
  { key: 'all', label: 'All', days: null },
]

const RANGE_KEY = 'health-range'

function loadRange() {
  try { return RANGES.find(r => r.key === localStorage.getItem(RANGE_KEY))?.key ?? '90d' } catch { return '90d' }
}

export default function Health() {
  const [range, setRange] = useState(loadRange)
  const [data, setData] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState(null)

  const days = RANGES.find(r => r.key === range).days

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [d, s] = await Promise.all([
        api.get(`/wellness${days ? `?days=${days}` : ''}`),
        api.get('/wellness/status'),
      ])
      setData(d)
      setStatus(s)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  // The header's Sync refreshes wellness too.
  useEffect(() => {
    window.addEventListener(WELLNESS_CHANGED, load)
    return () => window.removeEventListener(WELLNESS_CHANGED, load)
  }, [load])

  function pickRange(key) {
    setRange(key)
    try { localStorage.setItem(RANGE_KEY, key) } catch { /* private mode */ }
  }

  async function sync(full) {
    setSyncing(true)
    setSyncNote(null)
    try {
      const r = await api.post('/wellness/sync', { full, days_back: 30 })
      setSyncNote(`Fetched ${r.days} day${r.days === 1 ? '' : 's'} from Intervals.icu`)
      await load()
    } catch (e) {
      setSyncNote(`Sync failed: ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
        <HeartPulse size={19} className="text-brand-600 dark:text-brand-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Health</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Daily wellness from Intervals.icu — what each number means, and how you compare with your usual
        </p>
      </div>
      {status?.days > 0 && (
        <button onClick={() => sync(false)} disabled={syncing} className="btn-secondary text-xs px-3 py-1.5"
                title="Fetch the last 30 days of wellness from Intervals.icu">
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          Refresh
        </button>
      )}
    </div>
  )

  if (loading && !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card p-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card p-6 text-sm text-red-600 dark:text-red-400">Could not load health data: {error}</div>
      </div>
    )
  }

  if (!status?.days) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card p-8 text-center space-y-3 max-w-lg mx-auto">
          <HeartPulse size={28} className="mx-auto text-gray-300 dark:text-gray-600" />
          {status?.connected ? <>
            <p className="font-medium text-gray-900 dark:text-white">No health data yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Intervals.icu keeps daily wellness — resting HR, HRV, sleep, weight, steps and more,
              much of it from Apple Health. Import it once; every sync keeps it current after that.
            </p>
            <button onClick={() => sync(true)} disabled={syncing} className="btn-primary mx-auto">
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {syncing ? 'Importing history…' : 'Import health history'}
            </button>
            {syncNote && <p className="text-xs text-gray-500 dark:text-gray-400">{syncNote}</p>}
          </> : <>
            <p className="font-medium text-gray-900 dark:text-white">Connect Intervals.icu first</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Health data comes from Intervals.icu. Add your API key in <Link to="/settings" className="underline">Settings</Link>.
            </p>
          </>}
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('space-y-6 transition-opacity', loading && 'opacity-60')}>
      {header}

      {/* One filter row for everything below it. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => pickRange(r.key)}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                range === r.key
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {status.days} days stored · {formatDate(parseDay(status.first))} – {formatDate(parseDay(status.last))}
        </span>
        {syncNote && <span className="text-xs text-gray-500 dark:text-gray-400">· {syncNote}</span>}
      </div>

      {data.days.length === 0
        ? <div className="card p-6 text-sm text-gray-500 dark:text-gray-400">Nothing recorded in this range.</div>
        : <HealthBody data={data} days={days} />}
    </div>
  )
}

function HealthBody({ data, days: rangeDays }) {
  const { days, fields } = data
  const domain = useMemo(() => {
    const last = isoDate(new Date())
    return [rangeDays ? addDays(last, -(rangeDays - 1)) : days[0].date, last]
  }, [days, rangeDays])

  const series = useMemo(
    () => Object.fromEntries(fields.map(f => [f, rollingMean(days, f)])),
    [days, fields],
  )

  return <>
    <Headline series={series} fields={fields} />
    <WeekSummary series={series} fields={fields} />
    <Trends series={series} fields={fields} domain={domain} />
    <DayTable days={days} fields={fields} />
  </>
}

function signedDelta(field, delta) {
  return `${delta >= 0 ? '+' : '−'}${formatValue(field, Math.abs(delta), { unit: false })}`
}

// ── Latest values ─────────────────────────────────────────────────────────────

function Headline({ series, fields }) {
  const shown = HEADLINE.filter(f => fields.includes(f) && series[f].length)
  if (!shown.length) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {shown.map(f => {
        const s = series[f]
        const latest = s[s.length - 1]
        // The latest day against the 28 before it.
        const cmp = compareToUsual(s, f, { recent: 1 })
        return (
          <Link key={f} to={`/health/${f}`}
                className="card p-4 flex flex-col group hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{meta(f).label}</p>
              <ChevronRight size={15} className="text-gray-300 group-hover:text-brand-500 dark:text-gray-600 transition-colors" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white leading-none">
              {formatValue(f, latest.value, { unit: false })}
              {meta(f).unit && <span className="ml-1 text-sm font-medium text-gray-400">{meta(f).unit}</span>}
            </p>
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
              {formatDate(parseDay(latest.date))}
              {cmp && <> · usual {formatValue(f, cmp.usual)}</>}
            </p>
            <div className="mt-auto pt-2.5">
              {cmp ? <Verdict verdict={cmp.verdict} /> : <span className="text-xs text-gray-400">No baseline yet</span>}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ── This week vs your usual ───────────────────────────────────────────────────

const ORDER = { worse: 0, better: 1, higher: 2, lower: 2, usual: 3 }

function WeekSummary({ series, fields }) {
  const rows = fields
    .filter(f => meta(f).group !== 'Training')
    .map(f => ({ f, cmp: compareToUsual(series[f], f) }))
    .filter(r => r.cmp)
    .sort((a, b) => ORDER[a.cmp.verdict] - ORDER[b.cmp.verdict])
  if (!rows.length) return null
  const changed = rows.filter(r => r.cmp.verdict !== 'usual')
  const steady = rows.filter(r => r.cmp.verdict === 'usual')

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white">This week vs your usual</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Average of the last 7 days against the 4 weeks before. Only changes bigger than your normal
          day-to-day ups and downs are called out.
        </p>
      </div>

      {changed.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">Everything is within your usual range.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {changed.map(({ f, cmp }) => (
            <li key={f} className="py-3 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                  {meta(f).label} <Explainer field={f} />
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{meta(f).desc}</p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <p className="text-sm text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
                  {formatValue(f, cmp.current)}
                  <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                    ({signedDelta(f, cmp.delta)} vs {formatValue(f, cmp.usual, { unit: false })})
                  </span>
                </p>
                <Verdict verdict={cmp.verdict} short />
              </div>
            </li>
          ))}
        </ul>
      )}

      {steady.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-600 dark:text-gray-300">About usual: </span>
          {steady.map(r => meta(r.f).label).join(', ')}
        </p>
      )}
    </div>
  )
}

// ── Trends ────────────────────────────────────────────────────────────────────

function Trends({ series, fields, domain }) {
  const groups = GROUPS
    .map(g => ({ g, fs: fields.filter(f => meta(f).group === g && series[f].length >= 2) }))
    .filter(x => x.fs.length)

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Trends — each dot is a day, the line is the 7-day average. The badge compares the last 7 days with
        the 4 weeks before.
      </p>
      {groups.map(({ g, fs }) => (
        <section key={g} className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{g}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {fs.map(f => {
              const s = series[f]
              const latest = s[s.length - 1]
              const cmp = compareToUsual(s, f)
              return (
                <div key={f} className="card p-4 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5 min-w-0">
                      <Link to={`/health/${f}`} className="truncate hover:text-brand-600 dark:hover:text-brand-400 hover:underline underline-offset-2">
                        {meta(f).label}
                      </Link>
                      <Explainer field={f} />
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm text-gray-900 dark:text-white whitespace-nowrap">{formatValue(f, latest.mean)}</p>
                      {cmp && meta(f).group !== 'Training' && <Verdict verdict={cmp.verdict} short />}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2 line-clamp-2">{meta(f).desc}</p>
                  <TrendChart field={f} series={s} domain={domain} />
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Table view ────────────────────────────────────────────────────────────────

function DayTable({ days, fields }) {
  const [open, setOpen] = useState(false)
  const ordered = GROUPS.flatMap(g => fields.filter(f => meta(f).group === g))
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
              className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <Table2 size={15} /> Every day as a table
        <ChevronDown size={15} className={clsx('ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="overflow-x-auto max-h-[60vh] border-t border-gray-100 dark:border-gray-800">
          <table className="text-xs whitespace-nowrap">
            <thead className="sticky top-0 bg-white dark:bg-gray-900">
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2 font-medium sticky left-0 bg-white dark:bg-gray-900">Date</th>
                {ordered.map(f => (
                  <th key={f} className="px-3 py-2 font-medium text-right">
                    {meta(f).label}{meta(f).unit ? ` (${meta(f).unit})` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[...days].reverse().map(d => (
                <tr key={d.date} className="text-gray-800 dark:text-gray-200">
                  <td className="px-3 py-1.5 sticky left-0 bg-white dark:bg-gray-900">{formatDate(parseDay(d.date))}</td>
                  {ordered.map(f => (
                    <td key={f} className="px-3 py-1.5 text-right tabular-nums">
                      {d[f] == null ? '' : formatValue(f, d[f], { unit: false })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
