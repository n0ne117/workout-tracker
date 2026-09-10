import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import { Activity, Map, Clock, Trophy } from 'lucide-react'

export default function StatsBar() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/workouts/stats').then(setStats).catch(() => {})
  }, [])

  if (!stats) return null

  const items = [
    { icon: <Activity size={16} />, label: 'Total', value: stats.total },
    { icon: <Map size={16} />, label: 'Distance', value: `${stats.total_distance_km} km` },
    { icon: <Clock size={16} />, label: 'Hours', value: `${stats.total_duration_hours} h` },
    { icon: <Trophy size={16} />, label: 'Races', value: stats.races },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map(({ icon, label, value }) => (
        <div key={label} className="card p-4 flex items-center gap-3">
          <div className="text-brand-500 dark:text-brand-400">{icon}</div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
