import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  RefreshCw, ChevronRight, ChevronLeft,
  MapPin, Heart, TrendingUp, Flame,
} from 'lucide-react'
import { api } from '../hooks/useApi'
import {
  getSportIcon, sportSolidBg, fmtDuration, fmtDistance, fmtPace, fmtSpeed,
  PACE_SPORTS, fmtTime, weekStart, isoDate,
} from './utils'
import { formatSport } from '../utils/format'

// ── Sport circle ───────────────────────────────────────────────────────────────
function SportCircle({ sport, size = 20, className = '' }) {
  const Icon = getSportIcon(sport)
  const bg   = sportSolidBg(sport)
  return (
    <div className={`rounded-full ${bg} flex items-center justify-center ${className}`}>
      <Icon size={size} className="text-white" />
    </div>
  )
}

// ── Week helpers ───────────────────────────────────────────────────────────────
function weekMonday(offset) {
  const mon = weekStart()
  mon.setDate(mon.getDate() + offset * 7)
  return mon
}

function weekBounds(offset) {
  const from = weekMonday(offset)
  const to   = new Date(from)
  to.setDate(from.getDate() + 6)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

function weekLabel(offset) {
  const { from, to } = weekBounds(offset)
  const sameYear = from.getFullYear() === new Date().getFullYear()
  const opts = { day: 'numeric', month: 'short' }
  const a = from.toLocaleDateString(undefined, opts)
  const b = to.toLocaleDateString(undefined, sameYear ? opts : { ...opts, year: 'numeric' })
  return `${a} – ${b}`
}

function dayGroupLabel(dateStr) {
  const d    = new Date(dateStr)
  const today = new Date()
  if (isoDate(d) === isoDate(today)) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isoDate(d) === isoDate(yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}

// ── Week panel (one slide in the track) ───────────────────────────────────────
function WeekPanel({ offset, allWorkouts }) {
  const { from, to } = weekBounds(offset)
  const today        = new Date()

  const days = Array.from({ length: 7 }, (_, i) => {
    const d  = new Date(from)
    d.setDate(from.getDate() + i)
    const ds = isoDate(d)
    const hits = allWorkouts.filter(w => w.started_at?.startsWith(ds))
    return { letter: 'MTWTFSS'[i], ds, hits, isToday: ds === isoDate(today), isFuture: d > today }
  })

  const weekWorkouts = allWorkouts.filter(w => {
    const d = new Date(w.started_at); return d >= from && d <= to
  })
  const weekDist  = weekWorkouts.reduce((s, w) => s + (w.distance_meters  || 0), 0)
  const weekTime  = weekWorkouts.reduce((s, w) => s + (w.duration_seconds || 0), 0)
  const weekCount = weekWorkouts.length

  return (
    // Each panel occupies exactly 1/3 of the 300%-wide track = 100% of the visible window
    <div className="flex-shrink-0" style={{ width: '33.3333%' }}>
      {/* Day dots */}
      <div className="flex justify-around px-3 pb-2">
        {days.map((day, i) => {
          const sport = day.hits[0]?.sport
          const bg    = sport ? sportSolidBg(sport) : null
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className={`text-[11px] font-semibold tracking-wide ${
                day.isToday  ? 'text-brand-600 dark:text-brand-400' :
                day.isFuture ? 'text-gray-200 dark:text-gray-700' :
                               'text-gray-400 dark:text-gray-500'
              }`}>
                {day.letter}
              </span>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                day.hits.length
                  ? bg
                  : day.isToday
                  ? 'ring-2 ring-brand-400 dark:ring-brand-600 bg-transparent'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                {day.hits.length > 0 && <SportCircle sport={sport} size={13} />}
              </div>
              {day.hits.length > 1 && (
                <span className="text-[9px] text-gray-400 font-medium">×{day.hits.length}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Totals */}
      <div className="flex items-center justify-around px-4 py-2.5
                      border-t border-gray-50 dark:border-gray-800">
        {weekDist > 0 && (
          <div className="text-center">
            <div className="text-sm font-bold text-gray-900 dark:text-white">{fmtDistance(weekDist)}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Distance</div>
          </div>
        )}
        {weekTime > 0 && (
          <div className="text-center">
            <div className="text-sm font-bold text-gray-900 dark:text-white">{fmtDuration(weekTime)}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Time</div>
          </div>
        )}
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900 dark:text-white">{weekCount}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">
            {weekCount === 1 ? 'Workout' : 'Workouts'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Week strip ─────────────────────────────────────────────────────────────────
function WeekStrip({ allWorkouts, weekOffset, onNavigate }) {
  const trackRef    = useRef(null)
  const clipRef     = useRef(null)
  const touchX      = useRef(null)
  const animatingRef = useRef(false)

  const canGoNewer = weekOffset < 0

  // Streak — computed from all loaded workouts
  const allDays = new Set(allWorkouts.map(w => w.started_at?.split('T')[0]))
  let streak = 0
  const cur = new Date()
  if (!allDays.has(isoDate(cur))) cur.setDate(cur.getDate() - 1)
  while (allDays.has(isoDate(cur))) { streak++; cur.setDate(cur.getDate() - 1) }

  // After weekOffset changes: snap the track back to the centre panel instantly
  useEffect(() => {
    const t = trackRef.current
    if (!t) return
    t.style.transition = 'none'
    t.style.transform  = 'translateX(-33.3333%)'
  }, [weekOffset])

  function commit(direction) {
    // direction: -1 = go older (slide right to left panel), +1 = go newer (slide left to right panel)
    if (animatingRef.current) return
    animatingRef.current = true
    const t = trackRef.current
    if (t) {
      t.style.transition = 'transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      t.style.transform  = direction === -1 ? 'translateX(0%)' : 'translateX(-66.6667%)'
    }
    setTimeout(() => {
      animatingRef.current = false
      onNavigate(weekOffset + direction)
    }, 280)
  }

  function onTouchStart(e) {
    if (animatingRef.current) return
    touchX.current = e.touches[0].clientX
  }

  function onTouchMove(e) {
    if (touchX.current === null || animatingRef.current) return
    const dx = e.touches[0].clientX - touchX.current
    // Clamp: don't let the track slide left when already at the newest week
    const clamped = (!canGoNewer && dx < 0) ? 0 : dx
    const t = trackRef.current
    if (t) {
      t.style.transition = 'none'
      t.style.transform  = `translateX(calc(-33.3333% + ${clamped}px))`
    }
  }

  function onTouchEnd(e) {
    if (touchX.current === null || animatingRef.current) return
    const dx       = e.changedTouches[0].clientX - touchX.current
    const width    = clipRef.current?.offsetWidth ?? 300
    const threshold = width * 0.28
    touchX.current = null

    if (dx > threshold) {
      commit(-1)                        // swiped right → older week
    } else if (dx < -threshold && canGoNewer) {
      commit(+1)                        // swiped left  → newer week
    } else {
      // Not far enough — snap back
      const t = trackRef.current
      if (t) {
        t.style.transition = 'transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        t.style.transform  = 'translateX(-33.3333%)'
      }
    }
  }

  return (
    <div className="mx-4 mb-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm select-none">
      {/* Static nav row — stays put while the content beneath slides */}
      <div className="flex items-center justify-between px-2 pt-3 pb-2">
        <button
          onClick={() => commit(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-full
                     text-gray-400 active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
        >
          <ChevronLeft size={17} />
        </button>

        <div className="text-center">
          {weekOffset === 0 && (
            <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider mb-0.5">
              This week
            </p>
          )}
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {weekLabel(weekOffset)}
          </p>
        </div>

        <button
          onClick={() => canGoNewer && commit(+1)}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors
            ${canGoNewer
              ? 'text-gray-400 active:bg-gray-100 dark:active:bg-gray-800'
              : 'text-gray-200 dark:text-gray-700 pointer-events-none'
            }`}
        >
          <ChevronRight size={17} />
        </button>
      </div>

      {/* Sliding viewport — overflow:hidden clips the off-screen panels */}
      <div ref={clipRef} className="overflow-hidden">
        {/* Track: 3× wide, starts centred on the middle panel */}
        <div
          ref={trackRef}
          className="flex"
          style={{ width: '300%', transform: 'translateX(-33.3333%)', willChange: 'transform' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <WeekPanel offset={weekOffset - 1} allWorkouts={allWorkouts} />
          <WeekPanel offset={weekOffset}     allWorkouts={allWorkouts} />
          <WeekPanel offset={weekOffset + 1} allWorkouts={allWorkouts} />
        </div>
      </div>

      {/* Streak badge — outside the sliding track, always from current week context */}
      {weekOffset === 0 && streak >= 2 && (
        <div className="flex justify-center pb-2.5 pt-1">
          <div className="flex items-center gap-1 text-xs font-bold text-orange-500">
            <Flame size={13} />
            {streak}-day streak
          </div>
        </div>
      )}

    </div>
  )
}

// ── Workout card ───────────────────────────────────────────────────────────────
function WorkoutCard({ workout }) {
  const dist      = fmtDistance(workout.distance_meters)
  const dur       = fmtDuration(workout.duration_seconds)
  const secondary = PACE_SPORTS.has(workout.sport)
    ? fmtPace(workout.distance_meters, workout.duration_seconds)
    : fmtSpeed(workout.avg_speed_ms)
  const metaItems = [dist, dur, secondary].filter(Boolean)

  return (
    <Link
      to={`/workouts/${workout.id}`}
      className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-900
                 active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
    >
      <SportCircle sport={workout.sport} size={20} className="w-11 h-11 shadow-sm flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-[15px] text-gray-900 dark:text-white truncate">
            {workout.title || formatSport(workout.sport)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
            {fmtTime(workout.started_at)}
          </span>
        </div>
        {metaItems.length > 0 && (
          <div className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {metaItems.join(' · ')}
          </div>
        )}
        {(workout.avg_heart_rate || workout.elevation_gain_meters) && (
          <div className="flex items-center gap-2.5 mt-1">
            {workout.avg_heart_rate && (
              <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                <Heart size={10} className="text-red-400" />
                {workout.avg_heart_rate}
              </span>
            )}
            {workout.elevation_gain_meters > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                <TrendingUp size={10} className="text-green-400" />
                {Math.round(workout.elevation_gain_meters)} m
              </span>
            )}
            {workout.has_track && (
              <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                <MapPin size={10} className="text-brand-400" />
                GPS
              </span>
            )}
          </div>
        )}
      </div>

      <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
    </Link>
  )
}

// ── Feed page ──────────────────────────────────────────────────────────────────
const VIEWS       = ['All Workouts', 'Races']
const INIT_DAYS   = 90   // initial fetch window
const EXTEND_DAYS = 90   // how many days to add when swiping past the loaded range

export default function MobileFeed() {
  const [view, setView]               = useState('All Workouts')
  const [allWorkouts, setAllWorkouts] = useState([])
  const [races, setRaces]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [syncing, setSyncing]         = useState(false)
  const [weekOffset, setWeekOffset]   = useState(() => {
    const saved = sessionStorage.getItem('mobileWeekOffset')
    return saved ? parseInt(saved, 10) : 0
  })
  const [daysLoaded, setDaysLoaded]   = useState(INIT_DAYS)
  const pollRef    = useRef(null)
  const fetchingRef = useRef(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('mobileWeekOffset')
    const offset = saved ? parseInt(saved, 10) : 0
    if (offset < 0) {
      const targetMon = weekMonday(offset)
      const daysBack  = Math.ceil((new Date() - targetMon) / 86400000) + 1
      fetchLocal(Math.max(INIT_DAYS, daysBack + EXTEND_DAYS))
    } else {
      fetchLocal(INIT_DAYS)
    }
  }, [])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function fetchLocal(days) {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      const [allData, raceData] = await Promise.all([
        api.get(`/workouts?date_from=${isoDate(cutoff)}&page_size=500`),
        api.get(`/workouts?is_race=true&page_size=500`),
      ])
      const toList = d => (Array.isArray(d) ? d : (d.items ?? []))
        .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      setAllWorkouts(toList(allData))
      setRaces(toList(raceData))
      setDaysLoaded(days)
    } catch { /* silent */ }
    fetchingRef.current = false
    setLoading(false)
  }

  function navigate(newOffset) {
    // How many days back is the Monday of the target week?
    const targetMon = weekMonday(newOffset)
    const daysBack  = Math.ceil((new Date() - targetMon) / 86400000) + 1
    if (daysBack > daysLoaded - 7) {
      // Target week is outside our loaded range — extend
      fetchLocal(daysBack + EXTEND_DAYS)
    }
    sessionStorage.setItem('mobileWeekOffset', String(newOffset))
    setWeekOffset(newOffset)
  }

  async function syncAndRefresh() {
    if (syncing) return
    setSyncing(true)
    try {
      await api.post('/intervals/import', { api_key: '', athlete_id: '0', days_back: 30 })
    } catch { setSyncing(false); return }
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.get('/intervals/import/status')
        if (!s.running) {
          clearInterval(pollRef.current); pollRef.current = null
          setSyncing(false)
          fetchLocal(daysLoaded)
        }
      } catch {
        clearInterval(pollRef.current); pollRef.current = null
        setSyncing(false)
      }
    }, 2000)
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const isRaceView = view === 'Races'

  // Workouts visible in the selected week
  const { from: wFrom, to: wTo } = weekBounds(weekOffset)
  const weekWorkouts = allWorkouts.filter(w => {
    const d = new Date(w.started_at)
    return d >= wFrom && d <= wTo
  })

  // Group by day label
  function groupByDay(list) {
    const groups = []
    const seen   = new Map()
    for (const w of list) {
      const label = isRaceView
        ? String(new Date(w.started_at).getFullYear())
        : dayGroupLabel(w.started_at)
      if (!seen.has(label)) { seen.set(label, []); groups.push({ label, items: seen.get(label) }) }
      seen.get(label).push(w)
    }
    return groups
  }

  const groups = groupByDay(isRaceView ? races : weekWorkouts)

  return (
    <div className="pb-4">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm
                   border-b border-gray-100 dark:border-gray-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="flex items-center justify-between px-4 pb-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Workouts</h1>
          <button
            onClick={syncAndRefresh}
            disabled={syncing}
            className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center
                       shadow-sm active:scale-90 transition-transform disabled:opacity-50"
          >
            <RefreshCw size={16} className={`text-gray-500 dark:text-gray-400 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Sub-menu pills */}
        <div className="flex px-4 pb-3 gap-1">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                view === v
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 active:bg-gray-200 dark:active:bg-gray-700'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4">
        {/* Week strip — All Workouts only */}
        {!isRaceView && (
          <WeekStrip
            allWorkouts={allWorkouts}
            weekOffset={weekOffset}
            onNavigate={navigate}
          />
        )}

        {/* Loading skeleton */}
        {loading && (isRaceView ? races : weekWorkouts).length === 0 ? (
          <div className="space-y-2 px-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white dark:bg-gray-900 animate-pulse" />
            ))}
          </div>

        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-600">
            <p className="text-3xl mb-3">{isRaceView ? '🏅' : '😴'}</p>
            <p className="font-medium">{isRaceView ? 'No races recorded' : 'Rest week'}</p>
            <p className="text-sm mt-1">
              {isRaceView
                ? 'Workouts marked as races will appear here'
                : 'Swipe right to go back in time'}
            </p>
          </div>

        ) : (
          <div className="space-y-4">
            {groups.map(({ label, items }) => (
              <div key={label}>
                <div className="px-5 mb-1">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {label}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl mx-4 overflow-hidden shadow-sm
                                divide-y divide-gray-50 dark:divide-gray-800">
                  {items.map(w => <WorkoutCard key={w.id} workout={w} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
