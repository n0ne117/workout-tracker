import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { NAV_ITEMS } from '../components/AppShell'

/**
 * Phone navigation hub for the destinations that don't fit the tab bar.
 *
 * A plain list of links to the real pages. It used to be a container with its
 * own cut-down, read-only re-implementations of Gear, Conqueror and Settings
 * — which is how mobile ended up unable to edit anything.
 *
 * Desktop reaches all of these from the header, so nothing links here above
 * `md`; the page still renders fine if you type the URL.
 */
const SECONDARY = NAV_ITEMS.filter(i => !i.primary)

export default function More() {
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">More</h1>

      <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        {SECONDARY.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-50 dark:hover:bg-gray-800 dark:active:bg-gray-800 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-brand-500" />
            </span>
            <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
            <ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />
          </Link>
        ))}
      </div>
    </div>
  )
}
