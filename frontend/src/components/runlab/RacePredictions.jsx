import { useState, useEffect, useRef } from 'react'
import { api } from '../../hooks/useApi'
import InfoTip from './InfoTip'
import { Settings2, Plus, X, ChevronRight } from 'lucide-react'

const EXPLAINER = "Predicted finish times using the Riegel formula applied to all qualifying runs from the past 6 months. Easy runs are filtered out — the prediction is the median of your fastest 50% of efforts. Wings for Life simulates the catcher car schedule against your recent running pace."

const PRESET_DISTANCES = ['1k', '5k', '10k', '15k', 'hm', 'marathon', '50k', '100k', 'wfl']
const DIST_LABELS = {
  '1k':       '1 km',
  '5k':       '5 km',
  '10k':      '10 km',
  '15k':      '15 km',
  'hm':       'Half Marathon',
  'marathon': 'Marathon',
  '50k':      '50 km',
  '100k':     '100 km',
  'wfl':      'Wings for Life',
}

function fmtDistLabel(d) {
  if (DIST_LABELS[d]) return DIST_LABELS[d]
  const num = parseFloat(d.replace(/km?$/i, ''))
  if (!isNaN(num)) return `${num} km`
  return d
}

function fmtTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtPace(secs, km) {
  const perKm = secs / km
  const m = Math.floor(perKm / 60)
  const s = Math.round(perKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short' })
}

function confidence(usedRuns) {
  if (usedRuns >= 6) return { label: 'high',   cls: 'text-green-500 dark:text-green-400' }
  if (usedRuns >= 3) return { label: 'medium', cls: 'text-amber-500 dark:text-amber-400' }
  return                    { label: 'low',    cls: 'text-gray-400 dark:text-gray-500' }
}

// ── Source run row (used inside the detail sheet) ──────────────────────────────
function RunRow({ run, wfl }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500 flex-shrink-0">
            {fmtDate(run.date)}
          </span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
            {run.title}
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 tabular-nums">
          {run.distance_km} km &middot; {fmtTime(run.time_s)} &middot; {fmtPace(run.time_s, run.distance_km)}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        {wfl ? (
          <>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums leading-none">
              {run.predicted_dist_km} km
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums mt-0.5">
              {fmtTime(run.predicted_time_s)}
            </p>
          </>
        ) : (
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums">
            {fmtTime(run.predicted_s)}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Detail sheet ───────────────────────────────────────────────────────────────
function PredictionDetail({ prediction, onClose }) {
  const label = fmtDistLabel(prediction.distance)
  const usedRuns    = (prediction.source_runs ?? []).filter(r =>  r.used)
  const skippedRuns = (prediction.source_runs ?? []).filter(r => !r.used)

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums mt-0.5 leading-none">
              {prediction.wfl
                ? `${prediction.distance_km} km`
                : fmtTime(prediction.predicted_time_seconds)
              }
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {prediction.wfl
                ? `caught after ${fmtTime(prediction.predicted_time_seconds)}`
                : fmtPace(prediction.predicted_time_seconds, prediction.distance_km)
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mt-0.5 p-1 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">

          {/* Used runs */}
          {usedRuns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Used in prediction &mdash; {usedRuns.length} run{usedRuns.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1.5">
                {usedRuns.map(r => <RunRow key={r.id} run={r} wfl={prediction.wfl} />)}
              </div>
            </div>
          )}

          {/* Skipped runs */}
          {skippedRuns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 mb-1.5 uppercase tracking-wide">
                Filtered out &mdash; {skippedRuns.length} slower effort{skippedRuns.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mb-2">
                Bottom 50% by predicted pace — excluded to avoid easy/recovery runs skewing the result.
              </p>
              <div className="space-y-1.5 opacity-50">
                {skippedRuns.map(r => <RunRow key={r.id} run={r} wfl={prediction.wfl} />)}
              </div>
            </div>
          )}

          {(!usedRuns.length && !skippedRuns.length) && (
            <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-6">
              No source data available.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── No-data placeholder card ───────────────────────────────────────────────────
function NoDataCard({ p }) {
  const label = p.wfl ? 'Wings for Life' : (DIST_LABELS[p.distance] || fmtDistLabel(p.distance))
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-dashed border-gray-200 dark:border-gray-700 p-3 flex flex-col justify-between">
      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1 truncate">
        {label}
      </p>
      <p className="text-sm font-semibold text-gray-300 dark:text-gray-600 leading-snug">
        No data
      </p>
      <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
        Need a run ≥&thinsp;{p.min_ref_km} km
      </p>
    </div>
  )
}

// ── Wings for Life card ────────────────────────────────────────────────────────
function WflCard({ p, onClick }) {
  const conf = confidence(p.based_on?.used_runs ?? 0)
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border border-red-200/70 dark:border-red-800/50 p-3 hover:border-red-400 dark:hover:border-red-600 hover:shadow-md transition-all group"
    >
      <p className="text-xs font-semibold text-red-500 dark:text-red-400 mb-1 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block flex-shrink-0" />
        Wings for Life
        <ChevronRight size={11} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
      </p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
          {p.distance_km}
        </p>
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">km</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
        Caught after {fmtTime(p.predicted_time_seconds)}
      </p>
      {p.based_on && (
        <p className={`text-xs mt-1 ${conf.cls}`}>
          {p.based_on.used_runs} run{p.based_on.used_runs !== 1 ? 's' : ''} · {conf.label}
        </p>
      )}
    </button>
  )
}

// ── Standard distance card ─────────────────────────────────────────────────────
function DistCard({ p, onClick }) {
  const conf = confidence(p.based_on?.used_runs ?? 0)
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3 hover:border-brand-400 dark:hover:border-brand-500 hover:shadow-md transition-all group"
    >
      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1 truncate flex items-center">
        {DIST_LABELS[p.distance] || `${p.distance_km} km`}
        <ChevronRight size={11} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
      </p>
      <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
        {fmtTime(p.predicted_time_seconds)}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 tabular-nums">
        {fmtPace(p.predicted_time_seconds, p.distance_km)}
      </p>
      {p.based_on && (
        <p className={`text-xs mt-1 ${conf.cls}`}>
          {p.based_on.used_runs} run{p.based_on.used_runs !== 1 ? 's' : ''} · {conf.label}
        </p>
      )}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RacePredictions() {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [editOpen, setEditOpen]       = useState(false)
  const [selected, setSelected]       = useState(['5k', '10k', 'hm', 'marathon', 'wfl'])
  const [saving, setSaving]           = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [detail, setDetail]           = useState(null)   // prediction being inspected
  const customRef = useRef(null)

  async function load() {
    const [preds, sett] = await Promise.all([
      api.get('/runlab/predictions'),
      api.get('/runlab/settings'),
    ])
    // Sort by distance ascending; Wings for Life always last
    const sorted = [...preds].sort((a, b) => {
      if (a.wfl) return 1
      if (b.wfl) return -1
      return (a.distance_km ?? 0) - (b.distance_km ?? 0)
    })
    setPredictions(sorted)
    setSelected(sett.runlab_target_distances || ['5k', '10k', 'hm', 'marathon', 'wfl'])
  }

  useEffect(() => {
    setLoading(true)
    load().catch(() => {}).finally(() => setLoading(false))
  }, [])

  function toggleDist(d) {
    setSelected(sel => sel.includes(d) ? sel.filter(x => x !== d) : [...sel, d])
  }

  function parseCustomInput(raw) {
    const stripped = raw.trim().replace(/km?$/i, '').trim()
    const num = parseFloat(stripped)
    if (isNaN(num) || num <= 0 || num > 1000) return null
    const normalized = parseFloat(num.toFixed(3))
    return `${normalized}k`
  }

  function addCustom() {
    const key = parseCustomInput(customInput)
    if (!key) return
    setSelected(sel => sel.includes(key) ? sel : [...sel, key])
    setCustomInput('')
    customRef.current?.focus()
  }

  function handleCustomKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); addCustom() }
  }

  async function saveSettings() {
    if (selected.length === 0) return
    setSaving(true)
    try {
      await api.patch('/runlab/settings', { runlab_target_distances: selected })
      await load()
      setEditOpen(false)
    } catch {} finally {
      setSaving(false)
    }
  }

  const maxRuns = predictions.reduce((m, p) => Math.max(m, p.based_on?.total_runs ?? 0), 0)
  const customDistances = selected.filter(d => !PRESET_DISTANCES.includes(d))

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Race Predictions</h3>
          <InfoTip text={EXPLAINER} />
        </div>
        <button
          onClick={() => setEditOpen(o => !o)}
          className={`transition-colors ${
            editOpen
              ? 'text-brand-500'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
          title="Configure target distances"
        >
          <Settings2 size={15} />
        </button>
      </div>

      {/* Distance picker */}
      {editOpen && (
        <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-3">

          {/* Preset toggles */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Select target distances
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_DISTANCES.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDist(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selected.includes(d)
                      ? d === 'wfl'
                        ? 'bg-red-500 text-white'
                        : 'bg-brand-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-500'
                  }`}
                >
                  {DIST_LABELS[d] || d}
                </button>
              ))}
            </div>
          </div>

          {/* Custom distance input */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Custom distance
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-[140px]">
                <input
                  ref={customRef}
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={handleCustomKey}
                  placeholder="e.g. 25, 30km"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <button
                onClick={addCustom}
                disabled={!customInput.trim()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-400 dark:hover:border-brand-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                Add
              </button>
            </div>

            {customDistances.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {customDistances.map(d => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-brand-600 text-white"
                  >
                    {fmtDistLabel(d)}
                    <button
                      onClick={() => setSelected(sel => sel.filter(x => x !== d))}
                      className="opacity-70 hover:opacity-100 transition-opacity"
                      aria-label={`Remove ${fmtDistLabel(d)}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={saveSettings}
            disabled={saving || selected.length === 0}
            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Apply'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : predictions.length === 0 ? (
        <div className="h-32 flex flex-col items-center justify-center gap-1.5 text-center px-6">
          <p className="text-sm text-gray-400 dark:text-gray-600">No predictions yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Need at least one run in the past 6 months with distance &amp; time data
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {predictions.map(p =>
              p.no_data
                ? <NoDataCard key={p.distance} p={p} />
                : p.wfl
                  ? <WflCard key="wfl" p={p} onClick={() => setDetail(p)} />
                  : <DistCard key={p.distance} p={p} onClick={() => setDetail(p)} />
            )}
          </div>

          {maxRuns > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              Median of fastest 50% of qualifying runs · past 6 months · {maxRuns} runs analysed
            </p>
          )}
        </>
      )}

      {/* Detail sheet */}
      {detail && (
        <PredictionDetail prediction={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
