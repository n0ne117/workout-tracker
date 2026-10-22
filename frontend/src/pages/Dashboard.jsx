import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import WorkoutTable, { loadCollapsed, saveCollapsed, groupWorkouts, defaultCollapsed } from '../components/WorkoutTable'
import FilterBar from '../components/FilterBar'
import { api, buildWorkoutQuery } from '../hooks/useApi'
import { WORKOUTS_CHANGED } from '../hooks/useIntervalsSync'
import { isoDate } from '../utils/format'
import { Loader2, ListChecks } from 'lucide-react'
import BulkActionBar from '../components/BulkActionBar'
import clsx from 'clsx'

const PAGE_SIZE = 500

function currentMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const dateFrom = isoDate(new Date(year, month, 1))
  const dateTo = isoDate(new Date(year, month + 1, 0))
  return { dateFrom, dateTo }
}

export default function Dashboard() {
  const [filters, setFilters] = useState({ page: 1, pageSize: PAGE_SIZE, ...currentMonthRange() })
  const [workouts, setWorkouts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  // Bumped by every full reload. A response that comes back after a newer
  // request started is for filters no longer on screen — typing "tempo"
  // fires one per keystroke, and the slow "te" must not land last.
  const requestSeq = useRef(0)

  // Full reload whenever filters change (page resets to 1)
  const load = useCallback(async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError(null)
    try {
      const q = buildWorkoutQuery({ ...filters, page: 1, pageSize: PAGE_SIZE })
      const res = await api.get(`/workouts?${q}`)
      if (seq !== requestSeq.current) return
      setWorkouts(res.items)
      setTotal(res.total)
    } catch (e) {
      if (seq !== requestSeq.current) return
      setError(typeof e.message === 'string' ? e.message : JSON.stringify(e.message))
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [filters])

  // Searches wait for a pause in typing; every other filter applies at once.
  useEffect(() => {
    const t = setTimeout(load, filters.search ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, filters.search])

  // A sync from the header that found new workouts: show them.
  useEffect(() => {
    window.addEventListener(WORKOUTS_CHANGED, load)
    return () => window.removeEventListener(WORKOUTS_CHANGED, load)
  }, [load])

  // Drop selections when the filters change: those ids are no longer on
  // screen, and acting on rows you cannot see is how bulk tools go wrong.
  useEffect(() => { setSelected(new Set()) }, [filters])

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function loadMore() {
    const seq = requestSeq.current
    setLoadingMore(true)
    try {
      const nextPage = Math.floor(workouts.length / PAGE_SIZE) + 1
      const q = buildWorkoutQuery({ ...filters, page: nextPage, pageSize: PAGE_SIZE })
      const res = await api.get(`/workouts?${q}`)
      // The filters changed while this page loaded, so it no longer fits.
      if (seq !== requestSeq.current) return
      setWorkouts(prev => [...prev, ...res.items])
      setTotal(res.total)
    } catch (e) {
      setError(typeof e.message === 'string' ? e.message : JSON.stringify(e.message))
    } finally {
      setLoadingMore(false)
    }
  }

  function handleFilterChange(f) {
    setFilters({ ...f, pageSize: PAGE_SIZE })
  }

  function toggle(key) {
    setCollapsed(prev => {
      // Flip what is actually on screen, not what happens to be stored.
      // Groups with no stored entry take their state from defaultCollapsed(),
      // so `!prev[key]` wrote "collapsed" onto something already displaying as
      // collapsed — the first click did nothing and expanding took two.
      const shown = prev[key] ?? defaultCollapsed(key)
      const next = { ...prev, [key]: !shown }
      saveCollapsed(next)
      return next
    })
  }

  const grouped = useMemo(() => groupWorkouts(workouts), [workouts])

  const searching = !!(filters.search && filters.search.trim())

  const allCollapsed = !searching && grouped.length > 0 && grouped.every(yEntry => {
    const yKey = `y-${yEntry.year}`
    return collapsed[yKey] ?? defaultCollapsed(yKey)
  })

  function collapseAll() {
    const next = {}
    for (const yEntry of grouped) {
      next[`y-${yEntry.year}`] = true
      for (const mEntry of yEntry.monthsArr) {
        next[`m-${yEntry.year}-${mEntry.month}`] = true
      }
    }
    setCollapsed(next)
    saveCollapsed(next)
  }

  function expandAll() {
    const next = {}
    for (const yEntry of grouped) {
      next[`y-${yEntry.year}`] = false
      for (const mEntry of yEntry.monthsArr) {
        next[`m-${yEntry.year}-${mEntry.month}`] = false
      }
    }
    setCollapsed(next)
    saveCollapsed(next)
  }

  const hasMore = workouts.length < total

  const collapseControl = !loading && workouts.length > 0 ? (
    <>
      {!searching && (
        <button
          onClick={allCollapsed ? expandAll : collapseAll}
          className="btn btn-secondary"
        >
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
      )}
      <button
        onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        className={clsx('btn gap-1.5', selectMode ? 'btn-primary' : 'btn-secondary')}
        title="Select workouts for bulk actions"
      >
        <ListChecks size={15} />
        <span className="hidden sm:inline">{selectMode ? 'Done' : 'Select'}</span>
      </button>
    </>
  ) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workouts</h1>
        {!loading && (
          <span className="text-sm text-gray-400">
            {workouts.length < total ? `${workouts.length} of ${total}` : `${total} total`}
          </span>
        )}
      </div>

      <FilterBar filters={filters} onChange={handleFilterChange} collapseControl={collapseControl} />

      {error && (
        <div className="card p-4 text-red-500 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-brand-500" />
        </div>
      ) : (
        <WorkoutTable
          workouts={workouts}
          loading={false}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          search={filters.search || ''}
          collapsed={collapsed}
          onToggle={toggle}
          selectMode={selectMode}
          selected={selected}
          onSelectionChange={setSelected}
        />
      )}

      {selectMode && (
        <BulkActionBar
          selected={selected}
          onClear={() => setSelected(new Set())}
          onChanged={() => { setSelected(new Set()); load() }}
        />
      )}
    </div>
  )
}
