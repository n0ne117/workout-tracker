import { useState, useEffect, useMemo } from 'react'
import { api } from '../hooks/useApi'
import {
  Loader2, Plus, Flag, CheckCircle2, CircleDot, Clock,
  ChevronDown, ChevronRight, AlertTriangle, Pencil, Trash2,
  X, Save, Calendar, Map, Package
} from 'lucide-react'
import { formatDate } from '../utils/format'
import clsx from 'clsx'

// ── helpers ────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000

function today() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}

function daysBetween(a, b) {
  return Math.round((new Date(a) - new Date(b)) / MS_PER_DAY)
}

function getStatus(c) {
  if (c.start_date && c.end_date) return 'completed'
  if (c.start_date) return 'active'
  return 'backlog'
}

function expiryUrgency(use_before) {
  if (!use_before) return null
  const days = daysBetween(new Date(use_before), today())
  if (days <= 90)  return 'critical'
  if (days <= 180) return 'warning'
  return 'ok'
}

function toInput(iso) {
  if (!iso) return ''
  return iso.split('T')[0]
}

// ── sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={clsx('text-xl font-bold tabular-nums mt-0.5', accent ?? 'text-gray-900 dark:text-white')}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle2 size={11} /> Done
    </span>
  )
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
      <CircleDot size={11} /> Active
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      <Clock size={11} /> Backlog
    </span>
  )
}

