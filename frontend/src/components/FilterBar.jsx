import { useState, useEffect } from 'react'
import { Search, X, Trophy, Filter } from 'lucide-react'
import { formatSport } from '../utils/format'
import SportIcon from './SportIcon'
import { api } from '../hooks/useApi'
import clsx from 'clsx'

export default function FilterBar({ filters, onChange, collapseControl }) {
  const [categories, setCategories] = useState([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    api.get('/workouts/categories').then(d => setCategories(d.categories)).catch(() => {})
  }, [])

  function set(key, value) {
    onChange({ ...filters, [key]: value, page: 1 })
  }

  function clear() {
    onChange({ page: 1, pageSize: filters.pageSize })
  }

  const hasFilters = filters.sport || filters.isRace || filters.search || filters.dateFrom || filters.dateTo

  return (
    <div className="space-y-3">
      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search workouts…"
            value={filters.search || ''}
            onChange={e => set('search', e.target.value || undefined)}
            className="input pl-9"
          />
        </div>
        {collapseControl}
        <button
          onClick={() => setShowFilters(s => !s)}
          className={clsx(
            'btn gap-1.5',
            showFilters || hasFilters
              ? 'btn-primary'
              : 'btn-secondary'
          )}
        >
          <Filter size={15} />
          <span className="hidden sm:inline">Filters</span>
          {hasFilters && (
            <span className="bg-white/30 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {[filters.sport, filters.isRace, filters.search, filters.dateFrom].filter(Boolean).length}
            </span>
          )}
        </button>
        {hasFilters && (
          <button onClick={clear} className="btn-ghost px-2" title="Clear filters">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="card p-4 space-y-4">
          {/* Sport */}
          <div>
            <label className="label">Activity Type</label>
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                onClick={() => set('sport', undefined)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  !filters.sport
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => set('sport', filters.sport === cat ? undefined : cat)}
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    filters.sport === cat
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                >
                  <SportIcon sport={cat} size={13} variant="plain" className="inline-block mr-1.5 align-[-2px]" />{formatSport(cat)}
                </button>
              ))}
            </div>
          </div>

          {/* Race filter */}
          <div className="flex items-center gap-3">
            <label className="label mb-0">Races only</label>
            <button
              onClick={() => set('isRace', filters.isRace ? undefined : true)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                filters.isRace
                  ? 'bg-yellow-400 text-yellow-900'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              )}
            >
              <Trophy size={12} />
              Races
            </button>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={e => set('dateFrom', e.target.value || undefined)}
                className="input"
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={e => set('dateTo', e.target.value || undefined)}
                className="input"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
