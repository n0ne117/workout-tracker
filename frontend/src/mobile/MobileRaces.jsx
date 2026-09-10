import { useState, useEffect } from 'react'
import { CalendarDays, MapPin, Plus, X, ExternalLink, Flag } from 'lucide-react'
import { api } from '../hooks/useApi'

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS = {
  planned:    { label: 'Planned',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  registered: { label: 'Registered', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  completed:  { label: 'Completed',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  abandoned:  { label: 'Abandoned',  cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  maybe:      { label: 'Maybe',      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
}

function fmt(date) {
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(date) {
  const diff = Math.ceil((new Date(date) - new Date()) / 86400000)
  if (diff < 0) return null
  if (diff === 0) return 'Today!'
  if (diff === 1) return 'Tomorrow'
  if (diff < 7) return `${diff} days`
  if (diff < 30) return `${Math.round(diff / 7)}w`
  if (diff < 365) return `${Math.round(diff / 30)}mo`
  return `${(diff / 365).toFixed(1)}y`
}

// ── Race card ──────────────────────────────────────────────────────────────────
function RaceCard({ race, onDelete }) {
  const cfg = STATUS[race.status] || STATUS.planned
  const d = new Date(race.date)
  const isPast = d < new Date()
  const countdown = !isPast ? daysUntil(race.date) : null

  return (
    <div className={`px-4 py-4 transition-opacity ${isPast ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Date column */}
        <div className="w-11 flex-shrink-0 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {d.toLocaleDateString(undefined, { month: 'short' })}
          </p>
          <p className="text-xl font-bold text-gray-800 dark:text-white leading-tight">
            {d.getDate()}
          </p>
          <p className="text-[10px] text-gray-400">{d.getFullYear()}</p>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
              {cfg.label}
            </span>
            {race.distance && (
              <span className="text-[11px] text-gray-400 font-medium">{race.distance}</span>
            )}
            {countdown && (
              <span className="text-[11px] font-semibold text-brand-500 ml-auto">{countdown}</span>
            )}
          </div>
          <p className="font-semibold text-[15px] text-gray-900 dark:text-white leading-snug">{race.name}</p>
          {race.location && (
            <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
              <MapPin size={11} className="flex-shrink-0" />
              {race.location}
            </p>
          )}
          {race.notes && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 line-clamp-2">{race.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          {race.website && (
            <a
              href={race.website}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            >
              <ExternalLink size={13} className="text-gray-500" />
            </a>
          )}
          <button
            onClick={() => onDelete(race.id)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 active:bg-red-100 dark:active:bg-red-900/30 transition-colors"
          >
            <X size={13} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add-race sheet ─────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

function Input({ type = 'text', value, onChange, placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm
                 text-gray-900 dark:text-white placeholder-gray-400
                 border-0 outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
    />
  )
}

function AddSheet({ onClose, onAdded }) {
  const [form, setForm] = useState({
    name: '', distance: '', date: '', location: '', website: '', notes: '', status: 'planned',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) return setError('Name is required')
    if (!form.date)        return setError('Date is required')
    setSaving(true); setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        status: form.status,
        date: new Date(form.date).toISOString(),
        ...(form.distance.trim() && { distance: form.distance.trim() }),
        ...(form.location.trim() && { location: form.location.trim() }),
        ...(form.website.trim()  && { website: form.website.trim() }),
        ...(form.notes.trim()    && { notes: form.notes.trim() }),
      }
      const res = await api.post('/race-calendar', payload)
      onAdded(res)
      onClose()
    } catch (e) {
      setError(e.message || 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Add Race</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <Field label="Race name *">
            <Input value={form.name} onChange={v => set('name', v)} placeholder="e.g. Vienna City Marathon" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *">
              <Input type="date" value={form.date} onChange={v => set('date', v)} />
            </Field>
            <Field label="Distance">
              <Input value={form.distance} onChange={v => set('distance', v)} placeholder="e.g. 42 km" />
            </Field>
          </div>
          <Field label="Location">
            <Input value={form.location} onChange={v => set('location', v)} placeholder="City, Country" />
          </Field>
          <Field label="Website">
            <Input type="url" value={form.website} onChange={v => set('website', v)} placeholder="https://..." />
          </Field>
          <Field label="Status">
            <div className="flex flex-wrap gap-2 pt-0.5">
              {Object.entries(STATUS).map(([k, c]) => (
                <button
                  key={k}
                  onClick={() => set('status', k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    form.status === k ? c.cls : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any notes…"
              rows={3}
              className="w-full px-3.5 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm
                         text-gray-900 dark:text-white placeholder-gray-400
                         border-0 outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-base
                       active:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Add Race'}
          </button>
        </div>
        <div style={{ height: 'max(env(safe-area-inset-bottom, 0px), 16px)' }} />
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MobileRaces() {
  const [races, setRaces]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)

  useEffect(() => {
    api.get('/race-calendar')
      .then(setRaces)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const now   = new Date()
  const upcoming = races.filter(r => new Date(r.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date))
  const past     = races.filter(r => new Date(r.date) <  now).sort((a, b) => new Date(b.date) - new Date(a.date))

  function handleAdded(race) {
    setRaces(prev => [...prev, race])
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/race-calendar/${id}`)
      setRaces(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm
                   px-4 pt-3 pb-3 border-b border-gray-100 dark:border-gray-800
                   flex items-center justify-between"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Race Calendar</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-600 active:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus size={18} className="text-white" />
        </button>
      </div>

      {loading ? (
        <div className="pt-4 px-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white dark:bg-gray-900 animate-pulse" />
          ))}
        </div>
      ) : races.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Flag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-base">No races yet</p>
          <p className="text-sm mt-1">Tap + to add your first race</p>
        </div>
      ) : (
        <div className="pt-4 px-4 space-y-4">
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Upcoming</p>
              <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm
                              divide-y divide-gray-50 dark:divide-gray-800">
                {upcoming.map(r => <RaceCard key={r.id} race={r} onDelete={handleDelete} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Past</p>
              <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm
                              divide-y divide-gray-50 dark:divide-gray-800">
                {past.map(r => <RaceCard key={r.id} race={r} onDelete={handleDelete} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddSheet onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}
    </div>
  )
}