function ActiveCard({ c, onEdit, onDelete }) {
  const daysIn = daysBetween(today(), new Date(c.start_date))
  return (
    <div className="card p-5 border-l-4 border-brand-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status="active" />
            {c.year && (
              <span className="text-[11px] text-gray-400">{c.year}</span>
            )}
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{c.name}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><Map size={13} /> {c.distance_km} km</span>
            <span className="flex items-center gap-1"><Calendar size={13} /> Started {formatDate(c.start_date)}</span>
            <span className="flex items-center gap-1"><Clock size={13} /> {daysIn} day{daysIn !== 1 ? 's' : ''} in progress</span>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onEdit(c)} className="btn-ghost p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><Pencil size={14} /></button>
          <button onClick={() => onDelete(c)} className="btn-ghost p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}

function CompletedRow({ c, onEdit, onDelete }) {
  const days = c.start_date && c.end_date ? daysBetween(new Date(c.end_date), new Date(c.start_date)) : null
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg group transition-colors">
      <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">{c.name}</span>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 tabular-nums">
        <span className="w-16 text-right font-medium text-gray-700 dark:text-gray-300">{c.distance_km} km</span>
        <span className="w-40 text-center">
          {c.start_date && c.end_date
            ? `${formatDate(c.start_date)} → ${formatDate(c.end_date)}`
            : c.start_date ? formatDate(c.start_date) : '—'}
        </span>
        <span className="w-16 text-right">{days != null ? `${days}d` : '—'}</span>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onEdit(c)} className="btn-ghost p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><Pencil size={13} /></button>
        <button onClick={() => onDelete(c)} className="btn-ghost p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

function YearSection({ year, challenges, onEdit, onDelete }) {
  const [open, setOpen] = useState(true)
  const totalKm = challenges.reduce((s, c) => s + c.distance_km, 0)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-2 px-1 text-left group"
      >
        {open ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{year}</span>
        <span className="text-xs text-gray-400">{challenges.length} challenge{challenges.length !== 1 ? 's' : ''} · {totalKm.toLocaleString()} km</span>
      </button>
      {open && (
        <div className="ml-2 border-l border-gray-100 dark:border-gray-800 pl-2 space-y-0.5">
          {/* column headers */}
          <div className="hidden sm:flex items-center gap-3 px-4 py-1 text-[11px] text-gray-400 uppercase tracking-wide">
            <div className="flex-1" />
            <span className="w-16 text-right">Distance</span>
            <span className="w-40 text-center">Period</span>
            <span className="w-16 text-right">Days</span>
            <div className="w-10" />
          </div>
          {challenges.map(c => (
            <CompletedRow key={c.id} c={c} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function BacklogRow({ c, onEdit, onDelete }) {
  const urgency = expiryUrgency(c.use_before)
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg group transition-colors">
      <Clock size={14} className="text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">{c.name}</span>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 tabular-nums">
        <span className="w-16 text-right font-medium text-gray-700 dark:text-gray-300">{c.distance_km} km</span>
        <span className="w-36 text-right">
          {c.purchase_date ? `Bought ${formatDate(c.purchase_date)}` : '—'}
        </span>
        <span className={clsx('w-36 text-right flex items-center justify-end gap-1', {
          'text-red-500 font-medium': urgency === 'critical',
          'text-yellow-600 dark:text-yellow-400': urgency === 'warning',
        })}>
          {c.use_before ? (
            <>
              {(urgency === 'critical' || urgency === 'warning') && <AlertTriangle size={11} />}
              Exp. {formatDate(c.use_before)}
            </>
          ) : '—'}
        </span>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onEdit(c)} className="btn-ghost p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><Pencil size={13} /></button>
        <button onClick={() => onDelete(c)} className="btn-ghost p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

// ── modal ──────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', distance_km: '', purchase_date: '', use_before: '',
  start_date: '', end_date: '', year: '', notes: '',
}

function toForm(c) {
  return {
    name: c.name ?? '',
    distance_km: c.distance_km != null ? String(c.distance_km) : '',
    purchase_date: toInput(c.purchase_date),
    use_before: toInput(c.use_before),
    start_date: toInput(c.start_date),
    end_date: toInput(c.end_date),
    year: c.year != null ? String(c.year) : '',
    notes: c.notes ?? '',
  }
}

function buildPayload(form) {
  return {
    name: form.name.trim(),
    distance_km: form.distance_km ? parseInt(form.distance_km) : 0,
    purchase_date: form.purchase_date || null,
    use_before: form.use_before || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    year: form.year ? parseInt(form.year) : null,
    notes: form.notes.trim() || null,
  }
}

function ChallengeModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(initial ? toForm(initial) : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.distance_km) { setError('Name and distance are required.'); return }
    setSaving(true); setError(null)
    try {
      const payload = buildPayload(form)
      const result = isEdit
        ? await api.patch(`/challenges/${initial.id}`, payload)
        : await api.post('/challenges', payload)
      onSaved(result, isEdit)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 dark:text-white">{isEdit ? 'Edit Challenge' : 'Add Challenge'}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
          {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</div>}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Challenge name</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Inca Trail" required autoFocus />
            </div>
            <div>
              <label className="label">Distance (km)</label>
              <input className="input" type="number" min="1" value={form.distance_km} onChange={e => set('distance_km', e.target.value)} placeholder="42" required />
            </div>
          </div>

          <div>
            <label className="label">Purchase date</label>
            <input className="input" type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
          </div>

          <div>
            <label className="label">Use before <span className="text-gray-400 font-normal">(expiry for unstarted challenges)</span></label>
            <input className="input" type="date" value={form.use_before} onChange={e => set('use_before', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input className="input" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="label">End date</label>
              <input className="input" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} disabled={!form.start_date} />
            </div>
          </div>

          <div>
            <label className="label">Year <span className="text-gray-400 font-normal">(attributed year, e.g. 2025)</span></label>
            <input className="input" type="number" min="2000" max="2100" value={form.year} onChange={e => set('year', e.target.value)} placeholder="optional" />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes…" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isEdit ? 'Save changes' : 'Add challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── delete confirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({ challenge, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Delete challenge?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          <strong className="text-gray-700 dark:text-gray-300">{challenge.name}</strong> will be permanently deleted.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="btn btn-danger">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function Conqueror() {
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)       // null | {} | challenge-obj
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get('/challenges').then(setChallenges).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function handleSaved(result, isEdit) {
    setChallenges(prev => isEdit
      ? prev.map(c => c.id === result.id ? result : c)
      : [...prev, result]
    )
    setModal(null)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/challenges/${deleteTarget.id}`)
      setChallenges(prev => prev.filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const { active, completedByYear, backlog, stats } = useMemo(() => {
    const active = challenges.filter(c => getStatus(c) === 'active')
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))

    const completed = challenges.filter(c => getStatus(c) === 'completed')
    const completedByYear = {}
    for (const c of completed) {
      const yr = c.year ?? (c.end_date ? new Date(c.end_date).getFullYear() : '?')
      if (!completedByYear[yr]) completedByYear[yr] = []
      completedByYear[yr].push(c)
    }
    // Sort within each year by end_date desc
    for (const yr in completedByYear) {
      completedByYear[yr].sort((a, b) => new Date(b.end_date ?? 0) - new Date(a.end_date ?? 0))
    }

    const backlog = challenges.filter(c => getStatus(c) === 'backlog')
      .sort((a, b) => {
        // Sort: expiring soonest first, no-expiry last
        if (a.use_before && b.use_before) return new Date(a.use_before) - new Date(b.use_before)
        if (a.use_before) return -1
        if (b.use_before) return 1
        return 0
      })

    const stats = {
      total: challenges.length,
      completed: completed.length,
      active: active.length,
      backlog: backlog.length,
      completedKm: completed.reduce((s, c) => s + c.distance_km, 0),
    }

    return { active, completedByYear, backlog, stats }
  }, [challenges])

  const sortedYears = Object.keys(completedByYear).sort((a, b) => b - a)
  const expiringCount = backlog.filter(c => {
    const u = expiryUrgency(c.use_before)
    return u === 'critical' || u === 'warning'
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conqueror Challenges</h1>
          {expiringCount > 0 && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5 mt-0.5">
              <AlertTriangle size={13} />
              {expiringCount} challenge{expiringCount !== 1 ? 's' : ''} expiring within 6 months
            </p>
          )}
        </div>
        <button onClick={() => setModal({})} className="btn btn-primary gap-1.5">
          <Plus size={15} /> Add challenge
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-500" /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Total"     value={stats.total} />
            <StatCard label="Completed" value={stats.completed} accent="text-green-600 dark:text-green-400" />
            <StatCard label="Active"    value={stats.active}    accent="text-brand-600 dark:text-brand-400" />
            <StatCard label="Backlog"   value={stats.backlog}   accent="text-gray-500 dark:text-gray-400" />
            <StatCard label="Completed km" value={`${stats.completedKm.toLocaleString()} km`} accent="text-brand-600 dark:text-brand-400" />
          </div>

          {/* Active challenges */}
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                <CircleDot size={14} className="text-brand-500" /> Active
              </h2>
              {active.map(c => (
                <ActiveCard key={c.id} c={c} onEdit={setModal} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}

          {/* Completed */}
          {sortedYears.length > 0 && (
            <div className="card p-4 space-y-1">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} className="text-green-500" /> Completed
              </h2>
              {sortedYears.map(yr => (
                <YearSection
                  key={yr}
                  year={yr}
                  challenges={completedByYear[yr]}
                  onEdit={setModal}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}

          {/* Backlog */}
          {backlog.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2 mb-3">
                <Clock size={14} className="text-gray-400" /> Backlog
                <span className="text-gray-400 font-normal normal-case text-xs">({backlog.length})</span>
              </h2>
              {/* column headers */}
              <div className="hidden sm:flex items-center gap-3 px-4 py-1 text-[11px] text-gray-400 uppercase tracking-wide mb-1">
                <div className="w-4 flex-shrink-0" />
                <div className="flex-1" />
                <span className="w-16 text-right">Distance</span>
                <span className="w-36 text-right">Purchased</span>
                <span className="w-36 text-right">Expires</span>
                <div className="w-10" />
              </div>
              <div className="space-y-0.5">
                {backlog.map(c => (
                  <BacklogRow key={c.id} c={c} onEdit={setModal} onDelete={setDeleteTarget} />
                ))}
              </div>
            </div>
          )}

          {challenges.length === 0 && (
            <div className="card p-12 text-center text-gray-400">
              <Package size={36} className="mx-auto mb-3 opacity-30" />
              <p>No challenges yet. Add your first one to get started.</p>
            </div>
          )}
        </>
      )}

      {modal !== null && (
        <ChallengeModal
          initial={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          challenge={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
