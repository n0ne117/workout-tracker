import { Link, useLocation } from 'react-router-dom'
import { Activity, Trophy, BarChart2, Settings, Sun, Moon, RefreshCw, Bike, Flag, CalendarDays, FlaskConical, CheckCircle, AlertCircle, X } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useState, useRef, useEffect } from 'react'
import { api } from '../hooks/useApi'
import clsx from 'clsx'

export default function Layout({ children }) {
  const { theme, toggle } = useTheme()
  const location = useLocation()

  // ── Intervals sync state ──────────────────────────────────────────────────
  const [syncState, setSyncState]     = useState('idle') // idle | running | done | error
  const [syncProgress, setSyncProgress] = useState({ total: 0, done: 0 })
  const [syncResult, setSyncResult]   = useState(null)
  const pollRef  = useRef(null)
  const dismissRef = useRef(null)

  function clearBanner() {
    setSyncState('idle')
    setSyncResult(null)
    setSyncProgress({ total: 0, done: 0 })
  }

  function stopPolling() {
    if (pollRef.current)   { clearInterval(pollRef.current);  pollRef.current  = null }
    if (dismissRef.current){ clearTimeout(dismissRef.current); dismissRef.current = null }
  }

  async function triggerSync() {
    if (syncState === 'running') return
    stopPolling()
    setSyncState('running')
    setSyncResult(null)
    setSyncProgress({ total: 0, done: 0 })

    try {
      await api.post('/intervals/import', { api_key: '', athlete_id: '0', days_back: 30 })
    } catch (e) {
      setSyncState('error')
      setSyncResult({ error: e.message })
      dismissRef.current = setTimeout(clearBanner, 6000)
      return
    }

    pollRef.current = setInterval(async () => {
      try {
        const s = await api.get('/intervals/import/status')
        setSyncProgress({ total: s.total || 0, done: s.done || 0 })
        if (!s.running) {
          stopPolling()
          const r = s.last_result || {}
          setSyncResult(r)
          setSyncState(r.error ? 'error' : 'done')
          dismissRef.current = setTimeout(clearBanner, r.error ? 8000 : 5000)
        }
      } catch {
        stopPolling()
        setSyncState('error')
        setSyncResult({ error: 'Lost connection to server' })
        dismissRef.current = setTimeout(clearBanner, 6000)
      }
    }, 2000)
  }

  // cleanup on unmount
  useEffect(() => () => stopPolling(), [])

  const navItems = [
    { to: '/', label: 'Workouts', icon: Activity, exact: true },
    { to: '/races', label: 'Races', icon: Trophy },
    { to: '/stats', label: 'Stats', icon: BarChart2 },
    { to: '/gear', label: 'Gear', icon: Bike },
    { to: '/conqueror', label: 'Conqueror', icon: Flag },
    { to: '/race-calendar', label: 'Race Cal', icon: CalendarDays },
    { to: '/runlab',        label: 'RunLab',   icon: FlaskConical },
    { to: '/settings',      label: 'Settings', icon: Settings },
  ]

  function isActive(item) {
    if (item.exact) return location.pathname === item.to
    return location.pathname.startsWith(item.to)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-13 flex items-center gap-3">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white mr-3 flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 20 20" shapeRendering="crispEdges" className="text-brand-500">
              {/* pixel running figure favicon inline */}
              {[
                [5,1],[6,1],[5,2],[6,2],
                [4,3],[5,3],[6,3],[7,3],
                [3,4],[4,4],[5,4],[6,4],[7,4],[8,4],
                [4,5],[5,5],[6,5],
                [5,6],[6,6],[7,6],
                [4,7],[5,7],[7,7],[8,7],
                [3,8],[4,8],[8,8],[9,8],
                [2,9],[3,9],[9,9],[10,9],
              ].map(([x,y]) => (
                <rect key={`${x}-${y}`} x={x*2} y={y*2} width={2} height={2} fill="currentColor" />
              ))}
            </svg>
            <span className="hidden sm:inline text-sm">Workout Tracker</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-0.5 flex-1">
            {navItems.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isActive({ to, exact })
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                )}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={triggerSync}
              disabled={syncState === 'running'}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Sync last 30 days from Intervals.icu"
            >
              <RefreshCw size={14} className={syncState === 'running' ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button onClick={toggle} className="btn-ghost p-2" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      {/* Sync banner */}
      {syncState !== 'idle' && (
        <div className={clsx(
          'fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3',
          'px-4 py-3 rounded-xl shadow-lg text-sm font-medium border backdrop-blur-sm',
          'transition-all duration-300 min-w-64 max-w-sm w-full',
          syncState === 'running' && 'bg-white/90 dark:bg-gray-900/90 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300',
          syncState === 'done'    && 'bg-green-50/95 dark:bg-green-900/80 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
          syncState === 'error'   && 'bg-red-50/95 dark:bg-red-900/80 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
        )}>
          {/* icon */}
          {syncState === 'running' && <RefreshCw size={16} className="animate-spin flex-shrink-0 text-brand-500" />}
          {syncState === 'done'    && <CheckCircle size={16} className="flex-shrink-0 text-green-500" />}
          {syncState === 'error'   && <AlertCircle size={16} className="flex-shrink-0 text-red-500" />}

          {/* text */}
          <div className="flex-1 min-w-0">
            {syncState === 'running' && (
              syncProgress.total > 0
                ? <><span>Syncing… </span><span className="tabular-nums text-xs opacity-70">{syncProgress.done} / {syncProgress.total}</span></>
                : <span>Fetching activities…</span>
            )}
            {syncState === 'done' && syncResult && (
              <span>
                Synced — <strong>{syncResult.imported}</strong> new
                {syncResult.skipped > 0 && <>, {syncResult.skipped} already existed</>}
                {syncResult.errors > 0   && <>, {syncResult.errors} failed</>}
              </span>
            )}
            {syncState === 'error' && (
              <span>{syncResult?.error || 'Sync failed'}</span>
            )}
          </div>

          {/* progress bar for running */}
          {syncState === 'running' && syncProgress.total > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full bg-brand-500 transition-all duration-500"
                style={{ width: `${Math.round((syncProgress.done / syncProgress.total) * 100)}%` }}
              />
            </div>
          )}

          {/* dismiss */}
          {syncState !== 'running' && (
            <button onClick={clearBanner} className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
