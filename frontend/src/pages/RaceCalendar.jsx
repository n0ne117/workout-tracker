import { useState, useEffect, useMemo } from 'react'
import { api } from '../hooks/useApi'
import {
  Loader2, Plus, X, Save, Pencil, Trash2,
  CalendarDays, MapPin, ExternalLink, Package,
  CheckCircle2, CircleDot, Clock, HelpCircle, XCircle, MinusCircle
} from 'lucide-react'
import { formatDate } from '../utils/format'
import clsx from 'clsx'

// ── status config ──────────────────────────────────────────────────────────────

const STATUSES = [
  { key: 'planned',    label: 'Planned',    icon: Clock,        color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  { key: 'maybe',      label: 'Maybe',      icon: HelpCircle,   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { key: 'registered', label: 'Registered', icon: CircleDot,    color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' },
  { key: 'completed',  label: 'Completed',  icon: CheckCircle2, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { key: 'dnf',        label: 'DNF',        icon: XCircle,      color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  { key: 'dns',        label: 'DNS',        icon: MinusCircle,  color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
]

const RESULT_STATUSES = new Set(['completed', 'dnf', 'dns'])

function statusMeta(key) {
  return STATUSES.find(s => s.key === key) ?? STATUSES[0]
}

// ── helpers ────────────────────────────────────────────────────────────────────

const MAX_NOTES = 500

function isPast(dateStr) {
  return new Date(dateStr) < new Date()
}

function needsResult(race) {
  if (RESULT_STATUSES.has(race.status)) return false
  const endOfRaceDay = new Date(race.date)
  endOfRaceDay.setHours(23, 59, 59, 999)
  return endOfRaceDay < new Date()
}

function daysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86_400_000)
  return diff
}

function toInput(iso) {
  if (!iso) return ''
  return iso.split('T')[0]
}

// ── sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status, size = 'sm' }) {
  const { label, icon: Icon, color } = statusMeta(status)
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-full font-medium',
      color,
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
    )}>
      <Icon size={size === 'sm' ? 11 : 13} />
      {label}
    </span>
  )
}

function CountdownBadge({ dateStr }) {
  const days = daysUntil(dateStr)
  if (days < 0) return null
  if (days === 0) return <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">Today!</span>
  if (days <= 7)  return <span className="text-[11px] font-semibold text-orange-500">{days}d to go</span>
  if (days <= 30) return <span className="text-[11px] text-orange-400">{days}d</span>
  return <span className="text-[11px] text-gray-400">{days}d</span>
}

