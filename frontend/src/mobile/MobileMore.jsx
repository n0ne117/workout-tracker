import { useState, useRef, useEffect } from 'react'
import {
  RefreshCw, Upload, Sun, Moon, ExternalLink,
  CheckCircle, AlertCircle, Loader2, FileUp, X,
  Route, Trophy,
} from 'lucide-react'
import { api } from '../hooks/useApi'
import { useTheme } from '../hooks/useTheme'
import { getSportIcon, sportSolidBg } from './utils'

// ══════════════════════════════════════════════════════════════════════════════
// Sync section — always visible above tabs
// ══════════════════════════════════════════════════════════════════════════════
function SyncSection() {
  const [state, setState]       = useState('idle')
  const [progress, setProgress] = useState({ total: 0, done: 0 })
  const [result, setResult]     = useState(null)
  const pollRef = useRef(null)

  function stop() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }
  useEffect(() => () => stop(), [])

  async function sync() {
    if (state === 'running') return
    stop(); setState('running'); setResult(null); setProgress({ total: 0, done: 0 })
    try {
      await api.post('/intervals/import', { api_key: '', athlete_id: '0', days_back: 30 })
    } catch (e) {
      setState('error'); setResult({ error: e.message }); return
    }
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.get('/intervals/import/status')
        setProgress({ total: s.total || 0, done: s.done || 0 })
        if (!s.running) {
          stop()
          const r = s.last_result || {}
          setResult(r)
          setState(r.error ? 'error' : 'done')
        }
      } catch {
        stop(); setState('error'); setResult({ error: 'Connection lost' })
      }
    }, 2000)
  }

  const busy = state === 'running'

  return (
    <div className="px-4 pt-4 pb-2">
      <button
        onClick={sync}
        disabled={busy}
        className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold text-sm
          transition-all active:scale-[0.97] shadow-sm
          ${busy
            ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-400 cursor-default'
            : 'bg-brand-600 text-white active:bg-brand-700'
          }`}
      >
        <RefreshCw size={17} className={busy ? 'animate-spin' : ''} />
        {busy
          ? progress.total > 0
            ? `Importing… ${progress.done} / ${progress.total}`
            : 'Fetching activities…'
          : 'Sync last 30 days'
        }
      </button>

      {busy && progress.total > 0 && (
        <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
          />
        </div>
      )}

      {state === 'done' && result && (
        <div className="mt-2 flex items-start gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
          <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-700 dark:text-green-300">
            <strong>{result.imported}</strong> new
            {result.skipped > 0 && <>, {result.skipped} already existed</>}
            {result.errors > 0 && <>, {result.errors} failed</>}
          </p>
        </div>
      )}
      {state === 'error' && result && (
        <div className="mt-2 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">{result.error}</p>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// GEAR tab
// ══════════════════════════════════════════════════════════════════════════════
const GEAR_SPORT  = { shoes: 'running', bike: 'cycling', motorcycle: 'motorbiking' }
const GEAR_LABEL  = { shoes: 'Shoes', bike: 'Bike', motorcycle: 'Motorcycle' }

function GearCard({ item }) {
  const sport   = GEAR_SPORT[item.type] || 'other'
  const GearIcon = getSportIcon(sport)
  const bg       = sportSolidBg(sport)
  const pct      = item.max_range && item.distance_km
    ? Math.min((item.distance_km / item.max_range) * 100, 100) : null
  const urgent   = pct !== null && pct >= 90

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
              <span className="text-xs text-gray-500 dark:text-gray-400">{item.distance_km.toFixed(0)} km</span>
            )}
            {item.duration_hours > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{item.duration_hours.toFixed(0)} h</span>
            )}
            {item.activity_count > 0 && (
              <span className="text-xs text-gray-400">{item.activity_count} {item.activity_count === 1 ? 'activity' : 'activities'}</span>
            )}
          </div>
        </div>
      </div>
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

function GearTab() {
  const [gear, setGear]     = useState([])
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

  if (loading) return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-white dark:bg-gray-900 animate-pulse" />
      ))}
    </div>
  )

  if (gear.length === 0) return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-600">
      <p className="text-4xl mb-3">🎽</p>
      <p className="font-medium">No gear yet</p>
      <p className="text-sm mt-1">Add gear from the full website</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {['shoes', 'bike', 'motorcycle'].map(type => {
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
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CONQUEROR tab
// ══════════════════════════════════════════════════════════════════════════════
function ChallengeCard({ item }) {
  const hasWindow = item.start_date && item.end_date
  const expired   = item.use_before && !item.start_date && new Date(item.use_before) < new Date()

  function fmtDate(d) {
    return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500
                        flex items-center justify-center flex-shrink-0 shadow-sm">
          <Trophy size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <p className="font-semibold text-[15px] text-gray-900 dark:text-white leading-snug">{item.name}</p>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex-shrink-0">
              {item.distance_km.toLocaleString()} km
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
            {item.year && <span>{item.year}</span>}
            {item.cost_eur != null && <span>€{item.cost_eur.toFixed(2)}</span>}
            {hasWindow && (
              <span>{fmtDate(item.start_date)} – {fmtDate(item.end_date)}</span>
            )}
            {item.use_before && !item.start_date && (
              <span className={expired ? 'text-red-400' : 'text-gray-400'}>
                Use before {fmtDate(item.use_before)}
              </span>
            )}
          </div>
          {item.notes && (
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{item.notes}</p>
          )}
        </div>
      </div>
      {/* Completion badge */}
      {item.end_date && new Date(item.end_date) < new Date() && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-green-600 dark:text-green-400">
          <CheckCircle size={12} />
          Completed
        </div>
      )}
      {item.start_date && !item.end_date && (
        <div className="mt-3 flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full w-1/2" />
          </div>
          <span className="text-[11px] text-gray-400">In progress</span>
        </div>
      )}
    </div>
  )
}

function ConquerorTab() {
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    api.get('/challenges')
      .then(setChallenges)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-2">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-white dark:bg-gray-900 animate-pulse" />
      ))}
    </div>
  )

  if (challenges.length === 0) return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-600">
      <Route size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">No challenges yet</p>
      <p className="text-sm mt-1">Add challenges from the full website</p>
    </div>
  )

  // Group: active / upcoming / completed
  const now = new Date()
  const active    = challenges.filter(c => c.start_date && !c.end_date)
  const completed = challenges.filter(c => c.end_date)
  const unstarted = challenges.filter(c => !c.start_date && !c.end_date)

  const groups = [
    { label: 'Active',    items: active },
    { label: 'Not started', items: unstarted },
    { label: 'Completed', items: completed },
  ].filter(g => g.items.length > 0)

  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.label}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{g.label}</p>
          <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-gray-800">
            {g.items.map(c => <ChallengeCard key={c.id} item={c} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS tab
// ══════════════════════════════════════════════════════════════════════════════
function GpsSection() {
  const [files, setFiles] = useState([])
  const inputRef = useRef(null)

  async function handleChange(e) {
    const incoming = Array.from(e.target.files || [])
    e.target.value = ''
    if (!incoming.length) return
    const entries = incoming.map(f => ({ id: Math.random(), file: f, state: 'pending', result: null, error: null }))
    setFiles(prev => [...prev, ...entries])
    for (const entry of entries) {
      setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, state: 'uploading' } : f))
      const form = new FormData()
      form.append('file', entry.file)
      try {
        const res = await fetch('/api/import/upload', { method: 'POST', body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(err.detail || res.statusText)
        }
        const data = await res.json()
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, state: 'done', result: data } : f))
      } catch (e) {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, state: 'error', error: e.message } : f))
      }
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 pt-4 pb-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">GPS Files</p>
      </div>
      <div className="p-4">
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-base
                     bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
                     active:scale-[0.97] active:bg-gray-200 dark:active:bg-gray-700 transition-all"
        >
          <FileUp size={20} />
          Import GPS file
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">.gpx · .fit · .tcx · .kml · .kmz</p>
        <input ref={inputRef} type="file" accept=".gpx,.fit,.tcx,.kml,.kmz" multiple className="hidden" onChange={handleChange} />
        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.slice(-5).map(entry => (
              <div key={entry.id} className={`flex items-center gap-2 p-2.5 rounded-xl text-sm ${
                entry.state === 'done'      ? 'bg-green-50 dark:bg-green-900/20' :
                entry.state === 'error'    ? 'bg-red-50 dark:bg-red-900/20' :
                entry.state === 'uploading' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800'
              }`}>
                {entry.state === 'uploading' && <Loader2 size={13} className="animate-spin text-blue-500 flex-shrink-0" />}
                {entry.state === 'done'      && <CheckCircle size={13} className="text-green-500 flex-shrink-0" />}
                {entry.state === 'error'     && <AlertCircle size={13} className="text-red-500 flex-shrink-0" />}
                {entry.state === 'pending'   && <Upload size={13} className="text-gray-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">{entry.file.name}</p>
                  {entry.state === 'done' && entry.result && (
                    <p className="text-[11px] text-green-600 dark:text-green-400">✓ {entry.result.title}</p>
                  )}
                  {entry.state === 'error' && (
                    <p className="text-[11px] text-red-500 truncate">{entry.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsTab() {
  const { theme, toggle } = useTheme()

  return (
    <div className="space-y-4">
      <GpsSection />

      {/* Preferences */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preferences</p>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              {theme === 'dark'
                ? <Moon size={18} className="text-gray-500" />
                : <Sun size={18} className="text-gray-500" />
              }
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </span>
            </div>
            <button
              onClick={toggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                theme === 'dark' ? 'bg-brand-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Full site */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm">
        <a
          href="/"
          onClick={e => { e.preventDefault(); window.location.href = '/?desktop=1' }}
          className="flex items-center justify-between px-4 py-4 active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Full website</p>
            <p className="text-xs text-gray-400 mt-0.5">All features, charts, and settings</p>
          </div>
          <ExternalLink size={16} className="text-gray-400" />
        </a>
      </div>

      <p className="text-center text-xs text-gray-300 dark:text-gray-700 pt-2">
        Workout Tracker · Mobile View
      </p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab strip
// ══════════════════════════════════════════════════════════════════════════════
const TABS = ['Gear', 'Conqueror', 'Settings']

function TabStrip({ active, onChange }) {
  return (
    <div className="px-4 pb-3">
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              active === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 active:text-gray-700 dark:active:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// More page
// ══════════════════════════════════════════════════════════════════════════════
export default function MobileMore() {
  const [tab, setTab] = useState('Gear')

  return (
    <div className="pb-8">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm
                   border-b border-gray-100 dark:border-gray-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="px-4 pb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">More</h1>
        </div>
        <SyncSection />
        <TabStrip active={tab} onChange={setTab} />
      </div>

      <div className="pt-4 px-4">
        {tab === 'Gear'      && <GearTab />}
        {tab === 'Conqueror' && <ConquerorTab />}
        {tab === 'Settings'  && <SettingsTab />}
      </div>
    </div>
  )
}
