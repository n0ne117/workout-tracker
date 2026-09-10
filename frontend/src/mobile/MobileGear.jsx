import { useState, useEffect } from 'react'
import { api } from '../hooks/useApi'
import { getSportIcon, sportSolidBg } from './utils'

const GEAR_SPORT = { shoes: 'running', bike: 'cycling', motorcycle: 'motorbiking' }
const GEAR_LABEL = { shoes: 'Shoes', bike: 'Bike', motorcycle: 'Motorcycle' }

function GearCard({ item }) {
  const sport = GEAR_SPORT[item.type] || 'other'
  const GearIcon = getSportIcon(sport)
  const bg = sportSolidBg(sport)
  const pct = item.max_range && item.distance_km
    ? Math.min((item.distance_km / item.max_range) * 100, 100)
    : null
  const urgent = pct !== null && pct >= 90

  return (
    <div className="px-4 py-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
          <GearIcon size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-[15px] text-gray-900 dark:text-white truncate">{item.name}</span>
            <span className="text-[11px] text-gray-400 flex-shrink-0">{GEAR_LABEL[item.type]}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {item.distance_km > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {item.distance_km.toFixed(0)} km
              </span>
            )}
            {item.duration_hours > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {item.duration_hours.toFixed(0)} h
              </span>
            )}
            {item.activity_count > 0 && (
              <span className="text-xs text-gray-400">
                {item.activity_count} {item.activity_count === 1 ? 'activity' : 'activities'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {pct !== null && (
        <div className="space-y-1">
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                urgent ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>{Math.round(pct)}% of {item.max_range} {item.max_range_unit ?? 'km'}</span>
            {urgent && <span className="text-red-500 font-medium">Near limit</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MobileGear() {
  const [gear, setGear] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/gear')
      .then(data => setGear(data.filter(g => !g.retired)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const byType = {}
  for (const item of gear) {
    if (!byType[item.type]) byType[item.type] = []
    byType[item.type].push(item)
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm
                   px-4 pt-3 pb-3 border-b border-gray-100 dark:border-gray-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Gear</h1>
      </div>

      <div className="pt-4 px-4 space-y-4">
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white dark:bg-gray-900 animate-pulse" />
            ))}
          </div>
        ) : gear.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <p className="text-4xl mb-3">🎽</p>
            <p className="font-medium">No gear yet</p>
            <p className="text-sm mt-1">Add gear from the full website</p>
          </div>
        ) : (
          ['shoes', 'bike', 'motorcycle'].map(type => {
            const items = byType[type]
            if (!items?.length) return null
            return (
              <div key={type}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {GEAR_LABEL[type]}
                </p>
                <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-gray-800">
                  {items.map(item => <GearCard key={item.id} item={item} />)}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
