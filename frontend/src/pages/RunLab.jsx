import { FlaskConical } from 'lucide-react'
import CurrentShapeCards from '../components/runlab/CurrentShapeCards'
import PMCChart          from '../components/runlab/PMCChart'
import IntensityDonut    from '../components/runlab/IntensityDonut'
import WeeklyVolumeBar   from '../components/runlab/WeeklyVolumeBar'
import RacePredictions   from '../components/runlab/RacePredictions'

export default function RunLab() {
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
          <FlaskConical size={19} className="text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">RunLab</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Analytics &amp; predictions for your running training
          </p>
        </div>
      </div>

      {/* 1 — Current shape: CTL / TSB / ATL / Load risk */}
      <CurrentShapeCards />

      {/* 2 — Fitness / Fatigue / Form chart (PMC) */}
      <PMCChart />

      {/* 3 — Intensity balance + Weekly volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IntensityDonut />
        <WeeklyVolumeBar />
      </div>

      {/* 4 — Race predictions */}
      <RacePredictions />

    </div>
  )
}
