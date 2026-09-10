import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { api } from '../hooks/useApi'
import WorkoutMap from '../components/WorkoutMap'
import WorkoutTrimmer from '../components/WorkoutTrimmer'
import PaceChart from '../components/PaceChart'
import { HeartRateChart, ElevationChart, WalkRunChart, PowerChart, CadenceChart, VerticalOscillationChart, GroundContactChart } from '../components/Charts'
import { HrZoneChart, PowerZoneChart } from '../components/CompactCharts'
import SportIcon from '../components/SportIcon'
import { sportBadgeClass, isPaceSport } from '../utils/sports'
import {
  ArrowLeft, Trophy, Pencil, Trash2, Save, X,
  Heart, Zap, Clock, TrendingUp, Wind, Activity,
  Loader2, MapPin, Map, AlertCircle, MessageSquare,
  Package, Plus, Footprints, Bike, Scissors
} from 'lucide-react'
import {
  formatDuration, formatDistance, formatDatetime,
  formatSport, formatSpeed, formatElevation, formatHR,
  formatWorkoutRate, workoutRateLabel,
} from '../utils/format'
import clsx from 'clsx'

const MAX_COMMENT = 500

const GEAR_TYPE_ICONS = { shoes: Footprints, bike: Bike, motorcycle: Zap }
function GearTypeIcon({ type, size = 13 }) {
  const Icon = GEAR_TYPE_ICONS[type] ?? Package
  return <Icon size={size} />
}

