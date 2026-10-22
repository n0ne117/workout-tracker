import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeartPulse, Loader2, RefreshCw, Table2, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../hooks/useApi'
import { WELLNESS_CHANGED } from '../hooks/useIntervalsSync'
import { formatDate, isoDate } from '../utils/format'
import {
  GROUPS, HEADLINE, meta, formatValue, displayValue, rollingMean, relationships,
  strength, describe, parseDay, addDays,
} from '../utils/wellness'
import TrendChart from '../components/health/TrendChart'
import ScatterChart from '../components/health/ScatterChart'
import InfoTip from '../components/runlab/InfoTip'

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
          Daily wellness from Intervals.icu — trends, and what moves together
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
    <Relationships days={days} fields={fields} />
    <Trends series={series} fields={fields} domain={domain} />
    <DayTable days={days} fields={fields} />
  </>
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
        // Baseline: the 28 days before the latest reading.
        const cutoff = addDays(latest.date, -28)
        const before = s.filter(p => p.date < latest.date && p.date >= cutoff)
        const base = before.length ? before.reduce((a, p) => a + p.value, 0) / before.length : null
        const delta = base != null ? displayValue(f, latest.value) - displayValue(f, base) : null
        return (
          <div key={f} className="card p-4">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{meta(f).label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white leading-none">
              {formatValue(f, latest.value, { unit: false })}
              {meta(f).unit && <span className="ml-1 text-sm font-medium text-gray-400">{meta(f).unit}</span>}
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {delta != null && Math.abs(delta) > 1e-9
                ? <>{delta > 0 ? '▲' : '▼'} {formatValue(f, Math.abs(delta) / (meta(f).scale ?? 1), { unit: false })} vs 28-day avg</>
                : base != null ? 'Same as 28-day avg' : 'No baseline yet'}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(parseDay(latest.date))}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Relationships ─────────────────────────────────────────────────────────────

const RELATIONSHIP_INFO =
  "Each day is compared with that measurement's own 4-week average, so slow drifts over months don't " +
  "count. The number is the correlation of those day-to-day swings over the days both were recorded, from −1 to +1. " +
  "Blue bars: both rise together. Orange: one rises as the other falls. It shows what moves together, " +
  "not what causes what — a third thing (a hard week, a holiday, the season) can drive both."

function Relationships({ days, fields }) {
  const rels = useMemo(() => relationships(days, fields).slice(0, 12), [days, fields])
  const [selected, setSelected] = useState(0)
  useEffect(() => setSelected(0), [rels])

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">What moves together</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Days compared with your usual (4-week average). Pick one to see every day behind it.
          </p>
        </div>
        <InfoTip text={RELATIONSHIP_INFO} />
      </div>

      {rels.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No clear relationships here — try a longer range. A pair needs at least 20 shared days.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <ol className="lg:col-span-2 space-y-1">
            {rels.map((rel, i) => (
              <li key={`${rel.x}-${rel.y}-${rel.lag}`}>
                <button
                  onClick={() => setSelected(i)}
                  className={clsx(
                    'w-full text-left rounded-lg px-3 py-2 transition-colors',
                    i === selected ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  )}
                >
                  <p className="text-sm text-gray-800 dark:text-gray-200">{describe(rel)}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <CorrelationBar r={rel.r} />
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                      r {rel.r > 0 ? '+' : '−'}{Math.abs(rel.r).toFixed(2)} · {strength(rel.r)} · {rel.n} days
                    </span>
                  </div>
                </button>
                {/* Phones: the chart opens under the chosen row, not twelve rows away. */}
                {i === selected && <div className="lg:hidden pt-2"><ScatterChart rel={rel} /></div>}
              </li>
            ))}
          </ol>
          <div className="hidden lg:block lg:col-span-3 min-w-0 lg:sticky lg:top-20 self-start">
            {rels[selected] && <ScatterChart rel={rels[selected]} />}
          </div>
        </div>
      )}
    </div>
  )
}

/** −1 … +1 around a gray zero line: blue to the right, orange to the left. */
function CorrelationBar({ r }) {
  const half = Math.min(1, Math.abs(r)) * 50
  return (
    <div className="relative h-1.5 w-24 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-800">
      <div className="absolute left-1/2 top-[-2px] bottom-[-2px] w-px bg-gray-300 dark:bg-gray-600" />
      <div
        className={clsx('absolute top-0 bottom-0 rounded-full',
          r > 0 ? 'bg-blue-600 dark:bg-blue-500' : 'bg-orange-600')}
        style={r > 0 ? { left: '50%', width: `${half}%` } : { right: '50%', width: `${half}%` }}
      />
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
      {groups.map(({ g, fs }) => (
        <section key={g} className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{g}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {fs.map(f => {
              const s = series[f]
              const latest = s[s.length - 1]
              return (
                <div key={f} className="card p-4 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex items-center gap-1.5">
                      {meta(f).label}
                      {meta(f).note && <InfoTip text={meta(f).note} />}
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-nowrap">{formatValue(f, latest.mean)}</p>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
                    dots: each day · line: 7-day average · {s.length} days
                  </p>
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
