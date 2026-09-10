import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../hooks/useApi'
import { Loader2, Plus, X, Footprints, Bike, Zap, Package, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const GEAR_TYPES = [
  { key: 'shoes',      label: 'Shoes',       icon: Footprints },
  { key: 'bike',       label: 'Bikes',        icon: Bike },
  { key: 'motorcycle', label: 'Motorcycles',  icon: Zap },
]

function typeIcon(type, size = 16) {
  const match = GEAR_TYPES.find(t => t.key === type)
  const Icon = match?.icon ?? Package
  return <Icon size={size} />
}

function typeLabel(type) {
  return GEAR_TYPES.find(t => t.key === type)?.label ?? type
}

function ProgressBar({ current, max }) {
  if (!max || max <= 0) return null
  const pct = Math.min((current / max) * 100, 100)
  const color =
    pct >= 100 ? 'bg-red-500' :
    pct >= 80  ? 'bg-orange-400' :
    pct >= 50  ? 'bg-yellow-400' :
                 'bg-brand-500'
  return (
    <div className="mt-2">
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-[10px] text-gray-400 mt-0.5">{Math.round(pct)}%</div>
    </div>
  )
}

function GearCard({ item }) {
  const unit = item.max_range_unit === 'hours' ? 'h' : 'km'
  const current = item.max_range_unit === 'hours' ? (item.duration_hours ?? 0) : (item.distance_km ?? 0)

  return (
    <Link
      to={`/gear/${item.id}`}
      className="card p-4 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</div>
        {item.retired && (
          <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded flex-shrink-0">
            Retired
          </span>
        )}
      </div>
      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {item.max_range
          ? `${current.toLocaleString()} / ${item.max_range.toLocaleString()} ${unit}`
          : `${current.toLocaleString()} ${unit}`}
      </div>
      <ProgressBar current={current} max={item.max_range} />
    </Link>
  )
}

function AddModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', type: 'shoes', note: '', max_range: '', max_range_unit: 'km' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(key, value) { setForm(f => ({ ...f, [key]: value })) }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        note: form.note.trim() || null,
        max_range: form.max_range ? parseFloat(form.max_range) : null,
        max_range_unit: form.max_range_unit,
      }
      const created = await api.post('/gear', payload)
      onCreated(created)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Add Gear</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Nike Vomero 17"
              required
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
                  onClick={() => set('type', key)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex-1 justify-center',
                    form.type === key
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-500'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Max range <span className="text-gray-400 font-normal">(optional)</span></label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="any"
                className="input flex-1"
                value={form.max_range}
                onChange={e => set('max_range', e.target.value)}
                placeholder="e.g. 800"
              />
              <select
                className="input w-24"
                value={form.max_range_unit}
                onChange={e => set('max_range_unit', e.target.value)}
              >
                <option value="km">km</option>
                <option value="hours">hours</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={2}
              maxLength={500}
              value={form.note}
              onChange={e => set('note', e.target.value)}
              placeholder="Any notes about this gear…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()} className="btn btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Gear() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [retiredOpen, setRetiredOpen] = useState(false)

  useEffect(() => {
    api.get('/gear').then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function handleCreated(item) {
    setItems(prev => [...prev, item])
    setShowAdd(false)
  }

  const activeItems = items.filter(i => !i.retired)
  const retiredItems = items.filter(i => i.retired)

  const grouped = GEAR_TYPES.map(({ key, label }) => ({
    key, label,
    items: activeItems.filter(i => i.type === key),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gear</h1>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary gap-1.5">
          <Plus size={15} /> Add item
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-brand-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Package size={36} className="mx-auto mb-3 opacity-30" />
          <p>No gear yet. Add your first item to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ key, label, items: groupItems }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gray-400 dark:text-gray-500">{typeIcon(key, 16)}</span>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  {label}
                </h2>
                <span className="text-xs text-gray-400">({groupItems.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {groupItems.map(item => <GearCard key={item.id} item={item} />)}
              </div>
            </div>
          ))}

          {retiredItems.length > 0 && (
            <div>
              <button
                onClick={() => setRetiredOpen(o => !o)}
                className="flex items-center gap-2 mb-3 group"
              >
                <span className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors">
                  {retiredOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wide group-hover:text-gray-500 dark:group-hover:text-gray-500 transition-colors">
                  Retired Gear
                </h2>
                <span className="text-xs text-gray-300 dark:text-gray-600">({retiredItems.length})</span>
              </button>
              {retiredOpen && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 opacity-60">
                  {retiredItems.map(item => <GearCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onCreated={handleCreated} />}
    </div>
  )
}
