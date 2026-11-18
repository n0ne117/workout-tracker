import { useCallback, useEffect, useState } from 'react'
import {
  Dumbbell, Plus, Minus, Trash2, ChevronUp, ChevronDown, Pencil, Save, Loader2, History, LayoutTemplate, Copy,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../hooks/useApi'
import { formatDate } from '../../utils/format'
import { useCatalog, formatKg } from './catalog'
import ExercisePicker from './ExercisePicker'

// ── Shapes ───────────────────────────────────────────────────────────────────
// The API stores flat sets; the editor works on rounds → exercises → sets.

function toRounds(sets) {
  const rounds = []
  for (const s of sets) {
    const round = (rounds[s.round - 1] ??= { exercises: [] })
    let ex = round.exercises.find(e => e.position === s.position)
    if (!ex) round.exercises.push(ex = { position: s.position, exercise_id: s.exercise_id, sets: [] })
    ex.sets.push({ weight_kg: s.weight_kg, reps: s.reps })
  }
  return rounds.filter(Boolean).map(r => ({
    exercises: r.exercises.sort((a, b) => a.position - b.position).map(({ exercise_id, sets }) => ({ exercise_id, sets })),
  }))
}

function toSets(rounds) {
  return rounds.flatMap((r, ri) => r.exercises.flatMap((e, ei) => e.sets.map((s, si) => ({
    round: ri + 1, position: ei + 1, set_no: si + 1, exercise_id: e.exercise_id,
    weight_kg: s.weight_kg, reps: s.reps,
  }))))
}

const clone = x => JSON.parse(JSON.stringify(x))

/** Accepts "37,5" as well as "37.5" — German keyboards type a comma. */
function parseNumber(text) {
  const v = parseFloat(String(text).replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

// ── Section ─────────────────────────────────────────────────────────────────

export default function StrengthSection({ workout }) {
  const { exercises, groups, byId, reload } = useCatalog()
  const [session, setSession] = useState(null)
  const [templates, setTemplates] = useState([])
  const [previous, setPrevious] = useState(null)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const [s, t, p] = await Promise.all([
      api.get(`/workouts/${workout.id}/strength`),
      api.get('/strength/templates'),
      api.get(`/workouts/${workout.id}/strength/previous`),
    ])
    setSession(s); setTemplates(t); setPrevious(p.workout ? p : null)
  }, [workout.id])

  useEffect(() => { load().catch(e => setError(e.message)) }, [load])

  /** Weights and reps from the last time each exercise was done, by round. */
  async function lastSets(ids) {
    if (!ids.length) return {}
    return api.get(`/strength/exercises/last?ids=${ids.join(',')}&before=${encodeURIComponent(workout.started_at)}`)
  }

  function setFrom(last, round) {
    const s = last?.find(x => x.round === round) ?? last?.[last.length - 1]
    return { weight_kg: s?.weight_kg ?? null, reps: s?.reps ?? null }
  }

  async function startFromTemplate(t) {
    setBusy(true)
    try {
      const last = await lastSets(t.exercise_ids)
      setDraft(Array.from({ length: t.rounds }, (_, r) => ({
        exercises: t.exercise_ids.map(id => ({ exercise_id: id, sets: [setFrom(last[id], r + 1)] })),
      })))
    } finally { setBusy(false) }
  }

  async function save() {
    setBusy(true); setError(null)
    try {
      const sets = toSets(draft).filter(s => s.weight_kg != null || s.reps != null)
      setSession(await api.put(`/workouts/${workout.id}/strength`, { sets }))
      setDraft(null)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function saveAsTemplate() {
    const rounds = draft ?? toRounds(session.sets)
    const ids = rounds[0]?.exercises.map(e => e.exercise_id) ?? []
    if (!ids.length) return
    const name = window.prompt('Template name', templates[0]?.name ?? workout.title)
    if (!name?.trim()) return
    try {
      await api.post('/strength/templates', { name: name.trim(), rounds: rounds.length, exercise_ids: ids })
      setTemplates(await api.get('/strength/templates'))
    } catch (e) { setError(e.message) }
  }

  async function deleteTemplate(t) {
    if (!window.confirm(`Delete the template “${t.name}”?`)) return
    await api.delete(`/strength/templates/${t.id}`)
    setTemplates(ts => ts.filter(x => x.id !== t.id))
  }

  if (!session) {
    return <div className="card p-5 flex items-center gap-2 text-sm text-gray-400"><Loader2 size={15} className="animate-spin" /> Loading sets…</div>
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Dumbbell size={17} className="text-brand-500" /> Strength
      </h2>
      {!draft && session.sets.length > 0 && (
        <div className="flex gap-1.5">
          <button onClick={saveAsTemplate} className="btn-ghost px-2.5 py-1.5 text-xs" title="Save these exercises as a template">
            <LayoutTemplate size={14} /> <span className="hidden sm:inline">Save as template</span>
          </button>
          <button onClick={() => setDraft(toRounds(session.sets))} className="btn-secondary px-2.5 py-1.5 text-xs">
            <Pencil size={14} /> Edit
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="card p-5 space-y-4">
      {header}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {draft ? (
        <Editor draft={draft} setDraft={setDraft} exercises={exercises} groups={groups} byId={byId}
                reloadCatalog={reload} lastSets={lastSets} setFrom={setFrom}
                busy={busy} onSave={save} onCancel={() => { setDraft(null); setError(null) }}
                onSaveTemplate={saveAsTemplate} />
      ) : session.sets.length === 0 ? (
        <StartChooser templates={templates} previous={previous} busy={busy}
                      onTemplate={startFromTemplate} onDeleteTemplate={deleteTemplate}
                      onPrevious={() => setDraft(toRounds(previous.sets))}
                      onEmpty={() => setDraft([{ exercises: [] }])} />
      ) : (
        <SessionView session={session} byId={byId} />
      )}
    </div>
  )
}

// ── Nothing logged yet ───────────────────────────────────────────────────────

function StartChooser({ templates, previous, busy, onTemplate, onDeleteTemplate, onPrevious, onEmpty }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">No sets logged for this workout yet. Start from:</p>
      <div className="flex flex-wrap gap-2">
        {templates.map(t => (
          <span key={t.id} className="inline-flex rounded-lg overflow-hidden">
            <button onClick={() => onTemplate(t)} disabled={busy} className="btn-primary rounded-r-none py-1.5 text-sm">
              <LayoutTemplate size={14} /> {t.name}
              <span className="text-xs opacity-75">· {t.exercise_ids.length} exercises × {t.rounds}</span>
            </button>
            <button onClick={() => onDeleteTemplate(t)} className="btn-primary rounded-l-none px-2 py-1.5 border-l border-white/20"
                    aria-label={`Delete template ${t.name}`} title="Delete template">
              <Trash2 size={13} />
            </button>
          </span>
        ))}
        {previous && (
          <button onClick={onPrevious} className="btn-secondary py-1.5 text-sm">
            <History size={14} /> Like last time
            <span className="text-xs text-gray-500 dark:text-gray-400">· {previous.workout.title}, {formatDate(previous.workout.started_at)}</span>
          </button>
        )}
        <button onClick={onEmpty} className="btn-secondary py-1.5 text-sm"><Plus size={14} /> Empty</button>
      </div>
    </div>
  )
}

// ── Logged session ───────────────────────────────────────────────────────────

function SessionView({ session, byId }) {
  const { summary } = session
  const rounds = toRounds(session.sets)
  const tiles = [
    { label: 'Volume', value: formatKg(summary.volume), hint: 'weight × reps, added up' },
    { label: 'Sets', value: summary.sets },
    { label: 'Reps', value: summary.reps },
    { label: 'Rounds', value: summary.rounds },
  ]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{t.value}</p>
            {t.hint && <p className="text-[11px] text-gray-400 dark:text-gray-500">{t.hint}</p>}
          </div>
        ))}
      </div>

      <MuscleSplit split={summary.split} />

      <div className="space-y-3">
        {rounds.map((r, ri) => (
          <div key={ri}>
            {rounds.length > 1 && <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Round {ri + 1}</p>}
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {r.exercises.map((e, ei) => (
                <li key={ei} className="py-1.5 flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-sm text-gray-900 dark:text-gray-100">{byId[e.exercise_id]?.name ?? '…'}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                    {e.sets.map(s => `${s.weight_kg != null ? formatKg(s.weight_kg) : 'BW'} × ${s.reps ?? '–'}`).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {rounds.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Per exercise</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400">
              <th className="font-medium py-1">Exercise</th><th className="font-medium text-right">Sets</th>
              <th className="font-medium text-right">Reps</th><th className="font-medium text-right">Best</th>
              <th className="font-medium text-right">Volume</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 tabular-nums">
              {summary.exercises.map(e => (
                <tr key={e.exercise_id} className="text-gray-800 dark:text-gray-200">
                  <td className="py-1.5">{e.name}</td><td className="text-right">{e.sets}</td>
                  <td className="text-right">{e.reps}</td><td className="text-right">{formatKg(e.best_weight)}</td>
                  <td className="text-right">{formatKg(e.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Share of sets per muscle group, biggest first; always sums to 100 %. */
function MuscleSplit({ split }) {
  if (!split.length) return null
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">Muscle split</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Share of sets — main muscles count fully, assisting ones half</p>
      </div>
      <ul className="space-y-1.5">
        {split.map(s => (
          <li key={s.group} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="text-gray-700 dark:text-gray-300">{s.group}</span>
            <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${s.percent}%` }} />
            </div>
            <span className="text-right tabular-nums text-gray-900 dark:text-white">{s.percent} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────────

function Stepper({ value, onChange, step, unit, label }) {
  const [text, setText] = useState(value ?? '')
  // Follow outside changes (the − / + buttons) without rewriting what is
  // being typed: "37," parses to 37 already and must keep its comma.
  useEffect(() => { setText(t => (parseNumber(t) === (value ?? null) ? t : value ?? '')) }, [value])
  const bump = d => onChange(Math.max(0, Math.round(((value ?? 0) + d) * 10) / 10))
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => bump(-step)} className="btn-secondary p-1.5" aria-label={`Less ${label}`}><Minus size={13} /></button>
      <div className="relative">
        <input value={text} inputMode="decimal" aria-label={label}
               onChange={e => { setText(e.target.value); onChange(parseNumber(e.target.value)) }}
               className="input w-20 px-2 py-1.5 text-center tabular-nums pr-7" />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none">{unit}</span>
      </div>
      <button type="button" onClick={() => bump(step)} className="btn-secondary p-1.5" aria-label={`More ${label}`}><Plus size={13} /></button>
    </div>
  )
}

function Editor({ draft, setDraft, exercises, groups, byId, reloadCatalog, lastSets, setFrom, busy, onSave, onCancel, onSaveTemplate }) {
  const [picking, setPicking] = useState(null)   // round index the picker is open for

  const update = fn => setDraft(d => { const next = clone(d); fn(next); return next })

  async function addExercise(ri, ex) {
    setPicking(null)
    const last = (await lastSets([ex.id]))[ex.id]
    update(d => d[ri].exercises.push({ exercise_id: ex.id, sets: [setFrom(last, ri + 1)] }))
  }

  function move(ri, ei, dir) {
    update(d => {
      const list = d[ri].exercises, j = ei + dir
      if (j < 0 || j >= list.length) return
      ;[list[ei], list[j]] = [list[j], list[ei]]
    })
  }

  return (
    <div className="space-y-4">
      {draft.map((round, ri) => (
        <div key={ri} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Round {ri + 1}</p>
            {draft.length > 1 && (
              <button onClick={() => update(d => d.splice(ri, 1))} className="btn-ghost px-2 py-1 text-xs text-red-500">
                <Trash2 size={13} /> Remove round
              </button>
            )}
          </div>

          {round.exercises.map((e, ei) => (
            <div key={ei} className="space-y-2 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{byId[e.exercise_id]?.name ?? '…'}</p>
                  <p className="text-[11px] text-gray-400">{byId[e.exercise_id]?.primary.join(', ')}</p>
                </div>
                <button onClick={() => move(ri, ei, -1)} disabled={ei === 0} className="btn-ghost p-1.5" aria-label="Move up"><ChevronUp size={14} /></button>
                <button onClick={() => move(ri, ei, 1)} disabled={ei === round.exercises.length - 1} className="btn-ghost p-1.5" aria-label="Move down"><ChevronDown size={14} /></button>
                <button onClick={() => update(d => d[ri].exercises.splice(ei, 1))} className="btn-ghost p-1.5 text-red-500" aria-label="Remove exercise"><Trash2 size={14} /></button>
              </div>
              {e.sets.map((s, si) => (
                <div key={si} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-xs text-gray-400 w-10">Set {si + 1}</span>
                  <Stepper label="weight" unit="kg" step={1} value={s.weight_kg}
                           onChange={v => update(d => { d[ri].exercises[ei].sets[si].weight_kg = v })} />
                  <Stepper label="reps" unit="×" step={1} value={s.reps}
                           onChange={v => update(d => { d[ri].exercises[ei].sets[si].reps = v == null ? null : Math.round(v) })} />
                  {e.sets.length > 1 && (
                    <button onClick={() => update(d => d[ri].exercises[ei].sets.splice(si, 1))} className="btn-ghost p-1.5 text-gray-400" aria-label="Remove set">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => update(d => { const sets = d[ri].exercises[ei].sets; sets.push({ ...sets[sets.length - 1] }) })}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline">+ Set</button>
            </div>
          ))}

          {picking === ri ? (
            <ExercisePicker exercises={exercises} groups={groups} onCreated={reloadCatalog}
                            onPick={ex => addExercise(ri, ex)} onClose={() => setPicking(null)} />
          ) : (
            <button onClick={() => setPicking(ri)} className="btn-secondary py-1.5 text-xs"><Plus size={13} /> Exercise</button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => update(d => d.push(clone(d[d.length - 1] ?? { exercises: [] })))} className="btn-secondary py-1.5 text-sm">
          <Copy size={14} /> Round {draft.length + 1} (copy of {draft.length})
        </button>
        <span className="flex-1" />
        <button onClick={onSaveTemplate} className="btn-ghost py-1.5 text-sm" title="Save these exercises as a template">
          <LayoutTemplate size={14} /> <span className="hidden sm:inline">Save as template</span>
        </button>
        <button onClick={onCancel} className="btn-ghost py-1.5 text-sm">Cancel</button>
        <button onClick={onSave} disabled={busy} className={clsx('btn-primary py-1.5 text-sm')}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>
    </div>
  )
}
