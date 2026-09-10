import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../hooks/useApi'
import {
  ArrowLeft, Pencil, Trash2, Save, X,
  Footprints, Bike, Zap, Package,
  Map, Clock, Activity, Calendar, ChevronDown, ChevronRight,
  Loader2, ToggleLeft, ToggleRight, MapPin
} from 'lucide-react'
import { formatDate, formatDistance, formatDuration, formatSport, sportIcon } from '../utils/format'
import clsx from 'clsx'

const GEAR_TYPES = [
  { key: 'shoes',      label: 'Shoes',      icon: Footprints },
  { key: 'bike',       label: 'Bike',       icon: Bike },
  { key: 'motorcycle', label: 'Motorcycle', icon: Zap },
]

const MAX_NOTE = 500

function typeIcon(type, size = 16) {
  const match = GEAR_TYPES.find(t => t.key === type)
  const Icon = match?.icon ?? Package
  return <Icon size={size} />
}

function typeLabel(type) {
  return GEAR_TYPES.find(t => t.key === type)?.label ?? type
}

function ProgressBar({ current, max, unit }) {
  if (!max || max <= 0) return null
  const pct = Math.min((current / max) * 100, 100)
  const color =
    pct >= 100 ? 'bg-red-500' :
    pct >= 80  ? 'bg-orange-400' :
    pct >= 50  ? 'bg-yellow-400' :
                 'bg-brand-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{current.toLocaleString()} {unit} used</span>
        <span>{max.toLocaleString()} {unit} max · {Math.round(pct)}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StatBlock({ icon, label, value, sub }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="text-brand-500 dark:text-brand-400 flex-shrink-0">{icon}</div>
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}

export default function GearDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activitiesOpen, setActivitiesOpen] = useState(false)
  const [workouts, setWorkouts] = useState([])
  const [workoutsLoading, setWorkoutsLoading] = useState(false)
  const [form, setForm] = useState(null)

  useEffect(() => {
    api.get(`/gear/${id}`)
      .then(data => { setItem(data); setForm(toForm(data)) })
      .catch(() => navigate('/gear'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!activitiesOpen || workouts.length > 0) return
    setWorkoutsLoading(true)
    api.get(`/gear/${id}/workouts`)
      .then(setWorkouts)
      .catch(() => {})
      .finally(() => setWorkoutsLoading(false))
  }, [activitiesOpen, id])

  function toForm(data) {
    return {
      name: data.name,
      type: data.type,
      note: data.note ?? '',
      max_range: data.max_range != null ? String(data.max_range) : '',
      max_range_unit: data.max_range_unit ?? 'km',
      retired: data.retired ?? false,
    }
  }

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })) }

  function cancelEdit() {
    setForm(toForm(item))
    setEditing(false)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        note: form.note.trim() || null,
        max_range: form.max_range !== '' ? parseFloat(form.max_range) : null,
        max_range_unit: form.max_range_unit,
        retired: form.retired,
      }
      const updated = await api.patch(`/gear/${id}`, payload)
      setItem(updated)
      setForm(toForm(updated))
      setEditing(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem() {
    setDeleting(true)
    try {
      await api.delete(`/gear/${id}`)
      navigate('/gear')
    } catch (e) {
      alert(e.message)
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={28} className="animate-spin text-brand-500" />
    </div>
  )
  if (!item) return null

  const currentDistance = item.distance_km ?? 0
  const currentHours = item.duration_hours ?? 0
  const activityCount = item.activity_count ?? 0
  const daysOfUse = item.days_count ?? 0
  const unit = item.max_range_unit === 'hours' ? 'h' : 'km'
  const currentForProgress = item.max_range_unit === 'hours' ? currentHours : currentDistance

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link to="/gear" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          <ArrowLeft size={15} /> Gear
        </Link>
        <div className="flex items-center gap-1.5">
          {!editing ? (
            <>
              <button onClick={() => setEditing(true)} className="btn btn-secondary gap-1.5">
                <Pencil size={14} /> Edit
              </button>
              {confirmDelete ? (
                <>
                  <span className="text-xs text-gray-500">Are you sure?</span>
                  <button onClick={deleteItem} disabled={deleting} className="btn gap-1 bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1.5">
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="btn btn-secondary">Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="btn btn-secondary p-2 text-gray-400 hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={cancelEdit} className="btn btn-secondary gap-1.5">
                <X size={14} /> Cancel
              </button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="btn btn-primary gap-1.5">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="card p-5">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Type</label>
              <div className="flex gap-2 mt-1">
                {GEAR_TYPES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setField('type', key)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex-1 justify-center',
                      form.type === key
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-500'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="label mb-0">Retired</label>
              <button type="button" onClick={() => setField('retired', !form.retired)}>
                {form.retired
                  ? <ToggleRight size={24} className="text-brand-500" />
                  : <ToggleLeft size={24} className="text-gray-400" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-brand-500 dark:text-brand-400">{typeIcon(item.type, 22)}</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{item.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">{typeLabel(item.type)}</span>
                {item.retired && (
                  <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                    Retired
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBlock icon={<Map size={18} />}      label="Distance"    value={`${currentDistance.toLocaleString()} km`} />
        <StatBlock icon={<Activity size={18} />}  label="Activities"  value={activityCount} />
        <StatBlock icon={<Clock size={18} />}     label="Hours"       value={`${currentHours.toLocaleString()} h`} />
        <StatBlock icon={<Calendar size={18} />}  label="Days used"   value={daysOfUse} />
      </div>

      {/* Max range + progress */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Max Range</h2>
        </div>
        {editing ? (
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                step="any"
                className="input flex-1"
                value={form.max_range}
                onChange={e => setField('max_range', e.target.value)}
                placeholder="No limit"
              />
              <select
                className="input w-28"
                value={form.max_range_unit}
                onChange={e => setField('max_range_unit', e.target.value)}
              >
                <option value="km">km</option>
                <option value="hours">hours</option>
              </select>
            </div>
            <p className="text-xs text-gray-400">Leave empty to disable the max range limit.</p>
          </div>
        ) : (
          item.max_range ? (
            <ProgressBar current={currentForProgress} max={item.max_range} unit={unit} />
          ) : (
            <p className="text-sm text-gray-400">No limit set.</p>
          )
        )}
      </div>

      {/* Note */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Note</h2>
        {editing ? (
          <div>
            <textarea
              className="input resize-none w-full"
              rows={4}
              maxLength={MAX_NOTE}
              value={form.note}
              onChange={e => setField('note', e.target.value)}
              placeholder="Add any notes about this gear…"
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {form.note.length} / {MAX_NOTE}
            </div>
          </div>
        ) : (
          item.note
            ? <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.note}</p>
            : <p className="text-sm text-gray-400">No notes.</p>
        )}
      </div>

      {/* Activities */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setActivitiesOpen(o => !o)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Activities <span className="text-gray-400 font-normal normal-case">({activityCount})</span>
          </h2>
          {activitiesOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>
        {activitiesOpen && (
          <div className="border-t border-gray-100 dark:border-gray-800">
            {workoutsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-brand-500" />
              </div>
            ) : workouts.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">No activities linked yet.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {workouts.map(w => (
                  <Link
                    key={w.id}
                    to={`/workouts/${w.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        <span>{sportIcon(w.sport)}</span>
                        <span>{formatSport(w.sport)}</span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span>{formatDate(w.started_at)}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{w.title}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {w.distance_meters && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} />{formatDistance(w.distance_meters)}
                        </span>
                      )}
                      {w.duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />{formatDuration(w.duration_seconds)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
