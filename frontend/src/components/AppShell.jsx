import { Link, useLocation } from 'react-router-dom'
import {
  Activity, Trophy, BarChart2, Settings, Sun, Moon, RefreshCw, Bike, Flag,
  CalendarDays, FlaskConical, CheckCircle, AlertCircle, X, MoreHorizontal,
} from 'lucide-react'
import clsx from 'clsx'
import { useTheme } from '../hooks/useTheme'
import { useIntervalsSync } from '../hooks/useIntervalsSync'

/**
 * One shell for every screen size.
 *
 * Replaces the old Layout.jsx / MobileApp.jsx pair. Navigation is the only
 * thing that genuinely differs between a phone and a desktop, so that is the
 * only thing this branches on:
 *
 *   < md   bottom tab bar, four destinations, the rest behind "More"
 *   >= md  top header with every destination inline
 *
 * Everything below the shell is one set of pages that reflow with CSS.
 */

// `primary: true` earns a slot in the phone tab bar.
export const NAV_ITEMS = [
  { to: '/',              label: 'Workouts', short: 'Workouts', icon: Activity,     exact: true, primary: true },
  { to: '/stats',         label: 'Stats',    short: 'Stats',    icon: BarChart2,    primary: true },
  { to: '/races',         label: 'Races',    short: 'Races',    icon: Trophy,       primary: true },
  { to: '/gear',          label: 'Gear',     short: 'Gear',     icon: Bike },
  { to: '/conqueror',     label: 'Conqueror',short: 'Conqueror',icon: Flag },
  { to: '/race-calendar', label: 'Race Cal', short: 'Calendar', icon: CalendarDays },
  { to: '/runlab',        label: 'RunLab',   short: 'RunLab',   icon: FlaskConical },
  { to: '/settings',      label: 'Settings', short: 'Settings', icon: Settings },
]

const TAB_ITEMS = [
  ...NAV_ITEMS.filter(i => i.primary),
  { to: '/more', label: 'More', short: 'More', icon: MoreHorizontal },
]

function isActive(item, pathname) {
  return item.exact ? pathname === item.to : pathname.startsWith(item.to)
}

function PixelRunner() {
  // Same sprite as the favicon.
  const px = [
    [5,1],[6,1],[5,2],[6,2],
    [4,3],[5,3],[6,3],[7,3],
    [3,4],[4,4],[5,4],[6,4],[7,4],[8,4],
    [4,5],[5,5],[6,5],
    [5,6],[6,6],[7,6],
    [4,7],[5,7],[7,7],[8,7],
    [3,8],[4,8],[8,8],[9,8],
    [2,9],[3,9],[9,9],[10,9],
  ]
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" shapeRendering="crispEdges" className="text-brand-500">
      {px.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x * 2} y={y * 2} width={2} height={2} fill="currentColor" />
      ))}
    </svg>
  )
}

function SyncBanner({ sync }) {
  if (sync.state === 'idle') return null
  const { state, progress, pct, result } = sync

  return (
    <div
      role="status"
      className={clsx(
        'fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3',
        'px-4 py-3 rounded-xl shadow-lg text-sm font-medium border backdrop-blur-sm',
        'transition-all duration-300 w-[calc(100%-2rem)] max-w-sm',
        // Clear the phone tab bar; sit near the bottom edge on desktop.
        'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-5',
        state === 'running' && 'bg-white/90 dark:bg-gray-900/90 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300',
        state === 'done'    && 'bg-green-50/95 dark:bg-green-900/80 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
        state === 'error'   && 'bg-red-50/95 dark:bg-red-900/80 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
      )}
    >
      {state === 'running' && <RefreshCw size={16} className="animate-spin flex-shrink-0 text-brand-500" />}
      {state === 'done'    && <CheckCircle size={16} className="flex-shrink-0 text-green-500" />}
      {state === 'error'   && <AlertCircle size={16} className="flex-shrink-0 text-red-500" />}

      <div className="flex-1 min-w-0">
        {state === 'running' && (
          progress.total > 0
            ? <><span>Syncing… </span><span className="tabular-nums text-xs opacity-70">{progress.done} / {progress.total}</span></>
            : <span>Fetching activities…</span>
        )}
        {state === 'done' && result && (
          <span>
            Synced — <strong>{result.imported}</strong> new
            {result.skipped > 0 && <>, {result.skipped} already existed</>}
            {result.errors > 0  && <>, {result.errors} failed</>}
          </span>
        )}
        {state === 'error' && <span>{result?.error || 'Sync failed'}</span>}
      </div>

      {state === 'running' && pct !== null && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden bg-gray-200 dark:bg-gray-700">
          <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      {state !== 'running' && (
        <button onClick={sync.reset} aria-label="Dismiss" className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export default function AppShell({ children }) {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const sync = useIntervalsSync()

  // Workout detail owns the full screen on a phone: its own back button
  // replaces the tab bar so the map and charts get the height.
  const immersive = pathname.startsWith('/workouts/')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* ── Header: full nav on desktop, title strip on phones ─────────────── */}
      <header
        className={clsx(
          'sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md',
          'border-b border-gray-200 dark:border-gray-800',
          immersive && 'hidden md:block',
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white md:mr-3 flex-shrink-0">
            <PixelRunner />
            <span className="text-sm">Workout Tracker</span>
          </Link>

          {/* Desktop-only inline nav — phones use the tab bar below. */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isActive({ to, exact }, pathname)
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800',
                )}
              >
                <Icon size={15} />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 ml-auto md:ml-0">
            <button
              onClick={sync.start}
              disabled={sync.running}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Sync the last 30 days from Intervals.icu"
            >
              <RefreshCw size={14} className={sync.running ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button onClick={toggle} className="btn-ghost p-2" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <SyncBanner sync={sync} />

      <main
        className={clsx(
          'flex-1 w-full max-w-7xl mx-auto',
          immersive ? 'px-0 md:px-6 md:py-6' : 'px-4 sm:px-6 py-4 md:py-6',
        )}
        style={{
          // Keep content clear of the tab bar and the home indicator.
          paddingBottom: immersive
            ? 'env(safe-area-inset-bottom, 0px)'
            : 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {children}
      </main>

      {/* ── Phone tab bar ──────────────────────────────────────────────────── */}
      {!immersive && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900
                     border-t border-gray-100 dark:border-gray-800"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
        >
          <div className="flex">
            {TAB_ITEMS.map(({ to, short, icon: Icon, exact }) => {
              const active = isActive({ to, exact }, pathname)
              return (
                <Link
                  key={to}
                  to={to}
                  className={clsx(
                    'flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium transition-colors',
                    active
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300',
                  )}
                >
                  <Icon size={23} strokeWidth={active ? 2.5 : 1.75} className="transition-transform active:scale-90" />
                  {short}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