function RaceRow({ race, onEdit, onDelete }) {
  const past = isPast(race.date)
  return (
    <div className={clsx(
      'flex items-center gap-3 py-3 px-4 rounded-lg group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40',
      past && !RESULT_STATUSES.has(race.status) && 'opacity-60'
    )}>
      {/* Date */}
      <div className="w-20 flex-shrink-0 text-center">
        <div className="text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums">
          {new Date(race.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
        </div>
        <div className="text-[11px] text-gray-400 tabular-nums">
          {new Date(race.date).getFullYear()}
        </div>
        {!past && <CountdownBadge dateStr={race.date} />}
      </div>

      {/* Status */}
      <div className="w-24 flex-shrink-0">
        <StatusBadge status={race.status} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{race.name}</span>
          {race.distance && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{race.distance}</span>
          )}
        </div>
        {race.location && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate">{race.location}</span>
          </div>
        )}
        {race.notes && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{race.notes}</div>
        )}
      </div>

      {/* Website */}
      <div className="flex-shrink-0">
        {race.website ? (
          <a
            href={race.website.startsWith('http') ? race.website : `https://${race.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-brand-500 transition-colors p-1"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={14} />
          </a>
        ) : <div className="w-6" />}
      </div>

      {/* Actions */}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onEdit(race)} className="btn-ghost p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><Pencil size={13} /></button>
        <button onClick={() => onDelete(race)} className="btn-ghost p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

function ResultNudge({ race, onStatusSet }) {
  const [saving, setSaving] = useState(null)

  async function quickSet(status) {
    setSaving(status)
    try {
      const result = await api.patch(`/race-calendar/${race.id}`, { status })
      onStatusSet(result)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-amber-50 dark:bg-amber-900/10 border-l-2 border-amber-400">
      {/* Date */}
      <div className="w-20 flex-shrink-0 text-center">
        <div className="text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums">
          {new Date(race.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
        </div>
        <div className="text-[11px] text-gray-400 tabular-nums">{new Date(race.date).getFullYear()}</div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{race.name}</div>
        {race.distance && <div className="text-xs text-gray-500 dark:text-gray-400">{race.distance}</div>}
        <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">How did it go?</div>
      </div>

      {/* Quick-set buttons */}
      <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
        {[
          { status: 'completed', label: 'Completed', icon: CheckCircle2, cls: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50' },
          { status: 'dnf',       label: 'DNF',       icon: XCircle,      cls: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50' },
          { status: 'dns',       label: 'DNS',       icon: MinusCircle,  cls: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700' },
        ].map(({ status, label, icon: Icon, cls }) => (
          <button
            key={status}
            onClick={() => quickSet(status)}
            disabled={!!saving}
            className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors', cls)}
          >
            {saving === status ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── modal ──────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', distance: '', date: '', location: '', website: '', notes: '', status: 'planned',
}

function toForm(r) {
  return {
    name: r.name ?? '',
    distance: r.distance ?? '',
    date: toInput(r.date),
    location: r.location ?? '',
    website: r.website ?? '',
    notes: r.notes ?? '',
    status: r.status ?? 'planned',
  }
}

function RaceModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(initial ? toForm(initial) : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.date) { setError('Name and date are required.'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        distance: form.distance.trim() || null,
        date: form.date,
        location: form.location.trim() || null,
        website: form.website.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      }
      const result = isEdit
        ? await api.patch(`/race-calendar/${initial.id}`, payload)
        : await api.post('/race-calendar', payload)
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
          <h2 className="font-semibold text-gray-900 dark:text-white">{isEdit ? 'Edit Race' : 'Add Race'}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
          {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Race name</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Berlin Marathon" required autoFocus />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div>
              <label className="label">Distance</label>
              <input className="input" value={form.distance} onChange={e => set('distance', e.target.value)} placeholder="e.g. 42.195 km, Half" />
            </div>
          </div>

          <div>
            <label className="label">Status</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {STATUSES.map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set('status', key)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    form.status === key
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-500'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Berlin, Germany" />
          </div>

          <div>
            <label className="label">Website</label>
            <input className="input" type="text" value={form.website} onChange={e => set('website', e.target.value)} placeholder="e.g. https://www.bmw-berlin-marathon.com" />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              maxLength={MAX_NOTES}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any notes about this race…"
            />
            <div className="text-right text-xs text-gray-400 mt-0.5">{form.notes.length} / {MAX_NOTES}</div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isEdit ? 'Save changes' : 'Add race'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── delete confirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({ race, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Delete race?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          <strong className="text-gray-700 dark:text-gray-300">{race.name}</strong> will be permanently removed from your calendar.
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

export default function RaceCalendar() {
  const [races, setRaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get('/race-calendar').then(setRaces).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function handleSaved(result, isEdit) {
    setRaces(prev => isEdit
      ? prev.map(r => r.id === result.id ? result : r).sort((a, b) => new Date(a.date) - new Date(b.date))
      : [...prev, result].sort((a, b) => new Date(a.date) - new Date(b.date))
    )
    setModal(null)
  }

  function handleQuickStatus(result) {
    setRaces(prev => prev.map(r => r.id === result.id ? result : r))
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/race-calendar/${deleteTarget.id}`)
      setRaces(prev => prev.filter(r => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e) {
      alert(e.message)
      setDeleting(false)
    }
  }

  const { upcoming, past, stats } = useMemo(() => {
    const now = new Date()
    const upcoming = races.filter(r => new Date(r.date) >= now)
    const past = races.filter(r => new Date(r.date) < now).reverse() // most recent first

    const stats = {
      total: races.length,
      registered: races.filter(r => r.status === 'registered').length,
      completed: races.filter(r => r.status === 'completed').length,
      upcoming: upcoming.length,
    }
    return { upcoming, past, stats }
  }, [races])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Race Calendar</h1>
        <button onClick={() => setModal({})} className="btn btn-primary gap-1.5">
          <Plus size={15} /> Add race
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-500" /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total',      value: stats.total },
              { label: 'Upcoming',   value: stats.upcoming,   accent: 'text-brand-600 dark:text-brand-400' },
              { label: 'Registered', value: stats.registered, accent: 'text-brand-600 dark:text-brand-400' },
              { label: 'Completed',  value: stats.completed,  accent: 'text-green-600 dark:text-green-400' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="card p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                <div className={clsx('text-xl font-bold tabular-nums mt-0.5', accent ?? 'text-gray-900 dark:text-white')}>{value}</div>
              </div>
            ))}
          </div>

          {races.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <Package size={36} className="mx-auto mb-3 opacity-30" />
              <p>No races yet. Add your first one to get started.</p>
            </div>
          ) : (
            <>
              {/* Upcoming */}
              <div className="card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <CalendarDays size={14} className="text-brand-500" />
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Upcoming
                  </h2>
                  <span className="text-xs text-gray-400">({upcoming.length})</span>
                </div>
                {upcoming.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-400 text-center">No upcoming races.</div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {upcoming.map(r => (
                      <RaceRow key={r.id} race={r} onEdit={setModal} onDelete={setDeleteTarget} />
                    ))}
                  </div>
                )}
              </div>

              {/* Past */}
              {past.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <CalendarDays size={14} className="text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Past
                    </h2>
                    <span className="text-xs text-gray-400">({past.length})</span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {past.map(r => needsResult(r)
                      ? <ResultNudge key={r.id} race={r} onStatusSet={handleQuickStatus} />
                      : <RaceRow key={r.id} race={r} onEdit={setModal} onDelete={setDeleteTarget} />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {modal !== null && (
        <RaceModal
          initial={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          race={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