function GearSection({ workoutId }) {
  const [gearItems, setGearItems] = useState([])
  const [allGear, setAllGear] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pickerLoading, setPickerLoading] = useState(false)
  const allGearFetched = useRef(false)
  const pickerRef = useRef(null)

  // Only fetch gear linked to this workout on mount — not the full gear list
  useEffect(() => {
    api.get(`/workouts/${workoutId}/gear`)
      .then(setGearItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workoutId])

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function handler(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  // Lazy-load the full gear list only when the picker is first opened
  async function openPicker() {
    if (!allGearFetched.current) {
      setPickerLoading(true)
      try {
        const all = await api.getCached('/gear')
        setAllGear(all)
        allGearFetched.current = true
      } catch (e) {
        // silent
      } finally {
        setPickerLoading(false)
      }
    }
    setPickerOpen(o => !o)
  }

  async function addGear(item) {
    try {
      await api.post(`/workouts/${workoutId}/gear/${item.id}`, {})
      setGearItems(prev => [...prev, item])
      api.invalidate('/gear')
    } catch (e) { alert(e.message) }
    setPickerOpen(false)
  }

  async function removeGear(gearId) {
    try {
      await api.delete(`/workouts/${workoutId}/gear/${gearId}`)
      setGearItems(prev => prev.filter(g => g.id !== gearId))
      api.invalidate('/gear')
    } catch (e) { alert(e.message) }
  }

  const linkedIds = new Set(gearItems.map(g => g.id))
  const available = allGear.filter(g => !g.retired && !linkedIds.has(g.id))

  if (loading) return null

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mr-1">Gear</span>

        {gearItems.map(item => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300"
          >
            <GearTypeIcon type={item.type} />
            <Link to={`/gear/${item.id}`} className="hover:underline">{item.name}</Link>
            <button
              onClick={() => removeGear(item.id)}
              className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={11} />
            </button>
          </span>
        ))}

        {gearItems.length === 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-600">No gear linked</span>
        )}

        <div className="relative" ref={pickerRef}>
          <button
            onClick={openPicker}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            {pickerLoading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add
          </button>

          {pickerOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg min-w-44 py-1 max-h-56 overflow-y-auto">
              {available.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-400">No more gear to add</div>
              ) : (
                available.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addGear(item)}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <GearTypeIcon type={item.type} size={14} />
                    {item.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentCard({ workoutId, initialNotes, onSaved }) {
  const [text, setText] = useState(initialNotes || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  // Keep in sync if parent reloads
  useEffect(() => { setText(initialNotes || '') }, [initialNotes])

  function startEdit() {
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await api.patch(`/workouts/${workoutId}`, { notes: text })
      onSaved(updated)
      setEditing(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setText(initialNotes || '')
    setEditing(false)
  }

  const remaining = MAX_COMMENT - text.length

  return (
    <div className="card p-4">
      {editing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            className="input resize-none text-sm"
            rows={4}
            maxLength={MAX_COMMENT}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment…"
          />
          <div className="flex items-center justify-between gap-2">
            <span className={clsx('text-xs tabular-nums', remaining < 50 ? 'text-red-400' : 'text-gray-400 dark:text-gray-500')}>
              {remaining} characters left
            </span>
            <div className="flex gap-2">
              <button onClick={cancel} className="btn-secondary py-1 px-3 text-xs">
                <X size={13} /> Cancel
              </button>
              <button onClick={save} disabled={saving} className="btn-primary py-1 px-3 text-xs">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={startEdit}
          className="w-full text-left group"
        >
          {text ? (
            <div className="flex items-start gap-2">
              <MessageSquare size={15} className="text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap flex-1">{text}</p>
              <Pencil size={13} className="text-gray-300 dark:text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-500 transition-colors">
              <MessageSquare size={15} />
              <span className="text-sm">Add a comment…</span>
            </div>
          )}
        </button>
      )}
    </div>
  )
}

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state: navState } = useLocation()
  const fromRaces = navState?.from === 'races'
  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [categories, setCategories] = useState([])
  const [chartHoverDist, setChartHoverDist] = useState(null)
  const [trimmerOpen, setTrimmerOpen] = useState(false)
  const [trimSaving, setTrimSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.get(`/workouts/${id}`),
      api.get('/workouts/categories'),
    ]).then(([w, cats]) => {
      setWorkout(w)
      setCategories(cats.categories || [])
    }).catch(e => {
      setError(e.message || 'Could not load workout')
    }).finally(() => setLoading(false))
  }, [id])

  function startEdit() {
    setForm({
      title: workout.title,
      sport: workout.sport,
      is_race: workout.is_race,
    })
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await api.patch(`/workouts/${id}`, form)
      setWorkout(prev => ({ ...prev, ...updated }))
      setEditing(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

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

  async function deleteWorkout() {
    if (!confirm('Delete this workout?')) return
    setDeleting(true)
    try {
      await api.delete(`/workouts/${id}`)
      navigate('/')
    } catch (e) {
      alert(e.message)
      setDeleting(false)
    }
  }

  // Must be before early returns — hooks cannot be called conditionally
  const trackStats = useMemo(() => {
    const pts = workout?.track_points ?? []
    if (!pts.length) return {}
    const nonNull = arr => arr.filter(v => v != null && v > 0)
    const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
    const vos  = nonNull(pts.map(p => p.vertical_oscillation))
    const gcts = nonNull(pts.map(p => p.ground_contact_time))
    const strs = nonNull(pts.map(p => p.stride_length))
    return {
      avgVO:     vos.length  ? avg(vos)  : null,
      avgGCT:    gcts.length ? avg(gcts) : null,
      avgStride: strs.length ? avg(strs) : null,
    }
  }, [workout])

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={28} className="animate-spin text-brand-500" />
    </div>
  )

  if (error) return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
        <ArrowLeft size={16} /> Back
      </Link>
      <div className="card p-6 flex items-center gap-3 text-red-500">
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    </div>
  )

  if (!workout) return null

  const isRunning = ['running', 'trail_running'].includes(workout.sport)

  // Pace/speed comes from the shared helper so this page, the list and the
  // stats endpoint can never disagree about the same workout again.
  const rate = formatWorkoutRate(workout)

  const track       = workout.track_points ?? []
  const hasCad      = track.some(p => p.cad   != null)
  const hasPow      = track.some(p => p.power != null)
  const hasVO       = track.some(p => p.vertical_oscillation != null)
  const hasGCT      = track.some(p => p.ground_contact_time  != null)
  const hasHrZones  = workout.icu_hr_zone_times?.some(t => t > 0)
  const hasPwrZones = workout.icu_zone_times?.some(t => t > 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to={fromRaces ? '/races' : '/'} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
        <ArrowLeft size={16} /> {fromRaces ? 'Back to races' : 'Back to workouts'}
      </Link>

      {/* Header card */}
      <div className="card p-5">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Sport</label>
              <select
                className="input"
                value={form.sport}
                onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{formatSport(cat)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_race"
                checked={form.is_race}
                onChange={e => setForm(f => ({ ...f, is_race: e.target.checked }))}
                className="w-4 h-4 rounded accent-brand-600"
              />
              <label htmlFor="is_race" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Trophy size={14} className="text-yellow-500" /> Mark as Race
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary">
                <X size={15} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={clsx('badge', sportBadgeClass(workout.sport))}>
                  <SportIcon sport={workout.sport} size={12} variant="plain" className="mr-1 inline align-[-2px]" />
                  {formatSport(workout.sport)}
                </span>
                {workout.is_race && (
                  <span className="badge bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    <Trophy size={11} className="mr-1 inline" /> Race
                  </span>
                )}
                {workout.has_track && (
                  <span className="badge bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    <Map size={11} className="mr-1 inline" /> GPS
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{workout.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{formatDatetime(workout.started_at)}</p>
              {workout.source && (
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                  Source: {workout.source}
                  {workout.original_filename ? ` (${workout.original_filename})` : ''}
                </p>
              )}
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={startEdit} className="btn-secondary px-2.5 py-2" title="Edit details">
                <Pencil size={15} />
              </button>
              {workout.has_track && workout.track_points?.length > 1 && (
                <button
                  onClick={() => setTrimmerOpen(true)}
                  className="btn-secondary px-2.5 py-2"
                  title="Trim GPS track"
                >
                  <Scissors size={15} />
                </button>
              )}
              <button
                onClick={deleteWorkout}
                disabled={deleting}
                className="btn-ghost px-2.5 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Comment */}
      <CommentCard
        workoutId={id}
        initialNotes={workout.notes}
        onSaved={updated => setWorkout(prev => ({ ...prev, ...updated }))}
      />

      {/* Gear */}
      <GearSection workoutId={id} />

      {/* Map */}
      {workout.has_track && (
        <WorkoutMap
          trackPoints={workout.track_points}
          bbox={{
            min_lat: workout.bbox_min_lat,
            max_lat: workout.bbox_max_lat,
            min_lon: workout.bbox_min_lon,
            max_lon: workout.bbox_max_lon,
          }}
        />
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={<Clock size={18} />}                                  label="Elapsed Time"  value={formatDuration(workout.duration_seconds)} />
        <StatCard icon={<Clock size={18} className="text-green-500" />}       label="Moving Time"   value={formatDuration(workout.moving_time_seconds)} />
        <StatCard icon={<MapPin size={18} className="text-brand-400" />}      label="Distance"      value={formatDistance(workout.distance_meters)} />

        {/* One card, whichever unit this sport actually uses, always derived
            from moving time. Replaces the old isRunOrHike / isCycling pair,
            which left swimming and skating with no rate at all. */}
        {rate && (
          <StatCard
            icon={isPaceSport(workout.sport)
              ? <TrendingUp size={18} className="text-orange-400" />
              : <Wind size={18} className="text-blue-400" />}
            label={workoutRateLabel(workout.sport)}
            value={rate}
          />
        )}
        {workout.max_speed_ms > 0 && !isPaceSport(workout.sport) && (
          <StatCard icon={<Wind size={18} className="text-blue-600" />} label="Max Speed" value={formatSpeed(workout.max_speed_ms)} />
        )}

        <StatCard icon={<TrendingUp size={18} className="text-green-500" />}   label="Elevation ↑"  value={formatElevation(workout.elevation_gain_meters)} />
        <StatCard icon={<Heart size={18} className="text-red-400" />}          label="Avg HR"        value={formatHR(workout.avg_heart_rate)} />
        <StatCard icon={<Heart size={18} className="text-red-600" />}          label="Max HR"        value={formatHR(workout.max_heart_rate)} />

        {workout.avg_cadence && (
          <StatCard icon={<Activity size={18} className="text-violet-400" />}  label="Avg Cadence"   value={`${workout.avg_cadence} ${isRunning ? 'spm' : 'rpm'}`} />
        )}
        {workout.avg_power_watts && (
          <StatCard icon={<Zap size={18} className="text-yellow-400" />}       label="Avg Power"     value={`${workout.avg_power_watts} W`} />
        )}
        {workout.calories && (
          <StatCard icon={<Zap size={18} className="text-orange-400" />}       label="Calories"      value={`${workout.calories} kcal`} />
        )}
      </div>

      {/* Running Dynamics */}
      {isRunning && (trackStats.avgStride || trackStats.avgVO || trackStats.avgGCT) && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Running Dynamics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {trackStats.avgStride && (
              <StatCard icon={<Activity size={18} className="text-teal-400" />} label="Avg Stride" value={`${(trackStats.avgStride / 100).toFixed(2)} m`} />
            )}
            {trackStats.avgVO && (
              <StatCard icon={<Activity size={18} className="text-cyan-400" />} label="Vertical Osc." value={`${trackStats.avgVO.toFixed(1)} cm`} />
            )}
            {trackStats.avgGCT && (
              <StatCard icon={<Activity size={18} className="text-sky-400" />} label="Ground Contact" value={`${Math.round(trackStats.avgGCT)} ms`} />
            )}
          </div>
        </div>
      )}

      {/* Heart Rate chart */}
      {workout.track_points?.filter(p => p.hr != null).length >= 10 && (
        <HeartRateChart
          trackPoints={workout.track_points}
          maxHr={workout.max_heart_rate}
          hoverDist={chartHoverDist}
          onHoverChange={setChartHoverDist}
        />
      )}

      {/* Elevation chart */}
      {workout.track_points?.filter(p => p.ele != null).length >= 10 && (
        <ElevationChart
          trackPoints={workout.track_points}
          hoverDist={chartHoverDist}
          onHoverChange={setChartHoverDist}
        />
      )}

      {/* Pace chart — needs GPS + either time-delta or speed field; chart returns null if data insufficient */}
      {workout.has_track && (
        <PaceChart
          trackPoints={workout.track_points}
          hoverDist={chartHoverDist}
          onHoverChange={setChartHoverDist}
        />
      )}

      {/* Walk / run chart — only rendered when walking segments are detected */}
      {workout.has_track && (
        <WalkRunChart
          trackPoints={workout.track_points}
          hoverDist={chartHoverDist}
          onHoverChange={setChartHoverDist}
        />
      )}

      {/* Power */}
      {hasPow && <PowerChart trackPoints={track} hoverDist={chartHoverDist} onHoverChange={setChartHoverDist} />}
      {hasCad && <CadenceChart trackPoints={track} sport={workout.sport} hoverDist={chartHoverDist} onHoverChange={setChartHoverDist} />}
      {hasVO  && <VerticalOscillationChart trackPoints={track} hoverDist={chartHoverDist} onHoverChange={setChartHoverDist} />}
      {hasGCT && <GroundContactChart trackPoints={track} hoverDist={chartHoverDist} onHoverChange={setChartHoverDist} />}

      {/* HR Zones */}
      {hasHrZones && (
        <div className="card p-4">
          <HrZoneChart zoneTimes={workout.icu_hr_zone_times} />
        </div>
      )}

      {/* Power Zones */}
      {hasPwrZones && (
        <div className="card p-4">
          <PowerZoneChart zoneTimes={workout.icu_zone_times} />
        </div>
      )}

      {/* GPS Trimmer modal */}
      {trimmerOpen && workout.track_points?.length > 1 && (
        <WorkoutTrimmer
          trackPoints={workout.track_points}
          onSave={handleTrim}
          onCancel={() => setTrimmerOpen(false)}
          saving={trimSaving}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1 text-gray-400 dark:text-gray-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-base font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  )
}
