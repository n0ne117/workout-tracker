import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Heart, TrendingUp, Zap, Clock, Ruler, Flame, Activity, X, Plus, Footprints, Bike, Package, Pencil, Trophy, Scissors } from 'lucide-react'
import { api } from '../hooks/useApi'
import WorkoutMap from '../components/WorkoutMap'
import WorkoutTrimmer from '../components/WorkoutTrimmer'
import HeartRateChart from '../components/HeartRateChart'
import ElevationChart from '../components/ElevationChart'
import WalkRunChart from '../components/WalkRunChart'
import { PaceChart, CadenceChart, PowerChart, VerticalOscillationChart, GroundContactChart, HrZoneChart, PowerZoneChart } from './MobileCharts'
import { getSportIcon, sportSolidBg, fmtDuration, fmtDistance, fmtPace, fmtSpeed, PACE_SPORTS, fmtTime } from './utils'
import { formatSport, formatDate } from '../utils/format'

// ── Gear tab ───────────────────────────────────────────────────────────────────
const GEAR_TYPE_ICONS = { shoes: Footprints, bike: Bike, motorcycle: Zap }
function GearTypeIcon({ type, size = 15 }) {
  const Icon = GEAR_TYPE_ICONS[type] ?? Package
  return <Icon size={size} />
}

function GearProgressBar({ current, max }) {
  if (!max || max <= 0) return null
  const pct = Math.min((current / max) * 100, 100)
  const color =
    pct >= 100 ? 'bg-red-500' :
    pct >= 80  ? 'bg-orange-400' :
    pct >= 50  ? 'bg-yellow-400' :
                 'bg-brand-500'
  return (
    <div className="mt-2.5">
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
        <span>{current.toLocaleString()} / {max.toLocaleString()}</span>
        <span>{Math.round(pct)}%</span>
      </div>
    </div>
  )
}

function GearCard({ item, onRemove }) {
  const unit    = item.max_range_unit === 'hours' ? 'h' : 'km'
  const current = item.max_range_unit === 'hours' ? (item.duration_hours ?? 0) : (item.distance_km ?? 0)

  const stats = [
    item.distance_km   > 0 ? `${item.distance_km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`  : null,
    item.duration_hours > 0 ? `${item.duration_hours.toLocaleString(undefined, { maximumFractionDigits: 0 })}h` : null,
    item.activity_count > 0 ? `${item.activity_count} ${item.activity_count === 1 ? 'activity' : 'activities'}` : null,
  ].filter(Boolean)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
          <GearTypeIcon type={item.type} size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-[15px] text-gray-900 dark:text-white leading-tight">{item.name}</span>
            <button
              onClick={() => onRemove(item.id)}
              className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center
                         flex-shrink-0 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            >
              <X size={12} className="text-gray-400 dark:text-gray-500" />
            </button>
          </div>
          {stats.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{stats.join(' · ')}</p>
          )}
          {item.note && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{item.note}</p>
          )}
          <GearProgressBar current={current} max={item.max_range} />
        </div>
      </div>
    </div>
  )
}

