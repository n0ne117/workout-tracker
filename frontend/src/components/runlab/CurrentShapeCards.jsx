import { useState, useEffect } from 'react'
import { api } from '../../hooks/useApi'
import InfoTip from './InfoTip'

const EXPLAINERS = {
  ctl:  "Your fitness — how much training your body has adapted to over the last 6 weeks. Rises slowly. Bigger = fitter.",
  tsb:  "Your freshness. Negative means you're tired (normal during heavy training). Positive means rested. Aim for slightly positive on race day.",
  atl:  "Your recent fatigue from the last 7 days. This rises fast and falls fast.",
  acwr: "Injury-risk check. Compares this week's training to the last 4 weeks. 0.8–1.3 is the sweet spot. Above 1.5 means you ramped up too fast and risk injury.",
}

function tsbLabel(tsb) {
  if (tsb == null) return null
  if (tsb < -20) return { text: 'Very tired',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
  if (tsb < -5)  return { text: 'Tired',        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
  if (tsb <= 15) return { text: 'Balanced',     cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
  return            { text: 'Fresh',          cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }
}

const ACWR_DOT = { green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500', low: 'bg-gray-400' }
const ACWR_LABEL = { green: 'optimal', amber: 'caution', red: 'high risk', low: 'low' }

export default function CurrentShapeCards() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/runlab/summary')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const v = (n, d = 0) => (n != null ? Number(n).toFixed(d) : '—')

  const tsb = tsbLabel(data?.tsb)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

      {/* Fitness — CTL */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Fitness (CTL)
          </p>
          <InfoTip text={EXPLAINERS.ctl} />
        </div>
        <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
          {loading ? '—' : v(data?.ctl)}
        </p>
        {data?.ctl_6w_delta != null && (
          <p className={`text-xs mt-2.5 font-medium ${
            data.ctl_6w_delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
          }`}>
            {data.ctl_6w_delta >= 0 ? '▲' : '▼'}&nbsp;
            {Math.abs(data.ctl_6w_delta)} vs 6 weeks ago
          </p>
        )}
        {!loading && data?.ctl == null && (
          <p className="text-xs text-gray-400 mt-2">Sync running activities to see fitness</p>
        )}
      </div>

      {/* Form — TSB */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Form (TSB)
          </p>
          <InfoTip text={EXPLAINERS.tsb} />
        </div>
        <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
          {loading ? '—' : v(data?.tsb)}
        </p>
        {tsb && (
          <span className={`inline-block mt-2.5 text-xs font-semibold px-2 py-0.5 rounded-full ${tsb.cls}`}>
            {tsb.text}
          </span>
        )}
      </div>

      {/* Fatigue — ATL */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Fatigue (ATL)
          </p>
          <InfoTip text={EXPLAINERS.atl} />
        </div>
        <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
          {loading ? '—' : v(data?.atl)}
        </p>
        <p className="text-xs text-gray-400 mt-2.5">7-day load</p>
      </div>

      {/* Load Risk — ACWR */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Load Risk
          </p>
          <InfoTip text={EXPLAINERS.acwr} />
        </div>
        <div className="flex items-baseline gap-2 leading-none">
          <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">
            {loading ? '—' : v(data?.weekly_km, 1)}
          </p>
          {data?.weekly_km != null && (
            <span className="text-sm text-gray-400">km/wk</span>
          )}
        </div>
        {data?.acwr != null && (
          <div className="flex items-center gap-2 mt-2.5">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ACWR_DOT[data.acwr_status] ?? 'bg-gray-300'}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ACWR {data.acwr} · {ACWR_LABEL[data.acwr_status] ?? '—'}
            </span>
          </div>
        )}
      </div>

    </div>
  )
}
