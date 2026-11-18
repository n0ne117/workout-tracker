import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Loader2, TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../hooks/useApi'
import { formatDate } from '../../utils/format'
import TrendChart from '../health/TrendChart'
import { formatKg } from './catalog'

const MEASURES = [
  { key: 'best_weight', label: 'Best weight', format: (v, { unit = true } = {}) => unit ? formatKg(v) : (v ?? '—').toLocaleString(undefined, { maximumFractionDigits: 1 }) },
  { key: 'volume',      label: 'Volume',      format: (v, { unit = true } = {}) => unit ? formatKg(v) : Math.round(v ?? 0).toLocaleString() },
  { key: 'reps',        label: 'Reps',        format: v => (v ?? '—').toLocaleString() },
]

const bestSetText = s => (s.best_set ? `${formatKg(s.best_set.weight_kg)} × ${s.best_set.reps}` : 'bodyweight')

/**
 * One exercise across every session that had it: a chart of the chosen
 * measure, first / best / latest, and the sessions themselves.
 */
export default function ExerciseProgress({ exerciseId, currentWorkoutId, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [measure, setMeasure] = useState('best_weight')

  useEffect(() => {
    setData(null)
    api.get(`/strength/exercises/${exerciseId}/history`).then(setData).catch(e => setError(e.message))
  }, [exerciseId])

  const m = MEASURES.find(x => x.key === measure)
  // Sessions without the measure (bodyweight sets have no weight) are skipped.
  const series = useMemo(() => (data?.sessions ?? [])
    .filter(s => s[measure] != null)
    .map(s => ({ date: s.date.slice(0, 10), value: s[measure], mean: s[measure] })), [data, measure])

  if (error) return <Frame onClose={onClose}><p className="text-sm text-red-600 dark:text-red-400">{error}</p></Frame>
  if (!data) return <Frame onClose={onClose}><Loader2 size={16} className="animate-spin text-gray-400" /></Frame>

  const sessions = data.sessions
  const weighted = sessions.filter(s => s.best_weight != null)
  const first = weighted[0], last = weighted[weighted.length - 1]
  const best = weighted.reduce((b, s) => (!b || s.best_weight > b.best_weight ? s : b), null)
  const change = first && last && first !== last ? last.best_weight - first.best_weight : null

  return (
    <Frame title={data.exercise.name} onClose={onClose}>
      {sessions.length < 2 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {sessions.length ? 'Only this session so far' : 'Not logged yet'} — progress appears from the second session on.
        </p>
      ) : <>
        {first && (
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              { label: 'First', s: first },
              { label: 'Best', s: best },
              { label: 'Latest', s: last },
            ].map(({ label, s }) => (
              <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="font-bold text-gray-900 dark:text-white">{bestSetText(s)}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatDate(s.date)}</p>
              </div>
            ))}
          </div>
        )}
        {change != null && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {change === 0
              ? `Same top weight as your first session, ${sessions.length} sessions in.`
              : `${change > 0 ? '+' : '−'}${formatKg(Math.abs(change))} on your heaviest set since the first session (${Math.round((change / first.best_weight) * 100)} %).`}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
            {MEASURES.map(x => (
              <button key={x.key} onClick={() => setMeasure(x.key)}
                      className={clsx('px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                        measure === x.key ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                                          : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200')}>
                {x.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-gray-400">per session</span>
        </div>
        {series.length >= 2
          ? <TrendChart field={measure} series={series} domain={[series[0].date, series[series.length - 1].date]}
                        height={180} dotRadius={3.5} dotOpacity={0.9} format={m.format}
                        labels={{ value: m.label.toLowerCase(), mean: null }} />
          : <p className="text-sm text-gray-500 dark:text-gray-400">Not enough sessions with a weight to chart.</p>}

        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-400">
            <th className="font-medium py-1">Session</th><th className="font-medium text-right">Sets</th>
            <th className="font-medium text-right">Best set</th><th className="font-medium text-right">Volume</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 tabular-nums">
            {[...sessions].reverse().map(s => (
              <tr key={s.workout_id} className={clsx('text-gray-800 dark:text-gray-200', s.workout_id === currentWorkoutId && 'font-semibold')}>
                <td className="py-1.5">
                  {s.workout_id === currentWorkoutId
                    ? <>{formatDate(s.date)} <span className="text-xs text-gray-400 font-normal">· this one</span></>
                    : <Link to={`/workouts/${s.workout_id}`} className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline underline-offset-2">{formatDate(s.date)}</Link>}
                </td>
                <td className="text-right">{s.sets}</td>
                <td className="text-right whitespace-nowrap">{bestSetText(s)}</td>
                <td className="text-right">{formatKg(s.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>}
    </Frame>
  )
}

function Frame({ title, onClose, children }) {
  return (
    <div className="rounded-xl border border-brand-200 dark:border-brand-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
          <TrendingUp size={15} className="text-brand-500" /> {title ?? 'Progress'}
        </p>
        <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close progress"><X size={15} /></button>
      </div>
      {children}
    </div>
  )
}
