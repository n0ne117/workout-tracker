import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown, Trophy, Loader2, Activity, MapPin } from 'lucide-react'
import {
  formatDuration, formatDistance, formatWorkoutRate, formatTime, movingSeconds,
} from '../utils/format'
import clsx from 'clsx'
import SportIcon from './SportIcon'

// Stable empty set so an unselected table doesn't allocate one per render.
const EMPTY_SELECTION = new Set()

const STORAGE_KEY = 'workout_table_collapsed'
const STORAGE_VERSION = 2 // bump to clear stale state from old logic
const VERSION_KEY = 'workout_table_collapsed_v'

export function loadCollapsed() {
  try {
    if (localStorage.getItem(VERSION_KEY) !== String(STORAGE_VERSION)) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION))
      return {}
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch { return {} }
}
export function saveCollapsed(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// Default open: all months of the current year, plus last 3 calendar months
// even if they spill into the previous year.
function buildDefaultOpen() {
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() // 0-based

  const openYears = new Set([String(curYear)])
  const openMonths = new Set()

  for (let m = 0; m <= curMonth; m++) {
    openMonths.add(`m-${curYear}-${m}`)
  }

  for (let i = 0; i < 3; i++) {
    let m = curMonth - i
    let y = curYear
    if (m < 0) { m += 12; y -= 1 }
    openMonths.add(`m-${y}-${m}`)
    openYears.add(String(y))
  }

  return { openYears, openMonths }
}

const { openYears, openMonths } = buildDefaultOpen()

export function defaultCollapsed(key) {
  if (key.startsWith('y-')) return !openYears.has(key.slice(2))
  return !openMonths.has(key)
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export function groupWorkouts(items) {
  const map = new Map()
  for (const w of items) {
    const d = new Date(w.started_at)
    if (isNaN(d.getTime())) continue // skip workouts with invalid dates
    const year = d.getFullYear()
    const month = d.getMonth() // 0-based
    const yKey = String(year)
    const mKey = `${year}-${month}`
    if (!map.has(yKey)) map.set(yKey, { year, months: new Map() })
    const yEntry = map.get(yKey)
    if (!yEntry.months.has(mKey)) yEntry.months.set(mKey, { month, year, workouts: [] })
    yEntry.months.get(mKey).workouts.push(w)
  }
  const years = [...map.values()].sort((a, b) => b.year - a.year)
  for (const y of years) {
    y.monthsArr = [...y.months.values()].sort((a, b) => b.month - a.month)
  }
  return years
}

// ── Shared layout model ──────────────────────────────────────────────────────
// Flattening the tree once means the collapse rules, totals and ordering exist
// in exactly one place, and the two presentations below stay honest: a table
// on wide screens, cards on phones, never disagreeing about what's in a group.

function totals(workouts) {
  return {
    count: workouts.length,
    distance: workouts.reduce((s, w) => s + (w.distance_meters || 0), 0),
    // Moving time, matching the summary tiles and the backend's /stats.
    time: workouts.reduce((s, w) => s + (movingSeconds(w) || 0), 0),
  }
}

function summaryText({ count, distance, time }) {
  return [
    `${count} workout${count !== 1 ? 's' : ''}`,
    distance > 0 ? `${(distance / 1000).toFixed(0)} km` : null,
    time > 0 ? `${Math.round(time / 3600)}h` : null,
  ].filter(Boolean).join(' · ')
}

function flattenGroups(grouped, collapsed, searching) {
  const isOpen = key => searching || !(collapsed[key] ?? defaultCollapsed(key))
  const rows = []

  for (const yEntry of grouped) {
    const yKey = `y-${yEntry.year}`
    const yWorkouts = yEntry.monthsArr.flatMap(m => m.workouts)
    rows.push({
      kind: 'year', key: yKey, label: String(yEntry.year),
      open: isOpen(yKey), summary: summaryText(totals(yWorkouts)),
    })
    if (!isOpen(yKey)) continue

    for (const mEntry of yEntry.monthsArr) {
      const mKey = `m-${yEntry.year}-${mEntry.month}`
      rows.push({
        kind: 'month', key: mKey, label: MONTH_NAMES[mEntry.month],
        open: isOpen(mKey), summary: summaryText(totals(mEntry.workouts)),
      })
      if (!isOpen(mKey)) continue

      for (const w of mEntry.workouts) {
        rows.push({ kind: 'workout', key: `w-${w.id}`, workout: w })
      }
    }
  }
  return rows
}

/** Rate, or elevation as a fallback for sports that have no meaningful rate. */
function rateOrElevation(workout, opts) {
  return (
    formatWorkoutRate(workout, opts) ??
    (workout.elevation_gain_meters != null
      ? `+${Math.round(workout.elevation_gain_meters)} m`
      : '—')
  )
}

/**
 * Marks a workout that carries a GPS track.
 *
 * Not decoration: plenty of real activities have none — every indoor session,
 * most pool swims, and anything logged without a watch. It is also the tell
 * that separates a duplicate import from the original, since the re-imported
 * copy usually arrives without its track.
 */
function GpsBadge({ className = '' }) {
  return (
    <MapPin
      size={11}
      aria-label="Has GPS track"
      className={'text-emerald-500 flex-shrink-0 ' + className}
    />
  )
}

/**
 * Selection checkbox. Stops the click reaching the row link or the group
 * toggle underneath it.
 */
function SelectBox({ checked, indeterminate = false, onChange, label }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={el => { if (el) el.indeterminate = indeterminate && !checked }}
      onClick={e => e.stopPropagation()}
      onChange={e => { e.stopPropagation(); onChange(e) }}
      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600
                 focus:ring-brand-500 cursor-pointer accent-brand-600"
    />
  )
}

// ── Wide-screen presentation: dense table ────────────────────────────────────

function TableView({ rows, onToggle, linkState, selection }) {
  const { active, isSelected, toggleOne, visibleIds, allVisibleSelected, someVisibleSelected, selectAllVisible } = selection
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700">
          {active && (
            <th className="py-2 pl-3 pr-1 w-9">
              <SelectBox
                label="Select all shown"
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                onChange={() => selectAllVisible(!allVisibleSelected)}
              />
            </th>
          )}
          <th className="py-2 px-3 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide w-20">Date</th>
          <th className="py-2 px-2 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide w-14">Time</th>
          <th className="py-2 px-2 w-10"></th>
          <th className="py-2 px-2 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Activity</th>
          <th className="py-2 px-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Moving</th>
          <th className="py-2 px-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Dist</th>
          <th className="py-2 px-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Pace/Spd</th>
          <th className="py-2 px-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">HR</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          if (row.kind !== 'workout') {
            const isYear = row.kind === 'year'
            const Chevron = row.open ? ChevronDown : ChevronRight
            return (
              <tr
                key={row.key}
                onClick={() => onToggle(row.key)}
                className={clsx(
                  'cursor-pointer select-none transition-colors',
                  isYear
                    ? 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800',
                )}
              >
                <td colSpan={active ? 9 : 8} className={isYear ? 'py-2 px-3' : 'py-1.5 px-3'}>
                  <div className="flex items-center gap-2">
                    <Chevron size={isYear ? 14 : 13} className="text-gray-500 dark:text-gray-400" />
                    <span className={isYear
                      ? 'text-sm font-bold text-gray-800 dark:text-gray-100'
                      : 'text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide'}>
                      {row.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500 ml-1">{row.summary}</span>
                  </div>
                </td>
              </tr>
            )
          }

          const w = row.workout
          const d = new Date(w.started_at)
          return (
            <tr key={row.key} className={clsx(
              'group border-t border-gray-100 dark:border-gray-800/60 transition-colors',
              isSelected(w.id)
                ? 'bg-brand-50 dark:bg-brand-900/20'
                : 'hover:bg-brand-50/40 dark:hover:bg-brand-900/10',
            )}>
              {active && (
                <td className="py-2 pl-3 pr-1 w-9">
                  <SelectBox
                    label={`Select ${w.title}`}
                    checked={isSelected(w.id)}
                    onChange={e => toggleOne(w.id, e.nativeEvent.shiftKey)}
                  />
                </td>
              )}
              <td className="py-2 px-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap w-20">
                {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
              </td>
              <td className="py-2 px-2 text-xs tabular-nums text-gray-400 dark:text-gray-500 whitespace-nowrap w-14">
                {formatTime(w.started_at)}
              </td>
              <td className="py-2 px-2 w-10">
                <SportIcon sport={w.sport} size={15} />
              </td>
              <td className="py-2 px-2 max-w-xs">
                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/workouts/${w.id}`}
                    state={linkState}
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 truncate transition-colors"
                  >
                    {w.title}
                  </Link>
                  {w.is_race && <Trophy size={11} className="text-yellow-500 flex-shrink-0" />}
                  {w.has_track && <GpsBadge />}
                </div>
              </td>
              <td className="py-2 px-3 text-xs text-right tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {formatDuration(movingSeconds(w))}
              </td>
              <td className="py-2 px-3 text-xs text-right tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {formatDistance(w.distance_meters)}
              </td>
              <td className="py-2 px-3 text-xs text-right tabular-nums text-gray-500 dark:text-gray-500 whitespace-nowrap">
                {rateOrElevation(w)}
              </td>
              <td className="py-2 px-3 text-xs text-right tabular-nums text-gray-500 dark:text-gray-500 whitespace-nowrap">
                {w.avg_heart_rate ? `${w.avg_heart_rate} bpm` : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Phone presentation: tappable cards, same groups ──────────────────────────

function CardView({ rows, onToggle, linkState, selection }) {
  const { active, isSelected, toggleOne } = selection
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {rows.map(row => {
        if (row.kind !== 'workout') {
          const isYear = row.kind === 'year'
          const Chevron = row.open ? ChevronDown : ChevronRight
          return (
            <button
              key={row.key}
              onClick={() => onToggle(row.key)}
              className={clsx(
                'w-full flex items-center gap-2 px-4 text-left active:bg-gray-100 dark:active:bg-gray-800 transition-colors',
                isYear ? 'py-2.5 bg-gray-100 dark:bg-gray-800' : 'py-2 bg-gray-50 dark:bg-gray-800/50',
              )}
            >
              <Chevron size={isYear ? 15 : 14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <span className={isYear
                ? 'text-sm font-bold text-gray-800 dark:text-gray-100'
                : 'text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide'}>
                {row.label}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-500 ml-auto tabular-nums">{row.summary}</span>
            </button>
          )
        }

        const w = row.workout
        const meta = [
          formatDistance(w.distance_meters, { compact: true }),
          formatDuration(movingSeconds(w), { compact: true }),
          formatWorkoutRate(w, { compact: true }),
        ].filter(v => v && v !== '—')

        // In selection mode the card toggles instead of navigating, so it
        // must not be an anchor — tapping to select should not open the page.
        const RowTag = active ? 'div' : Link
        const rowProps = active
          ? { onClick: () => toggleOne(w.id, false) }
          : { to: `/workouts/${w.id}`, state: linkState }

        return (
          <RowTag
            key={row.key}
            {...rowProps}
            className={clsx(
              'flex items-center gap-3 px-4 py-3 transition-colors',
              isSelected(w.id)
                ? 'bg-brand-50 dark:bg-brand-900/20'
                : 'active:bg-gray-50 dark:active:bg-gray-800',
            )}
          >
            {active && (
              <SelectBox
                label={`Select ${w.title}`}
                checked={isSelected(w.id)}
                onChange={() => toggleOne(w.id, false)}
              />
            )}
            <SportIcon sport={w.sport} size={17} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">
                  {w.title}
                </span>
                {w.is_race && <Trophy size={12} className="text-yellow-500 flex-shrink-0" />}
                {w.has_track && <GpsBadge />}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {meta.join(' · ')}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                {new Date(w.started_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">
                {formatTime(w.started_at)}
              </div>
            </div>
          </RowTag>
        )
      })}
    </div>
  )
}

// Accepts optional controlled props (collapsed + onToggle) from a parent that
// wants to own the state (Dashboard). Falls back to internal state when not
// provided (Races page, etc.).
export default function WorkoutTable({
  workouts, loading, hasMore, loadingMore, onLoadMore, search = '', linkState,
  collapsed: collapsedProp,
  onToggle: onToggleProp,
  selectMode = false,
  selected,
  onSelectionChange,
}) {
  const [localCollapsed, setLocalCollapsed] = useState(loadCollapsed)

  const isControlled = collapsedProp !== undefined
  const collapsed = isControlled ? collapsedProp : localCollapsed

  function toggle(key) {
    if (isControlled) {
      onToggleProp?.(key)
    } else {
      setLocalCollapsed(prev => {
        const next = { ...prev, [key]: !prev[key] }
        saveCollapsed(next)
        return next
      })
    }
  }

  const searching = search.trim().length > 0
  const rows = useMemo(
    () => flattenGroups(groupWorkouts(workouts), collapsed, searching),
    [workouts, collapsed, searching],
  )

  // Only rows currently on screen count as "visible" — a collapsed month must
  // not be swept up by select-all.
  const visibleIds = useMemo(
    () => rows.filter(r => r.kind === 'workout').map(r => r.workout.id),
    [rows],
  )
  const lastClicked = useRef(null)

  const chosen = selected ?? EMPTY_SELECTION
  const selectedVisible = visibleIds.filter(id => chosen.has(id)).length

  const selection = {
    active: selectMode,
    isSelected: id => chosen.has(id),
    visibleIds,
    allVisibleSelected: visibleIds.length > 0 && selectedVisible === visibleIds.length,
    someVisibleSelected: selectedVisible > 0,
    selectAllVisible: wantAll => {
      const next = new Set(chosen)
      visibleIds.forEach(id => (wantAll ? next.add(id) : next.delete(id)))
      onSelectionChange?.(next)
    },
    toggleOne: (id, extend) => {
      const next = new Set(chosen)
      // Shift-click fills the range from the previous click, which is what
      // makes working through a long run of duplicates bearable.
      if (extend && lastClicked.current != null) {
        const from = visibleIds.indexOf(lastClicked.current)
        const to = visibleIds.indexOf(id)
        if (from !== -1 && to !== -1) {
          const [lo, hi] = from < to ? [from, to] : [to, from]
          const turningOn = !chosen.has(id)
          visibleIds.slice(lo, hi + 1).forEach(x => (turningOn ? next.add(x) : next.delete(x)))
          lastClicked.current = id
          onSelectionChange?.(next)
          return
        }
      }
      next.has(id) ? next.delete(id) : next.add(id)
      lastClicked.current = id
      onSelectionChange?.(next)
    },
  }

  if (loading) return null

  if (!workouts.length) {
    return (
      <div className="card p-12 text-center text-gray-400 dark:text-gray-600">
        <Activity size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No workouts found</p>
        <p className="text-sm mt-1">Import a .fit, .gpx or .tcx file to get started</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="hidden md:block">
        <TableView rows={rows} onToggle={toggle} linkState={linkState} selection={selection} />
      </div>
      <div className="md:hidden">
        <CardView rows={rows} onToggle={toggle} linkState={linkState} selection={selection} />
      </div>

      {hasMore && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-3 flex justify-center">
          <button onClick={onLoadMore} disabled={loadingMore} className="btn-secondary text-sm">
            {loadingMore ? <Loader2 size={15} className="animate-spin" /> : null}
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
