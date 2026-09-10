import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { Activity, BarChart2, CalendarDays, MoreHorizontal, FlaskConical, Monitor } from 'lucide-react'
import clsx from 'clsx'
import MobileFeed from './MobileFeed'
import MobileStats from './MobileStats'
import MobileRaces from './MobileRaces'
import MobileMore from './MobileMore'
import MobileWorkoutDetail from './MobileWorkoutDetail'

function RunLabDesktopOnly() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
        <FlaskConical size={26} className="text-brand-500" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">RunLab</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          RunLab is optimised for larger screens.
          Open it on your desktop or tablet for the full experience.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-2">
        <Monitor size={14} />
        <span>Best on desktop</span>
      </div>
    </div>
  )
}

const TABS = [
  { path: '/',      label: 'Workouts', icon: Activity },
  { path: '/stats', label: 'Stats',    icon: BarChart2 },
  { path: '/races', label: 'Races',    icon: CalendarDays },
  { path: '/more',  label: 'More',     icon: MoreHorizontal },
]

export default function MobileApp() {
  const location = useLocation()
  const isDetail = location.pathname.startsWith('/workouts/')

  return (
    <div
      className="fixed top-0 left-0 right-0 overflow-hidden bg-gray-50 dark:bg-gray-950"
      style={{ height: 'var(--app-height, 100vh)' }}
    >
      {/* Scrollable page content — explicit height so it never bleeds behind the nav.
          Always pad the bottom by at least env(safe-area-inset-bottom) so content
          never disappears behind the home indicator, even in detail view. */}
      <div
        className="h-full overflow-y-auto overscroll-none"
        style={{
          paddingBottom: isDetail
            ? 'env(safe-area-inset-bottom, 0px)'
            : 'calc(56px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <Routes>
          <Route path="/"             element={<MobileFeed />} />
          <Route path="/workouts/:id" element={<MobileWorkoutDetail />} />
          <Route path="/stats"        element={<MobileStats />} />
          <Route path="/races"        element={<MobileRaces />} />
          <Route path="/more"         element={<MobileMore />} />
          <Route path="/runlab"       element={<RunLabDesktopOnly />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Bottom nav — fixed directly to the viewport bottom, independent of any
          parent layout so it is rock-solid in both Safari and iOS PWA mode */}
      {!isDetail && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50
                     bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
        >
          <div className="flex">
            {TABS.map(({ path, label, icon: Icon }) => {
              const active = path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(path)
              return (
                <Link
                  key={path}
                  to={path}
                  className={clsx(
                    'flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium transition-colors',
                    active
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300'
                  )}
                >
                  <Icon
                    size={23}
                    strokeWidth={active ? 2.5 : 1.75}
                    className="transition-transform active:scale-90"
                  />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