function GearPicker({ available, onConfirm, onClose }) {
  const [selected, setSelected] = useState(new Set())

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl flex flex-col max-h-[70vh]"
           style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <span className="font-semibold text-gray-900 dark:text-white">Add Gear</span>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:bg-gray-200 transition-colors">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50 dark:divide-gray-800">
          {available.map(item => {
            const checked = selected.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <GearTypeIcon type={item.type} size={15} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                  {item.distance_km > 0 && (
                    <p className="text-xs text-gray-400">
                      {item.distance_km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                    </p>
                  )}
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  checked
                    ? 'bg-brand-600 border-brand-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {checked && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1,4 4,7 9,1" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Confirm */}
        <div className="px-4 pt-3 flex-shrink-0">
          <button
            onClick={() => onConfirm([...selected])}
            disabled={selected.size === 0}
            className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-sm
                       disabled:opacity-40 active:bg-brand-700 transition-colors"
          >
            {selected.size === 0 ? 'Add Gear' : `Add ${selected.size} item${selected.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function MobileGearSection({ workoutId }) {
  const [gearItems, setGearItems] = useState([])
  const [allGear, setAllGear]     = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/workouts/${workoutId}/gear`),
      api.get('/gear'),
    ]).then(([linked, all]) => {
      setGearItems(linked)
      setAllGear(all.filter(g => !g.retired))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [workoutId])

  async function handleConfirm(ids) {
    setPickerOpen(false)
    const toAdd = allGear.filter(g => ids.includes(g.id))
    await Promise.all(toAdd.map(item => api.post(`/workouts/${workoutId}/gear/${item.id}`, {}).catch(() => {})))
    setGearItems(prev => [...prev, ...toAdd.filter(item => !prev.some(p => p.id === item.id))])
  }

  async function removeGear(gearId) {
    try {
      await api.delete(`/workouts/${workoutId}/gear/${gearId}`)
      setGearItems(prev => prev.filter(g => g.id !== gearId))
    } catch {}
  }

  const linkedIds = new Set(gearItems.map(g => g.id))
  const available = allGear.filter(g => !linkedIds.has(g.id))

  if (loading) {
    return (
      <div className="px-4 space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white dark:bg-gray-900 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-220px)]">
      <div className="px-4 space-y-3 flex-1">
        {gearItems.length === 0 ? (
          <div className="text-center py-16">
            <Package size={36} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
            <p className="text-sm text-gray-400 dark:text-gray-600">No gear linked to this workout</p>
          </div>
        ) : (
          gearItems.map(item => (
            <GearCard key={item.id} item={item} onRemove={removeGear} />
          ))
        )}
      </div>

      {available.length > 0 && (
        <div className="px-4 pt-4">
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700
                       text-sm font-semibold text-gray-400 dark:text-gray-500
                       active:border-brand-400 active:text-brand-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Add Gear
          </button>
        </div>
      )}

      {pickerOpen && (
        <GearPicker
          available={available}
          onConfirm={handleConfirm}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-500' }) {
  if (!value) return null
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
      <div className={`${color} mb-1`}><Icon size={18} /></div>
      <div className="text-xl font-bold text-gray-900 dark:text-white leading-none">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  )
}

// ── Stats section card ─────────────────────────────────────────────────────────
function StatSection({ title, rows }) {
  const visible = rows.filter(r => r.value != null)
  if (!visible.length) return null
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 pt-3 pb-2">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
        {visible.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Chart card (full width) ────────────────────────────────────────────────────
function ChartCard({ children }) {
  return (
    <div className="px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl px-4 pt-4 pb-3 shadow-sm">
        {children}
      </div>
    </div>
  )
}

// ── Edit sheet ─────────────────────────────────────────────────────────────────
function EditSheet({ workout, onSave, onClose }) {
  const [title, setTitle]   = useState(workout.title || '')
  const [isRace, setIsRace] = useState(workout.is_race ?? false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100) }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await api.patch(`/workouts/${workout.id}`, { title: title.trim() || null, is_race: isRace })
      onSave(updated)
    } catch { /* silent */ }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl flex flex-col"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold text-gray-900 dark:text-white">Edit Workout</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:bg-gray-200 transition-colors"
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        <div className="px-4 pb-2 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</label>
            <input
              ref={inputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Workout name"
              className="mt-1.5 w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-[15px]
                         placeholder-gray-300 dark:placeholder-gray-600
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Race toggle */}
          <button
            onClick={() => setIsRace(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                       bg-gray-50 dark:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trophy size={18} className={isRace ? 'text-brand-500' : 'text-gray-400'} />
              <span className="text-[15px] font-medium text-gray-900 dark:text-white">Race</span>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${isRace ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isRace ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>

        <div className="px-4 pt-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-sm
                       disabled:opacity-50 active:bg-brand-700 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const RUNNING_SPORTS = new Set(['running', 'trail_running'])

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'stats',    label: 'Stats'    },
  { key: 'charts',   label: 'Charts'   },
  { key: 'gear',     label: 'Gear'     },
]

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MobileWorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartHoverDist, setChartHoverDist] = useState(null)
  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [trimmerOpen, setTrimmerOpen] = useState(false)
  const [trimSaving, setTrimSaving] = useState(false)

  useEffect(() => {
    api.get(`/workouts/${id}`)
      .then(setWorkout)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  async function handleTrim(startIndex, endIndex) {
    setTrimSaving(true)
    try {
      const updated = await api.post(`/workouts/${id}/trim`, { start_index: startIndex, end_index: endIndex })
      setWorkout(updated)
      setTrimmerOpen(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setTrimSaving(false)
    }
  }

  // Must be before early returns — hooks cannot be called conditionally
  const trackStats = useMemo(() => {
    const track = workout?.track_points ?? []
    if (!track.length) return {}
    const nonNull = (arr) => arr.filter(v => v != null && v > 0)
    const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
    const cads  = nonNull(track.map(p => p.cad))
    const pows  = nonNull(track.map(p => p.power))
    const vos   = nonNull(track.map(p => p.vertical_oscillation))
    const gcts  = nonNull(track.map(p => p.ground_contact_time))
    const strs  = nonNull(track.map(p => p.stride_length))
    const eles  = track.filter(p => p.ele != null).map(p => p.ele)
    return {
      maxCad:    cads.length ? Math.max(...cads)  : null,
      maxPower:  pows.length ? Math.max(...pows)  : null,
      avgVO:     vos.length  ? avg(vos)           : null,
      avgGCT:    gcts.length ? avg(gcts)          : null,
      avgStride: strs.length ? avg(strs)          : null,
      minEle:    eles.length ? Math.min(...eles)  : null,
      maxEle:    eles.length ? Math.max(...eles)  : null,
    }
  }, [workout])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-gray-400">Workout not found</p>
        <button onClick={() => navigate('/')} className="text-brand-500 font-medium">← Back</button>
      </div>
    )
  }

  const bg = sportSolidBg(workout.sport)
  const SportIcon = getSportIcon(workout.sport)
  const pace  = PACE_SPORTS.has(workout.sport) ? fmtPace(workout.distance_meters, workout.duration_seconds) : null
  const speed = !pace ? fmtSpeed(workout.avg_speed_ms) : null

  const track   = workout.track_points ?? []
  const hasHR   = track.some(p => p.hr   != null)
  const hasEle  = track.some(p => p.ele  != null)
  const hasPace = PACE_SPORTS.has(workout.sport) && track.some(p => p.speed != null)
  const hasCad  = track.some(p => p.cad  != null)
  const hasPow  = track.some(p => p.power != null)
  const hasVO   = track.some(p => p.vertical_oscillation != null)
  const hasGCT  = track.some(p => p.ground_contact_time  != null)
  const hasHrZones  = workout.icu_hr_zone_times?.some(t => t > 0)
  const hasPwrZones = workout.icu_zone_times?.some(t => t > 0)
  const anyChart = hasHR || hasEle || hasPace || hasCad || hasPow || hasVO || hasGCT || hasHrZones || hasPwrZones

  // Pace/speed formatting helpers
  function fmtPaceStr(distM, durSec) {
    if (!distM || !durSec) return null
    const secPerKm = (durSec / distM) * 1000
    if (!isFinite(secPerKm) || secPerKm < 60 || secPerKm > 1800) return null
    const m = Math.floor(secPerKm / 60)
    const s = Math.round(secPerKm % 60)
    return `${m}:${String(s).padStart(2, '0')} /km`
  }
  function fmtKmh(ms) {
    if (!ms) return null
    return `${(ms * 3.6).toFixed(1)} km/h`
  }
  const isPaceSport = PACE_SPORTS.has(workout.sport)
  const movingSpeedMs = (workout.distance_meters && workout.moving_time_seconds)
    ? workout.distance_meters / workout.moving_time_seconds : null

  const bbox = (workout.bbox_min_lat != null) ? {
    min_lat: workout.bbox_min_lat, max_lat: workout.bbox_max_lat,
    min_lon: workout.bbox_min_lon, max_lon: workout.bbox_max_lon,
  } : null

  return (
    <div className="pb-8">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm
                   border-b border-gray-100 dark:border-gray-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="flex items-center gap-3 px-3 pb-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center
                       shadow-sm active:scale-90 transition-transform flex-shrink-0"
          >
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>

          <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
            <SportIcon size={18} className="text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-bold text-[15px] text-gray-900 dark:text-white truncate">
              {workout.title || formatSport(workout.sport)}
            </div>
            <div className="text-xs text-gray-400">
              {formatDate(workout.started_at)} · {fmtTime(workout.started_at)}
            </div>
          </div>

          <button
            onClick={() => setEditOpen(true)}
            className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center
                       shadow-sm active:scale-90 transition-transform flex-shrink-0"
          >
            <Pencil size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex justify-center overflow-x-auto scrollbar-none px-3 pb-0 gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                tab === t.key
                  ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400'
                  : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 space-y-4">

        {/* ── Overview ── */}
        {tab === 'overview' && <>
          {workout.has_track && (
            <div className="mx-4 rounded-2xl shadow-sm">
              <WorkoutMap trackPoints={track} bbox={bbox} />
              {track.length > 1 && (
                <button
                  onClick={() => setTrimmerOpen(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
                             text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800
                             active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
                >
                  <Scissors size={15} />
                  Trim GPS Track
                </button>
              )}
            </div>
          )}

          <div className="px-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full text-white ${bg}`}>
              <SportIcon size={11} className="text-white" />
              {formatSport(workout.sport)}
              {workout.is_race && <span className="ml-1 opacity-80">· Race</span>}
            </span>
          </div>

          <div className="px-4 grid grid-cols-2 gap-3">
            <StatCard icon={Ruler}      label="Distance"   value={fmtDistance(workout.distance_meters)}  color="text-brand-500" />
            <StatCard icon={Clock}      label="Time"        value={fmtDuration(workout.duration_seconds)} color="text-purple-500" />
            {pace  && <StatCard icon={Activity} label="Pace"       value={pace}                           color="text-orange-500" />}
            {speed && <StatCard icon={Activity} label="Avg Speed"  value={speed}                          color="text-orange-500" />}
            <StatCard icon={Heart}      label="Avg HR"      value={workout.avg_heart_rate ? `${workout.avg_heart_rate}` : null}
                                                            sub={workout.max_heart_rate ? `max ${workout.max_heart_rate}` : null} color="text-red-500" />
            <StatCard icon={TrendingUp} label="Elev Gain"   value={workout.elevation_gain_meters ? `${Math.round(workout.elevation_gain_meters)} m` : null}
                                                            sub={workout.elevation_loss_meters ? `↓ ${Math.round(workout.elevation_loss_meters)} m` : null} color="text-green-500" />
            <StatCard icon={Flame}      label="Calories"    value={workout.calories ? `${workout.calories}` : null}            color="text-amber-500" />
            <StatCard icon={Zap}        label="Avg Power"   value={workout.avg_power_watts ? `${workout.avg_power_watts} W` : null} color="text-yellow-500" />
          </div>

          {workout.moving_time_seconds && workout.moving_time_seconds !== workout.duration_seconds && (
            <div className="px-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm">
                <span className="text-sm text-gray-500 dark:text-gray-400">Moving time</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {fmtDuration(workout.moving_time_seconds)}
                </span>
              </div>
            </div>
          )}

          {workout.notes && (
            <div className="px-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {workout.notes}
                </p>
              </div>
            </div>
          )}
        </>}

        {/* ── Stats ── */}
        {tab === 'stats' && (
          <div className="px-4 space-y-3">
            <StatSection title="Pace" rows={[
              { label: 'Avg Pace',        value: isPaceSport ? fmtPaceStr(workout.distance_meters, workout.duration_seconds) : null },
              { label: 'Avg Moving Pace', value: isPaceSport ? fmtPaceStr(workout.distance_meters, workout.moving_time_seconds) : null },
              { label: 'Best Pace',       value: isPaceSport ? fmtPaceStr(1000, workout.max_speed_ms ? 1000 / workout.max_speed_ms : null) : null },
            ]} />

            <StatSection title="Speed" rows={[
              { label: 'Avg Speed',        value: fmtKmh(workout.avg_speed_ms) },
              { label: 'Avg Moving Speed', value: fmtKmh(movingSpeedMs) },
              { label: 'Max Speed',        value: fmtKmh(workout.max_speed_ms) },
            ]} />

            <StatSection title="Timing" rows={[
              { label: 'Total Time',  value: workout.duration_seconds   ? fmtDuration(workout.duration_seconds)   : null },
              { label: 'Moving Time', value: workout.moving_time_seconds ? fmtDuration(workout.moving_time_seconds) : null },
            ]} />

            <StatSection title="Heart Rate" rows={[
              { label: 'Avg Heart Rate', value: workout.avg_heart_rate ? `${workout.avg_heart_rate} bpm` : null },
              { label: 'Max Heart Rate', value: workout.max_heart_rate ? `${workout.max_heart_rate} bpm` : null },
            ]} />

            <StatSection title="Power" rows={[
              { label: 'Avg Power', value: workout.avg_power_watts ? `${workout.avg_power_watts} W` : null },
              { label: 'Max Power', value: trackStats.maxPower      ? `${trackStats.maxPower} W`      : null },
            ]} />

            {RUNNING_SPORTS.has(workout.sport) && (
              <StatSection title="Running Dynamics" rows={[
                { label: 'Avg Run Cadence',          value: workout.avg_cadence   ? `${workout.avg_cadence} spm`               : null },
                { label: 'Max Run Cadence',          value: trackStats.maxCad     ? `${trackStats.maxCad} spm`                 : null },
                { label: 'Avg Stride Length',        value: trackStats.avgStride  ? `${(trackStats.avgStride / 100).toFixed(2)} m` : null },
                { label: 'Avg Vertical Oscillation', value: trackStats.avgVO      ? `${trackStats.avgVO.toFixed(1)} cm`        : null },
                { label: 'Avg Ground Contact Time',  value: trackStats.avgGCT     ? `${Math.round(trackStats.avgGCT)} ms`     : null },
              ]} />
            )}

            <StatSection title="Elevation" rows={[
              { label: 'Total Ascent',  value: workout.elevation_gain_meters ? `${Math.round(workout.elevation_gain_meters)} m` : null },
              { label: 'Total Descent', value: workout.elevation_loss_meters ? `${Math.round(workout.elevation_loss_meters)} m` : null },
              { label: 'Min Elevation', value: trackStats.minEle != null     ? `${Math.round(trackStats.minEle)} m`             : null },
              { label: 'Max Elevation', value: trackStats.maxEle != null     ? `${Math.round(trackStats.maxEle)} m`             : null },
            ]} />

            <StatSection title="Calories" rows={[
              { label: 'Total Calories', value: workout.calories ? `${workout.calories.toLocaleString()} kcal` : null },
            ]} />
          </div>
        )}

{/* ── Charts ── */}
        {tab === 'charts' && <>
          {!anyChart && (
            <div className="px-4 text-gray-400 dark:text-gray-600 text-sm text-center py-16">No chart data</div>
          )}

          {/* Heart Rate */}
          {hasHR && (
            <div className="px-4">
              <HeartRateChart
                trackPoints={track}
                maxHr={workout.max_heart_rate}
                hoverDist={chartHoverDist}
                onHoverChange={setChartHoverDist}
              />
            </div>
          )}

          {/* Elevation */}
          {hasEle && (
            <div className="px-4">
              <ElevationChart
                trackPoints={track}
                hoverDist={chartHoverDist}
                onHoverChange={setChartHoverDist}
              />
            </div>
          )}

          {/* Pace */}
          {hasPace && (
            <ChartCard>
              <PaceChart trackPoints={track} hoverDist={chartHoverDist} onHoverChange={setChartHoverDist} />
            </ChartCard>
          )}

          {/* Walk / Run */}
          {RUNNING_SPORTS.has(workout.sport) && track.length > 0 && (
            <div className="px-4">
              <WalkRunChart
                trackPoints={track}
                hoverDist={chartHoverDist}
                onHoverChange={setChartHoverDist}
              />
            </div>
          )}

          {/* Power */}
          {hasPow && (
            <ChartCard>
              <PowerChart trackPoints={track} hoverDist={chartHoverDist} onHoverChange={setChartHoverDist} />
            </ChartCard>
          )}

          {/* Cadence */}
          {hasCad && (
            <ChartCard>
              <CadenceChart trackPoints={track} sport={workout.sport} hoverDist={chartHoverDist} onHoverChange={setChartHoverDist} />
            </ChartCard>
          )}

          {/* Vertical Oscillation */}
          {hasVO && (
            <ChartCard>
              <VerticalOscillationChart trackPoints={track} hoverDist={chartHoverDist} onHoverChange={setChartHoverDist} />
            </ChartCard>
          )}

          {/* Ground Contact Time */}
          {hasGCT && (
            <ChartCard>
              <GroundContactChart trackPoints={track} hoverDist={chartHoverDist} onHoverChange={setChartHoverDist} />
            </ChartCard>
          )}

          {/* HR Zones */}
          {hasHrZones && (
            <ChartCard>
              <HrZoneChart zoneTimes={workout.icu_hr_zone_times} />
            </ChartCard>
          )}

          {/* Power Zones */}
          {hasPwrZones && (
            <ChartCard>
              <PowerZoneChart zoneTimes={workout.icu_zone_times} />
            </ChartCard>
          )}
        </>}

        {/* ── Gear ── */}
        {tab === 'gear' && (
          <MobileGearSection workoutId={id} />
        )}

      </div>

      {editOpen && (
        <EditSheet
          workout={workout}
          onSave={updated => { setWorkout(updated); setEditOpen(false) }}
          onClose={() => setEditOpen(false)}
        />
      )}

      {trimmerOpen && track.length > 1 && (
        <WorkoutTrimmer
          trackPoints={track}
          onSave={handleTrim}
          onCancel={() => setTrimmerOpen(false)}
          saving={trimSaving}
        />
      )}
    </div>
  )
}
