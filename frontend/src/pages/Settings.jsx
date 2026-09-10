import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../hooks/useApi'
import {
  CheckCircle, AlertCircle, Loader2,
  Download, X, Trash2,
  Upload, ArchiveRestore, HardDriveDownload, FileCheck2,
  FileWarning, FilePlus2
} from 'lucide-react'
import { formatDatetime } from '../utils/format'

export default function Settings() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* GPS File Upload */}
      <GpsUploadSection />

      {/* Backup & Restore */}
      <BackupSection />

      {/* Intervals.icu */}
      <IntervalsSection />

      {/* Danger Zone */}
      <DangerZone />

      {/* App info */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">About</h2>
        <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
          <p>Workout Tracker — personal workout manager</p>
          <p>Supports .gpx, .fit, .tcx, .kml and .kmz file imports, Intervals.icu sync, and OSM maps.</p>
        </div>
      </div>
    </div>
  )
}

// ── GPS File Upload ───────────────────────────────────────────────────────────

const GPS_ACCEPT = '.gpx,.fit,.tcx,.kml,.kmz'

function fileExt(name) {
  return name.split('.').pop().toLowerCase()
}

function GpsUploadSection() {
  const [files, setFiles]       = useState([])   // { file, status, result, error }
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const addFiles = useCallback((incoming) => {
    const valid = Array.from(incoming).filter(f =>
      ['gpx','fit','tcx','kml','kmz'].includes(fileExt(f.name))
    )
    if (!valid.length) return
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({ id: Math.random(), file: f, status: 'pending', result: null, error: null }))
    ])
  }, [])

  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  function clearAll() {
    setFiles([])
  }

  const pendingCount   = files.filter(f => f.status === 'pending').length
  const uploadingCount = files.filter(f => f.status === 'uploading').length
  const doneCount      = files.filter(f => f.status === 'done').length
  const errorCount     = files.filter(f => f.status === 'error').length
  const busy           = uploadingCount > 0

  async function handleUploadAll() {
    // Process each pending file sequentially
    const pending = files.filter(f => f.status === 'pending')
    for (const entry of pending) {
      setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'uploading' } : f))
      const form = new FormData()
      form.append('file', entry.file)
      try {
        const res = await fetch(`/api/import/upload`, { method: 'POST', body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(err.detail || res.statusText)
        }
        const data = await res.json()
        setFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'done', result: data } : f
        ))
      } catch (e) {
        setFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'error', error: e.message } : f
        ))
      }
    }
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">GPS File Import</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Upload .gpx, .fit, .tcx, .kml or .kmz files — multiple at once supported
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
          cursor-pointer transition-colors py-8
          ${dragging
            ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
      >
        <Upload size={28} className="text-gray-400 dark:text-gray-500" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {dragging ? 'Drop files here' : 'Drag & drop or click to select'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">.gpx · .fit · .tcx · .kml · .kmz</p>
        <input
          ref={inputRef}
          type="file"
          accept={GPS_ACCEPT}
          multiple
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(entry => (
            <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-lg text-sm
              ${entry.status === 'done'     ? 'bg-green-50 dark:bg-green-900/20'
              : entry.status === 'error'    ? 'bg-red-50 dark:bg-red-900/20'
              : entry.status === 'uploading'? 'bg-blue-50 dark:bg-blue-900/20'
              : 'bg-gray-50 dark:bg-gray-800'}`}
            >
              {entry.status === 'uploading' && <Loader2 size={15} className="animate-spin text-blue-500 flex-shrink-0" />}
              {entry.status === 'done'      && <FileCheck2 size={15} className="text-green-500 flex-shrink-0" />}
              {entry.status === 'error'     && <FileWarning size={15} className="text-red-500 flex-shrink-0" />}
              {entry.status === 'pending'   && <FilePlus2 size={15} className="text-gray-400 flex-shrink-0" />}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{entry.file.name}</p>
                {entry.status === 'done' && entry.result && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    ✓ Imported as "{entry.result.title}"
                    {entry.result.distance_meters ? ` · ${(entry.result.distance_meters / 1000).toFixed(2)} km` : ''}
                  </p>
                )}
                {entry.status === 'error' && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{entry.error}</p>
                )}
              </div>

              {entry.status !== 'uploading' && (
                <button onClick={() => removeFile(entry.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <button
              onClick={handleUploadAll}
              disabled={busy}
              className="btn-primary flex-1 justify-center"
            >
              {busy
                ? <><Loader2 size={15} className="animate-spin" /> Importing…</>
                : <><Upload size={15} /> Import {pendingCount} file{pendingCount !== 1 ? 's' : ''}</>
              }
            </button>
          )}
          {(doneCount > 0 || errorCount > 0) && !busy && (
            <button onClick={clearAll} className="btn-secondary">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}


// ── Backup & Restore ──────────────────────────────────────────────────────────

function BackupSection() {
  const [restoring, setRestoring]   = useState(false)
  const [restoreResult, setRestoreResult] = useState(null)
  const [restoreError, setRestoreError]   = useState(null)
  const restoreRef = useRef(null)

  async function downloadBackup(type) {
    try {
      const res = await fetch(`/api/backup/${type}`)
      if (!res.ok) throw new Error(res.statusText)
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : `${type}_backup.zip`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Backup failed: ${e.message}`)
    }
  }

  async function handleRestore(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''   // reset so re-uploading same file works

    if (!window.confirm(
      'Restore from backup?\n\nThis will REPLACE all existing data with the backup contents. This cannot be undone.'
    )) return

    setRestoring(true)
    setRestoreResult(null)
    setRestoreError(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(`/api/backup/restore`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || res.statusText)
      setRestoreResult(data)
    } catch (e) {
      setRestoreError(e.message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Backup & Restore</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Download a ZIP backup or restore from a previously downloaded archive
        </p>
      </div>

      {/* Download buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => downloadBackup('workouts')}
          className="btn-secondary justify-center gap-2 py-3"
        >
          <HardDriveDownload size={16} />
          <div className="text-left">
            <div className="font-medium">Backup Workouts</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">Workouts + GPS tracks only</div>
          </div>
        </button>
        <button
          onClick={() => downloadBackup('full')}
          className="btn-primary justify-center gap-2 py-3"
        >
          <HardDriveDownload size={16} />
          <div className="text-left">
            <div className="font-medium">Backup Everything</div>
            <div className="text-xs text-blue-200 font-normal">Workouts, gear, races, challenges</div>
          </div>
        </button>
      </div>

      {/* Restore */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Restore from backup</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Upload a ZIP archive previously downloaded from this app. Existing data will be replaced.
          </p>
        </div>
        <button
          onClick={() => restoreRef.current?.click()}
          disabled={restoring}
          className="btn-secondary gap-2"
        >
          {restoring
            ? <Loader2 size={15} className="animate-spin" />
            : <ArchiveRestore size={15} />
          }
          {restoring ? 'Restoring…' : 'Choose backup file…'}
        </button>
        <input
          ref={restoreRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleRestore}
        />

        {restoreResult && (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm space-y-1">
            <p className="font-medium">✓ Restore complete ({restoreResult.backup_type} backup)</p>
            {Object.entries(restoreResult.stats?.restored ?? {}).map(([k, v]) => (
              <p key={k} className="text-xs">• {k}: {v} records restored</p>
            ))}
          </div>
        )}

        {restoreError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {restoreError}
          </div>
        )}
      </div>
    </div>
  )
}


// ── Danger Zone ───────────────────────────────────────────────────────────────

function DangerZone() {
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState(null)

  async function deleteAllWorkouts() {
    const confirmed = window.confirm(
      'Delete ALL workouts?\n\nThis will permanently remove every workout, GPS track, and activity record. This cannot be undone.'
    )
    if (!confirmed) return

    setDeleting(true)
    setMsg(null)
    try {
      const res = await api.delete('/workouts?confirm=true')
      setMsg({ type: 'success', text: `Deleted ${res.deleted} workout${res.deleted !== 1 ? 's' : ''}.` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="card p-6 space-y-4 border border-red-200 dark:border-red-900/50">
      <div>
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Irreversible actions. Proceed with caution.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Delete all workouts</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Permanently removes every workout and GPS track. Settings are kept.
          </p>
        </div>
        <button
          onClick={deleteAllWorkouts}
          disabled={deleting}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            bg-red-600 hover:bg-red-700 active:bg-red-800 text-white
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          Delete All
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${
          msg.type === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
        }`}>
          {msg.text}
        </div>
      )}
    </div>
  )
}

// ── Intervals.icu section ─────────────────────────────────────────────────────

function IntervalsSection() {
  const [apiKey, setApiKey]       = useState('')
  const [athleteId, setAthleteId] = useState('0')
  const [daysBack, setDaysBack]   = useState(90)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress]   = useState({ total: 0, done: 0 })
  const [result, setResult]       = useState(null)
  const [connected, setConnected] = useState(false)

  // Combined backfill
  const [backfilling, setBackfilling] = useState(false)
  const [backfillStatus, setBackfillStatus] = useState(null)
  const backfillPollRef = useRef(null)

  // Load saved state
  useEffect(() => {
    api.get('/intervals/status').then(s => {
      setConnected(s.connected)
      if (s.athlete_id) setAthleteId(s.athlete_id)
      if (s.last_result) setResult(s.last_result)
      if (s.import_running) pollUntilDone()
    }).catch(() => {})
  }, [])

  function pollUntilDone() {
    setImporting(true)
    const iv = setInterval(async () => {
      try {
        const s = await api.get('/intervals/import/status')
        setProgress({ total: s.total || 0, done: s.done || 0 })
        if (!s.running) {
          clearInterval(iv)
          setImporting(false)
          setResult(s.last_result)
        }
      } catch { clearInterval(iv); setImporting(false) }
    }, 2000)
  }

  async function startImport() {
    setImporting(true)
    setResult(null)
    try {
      await api.post('/intervals/import', {
        api_key:   apiKey,   // empty string = use stored key on backend
        athlete_id: athleteId || '0',
        days_back: daysBack,
      })
      setConnected(true)
      pollUntilDone()
    } catch (e) {
      setImporting(false)
      setResult({ error: e.message })
    }
  }

  async function cancelImport() {
    try {
      await api.post('/intervals/import/cancel', {})
    } catch (e) {
      // ignore — import may have just finished
    }
  }

  async function startBackfill() {
    setBackfilling(true)
    setBackfillStatus(null)
    try {
      await api.post('/intervals/backfill', {})
    } catch (e) {
      setBackfilling(false)
      setBackfillStatus({ last_result: { error: e.message } })
      return
    }
    backfillPollRef.current = setInterval(async () => {
      try {
        const s = await api.get('/intervals/backfill/status')
        setBackfillStatus(s)
        if (!s.running) {
          clearInterval(backfillPollRef.current)
          backfillPollRef.current = null
          setBackfilling(false)
        }
      } catch {
        clearInterval(backfillPollRef.current)
        backfillPollRef.current = null
        setBackfilling(false)
        setBackfillStatus({ last_result: { error: 'Lost connection' } })
      }
    }, 2000)
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Intervals.icu</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            One-shot import of activities from your intervals.icu account
          </p>
        </div>
        <div className="flex items-center gap-3">
          {connected && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
              <CheckCircle size={16} /> Key saved
            </span>
          )}
          <button
            title="Download import debug log"
            onClick={async () => {
              const text = await fetch('/api/intervals/import/debug-log').then(r => r.text())
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
              a.download = 'intervals-import-debug.txt'
              a.click()
            }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2"
          >
            Debug log
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label">
            API Key{' '}
            <a
              href="https://intervals.icu/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 hover:underline font-normal"
            >
              (get it at Settings → Developer Settings)
            </a>
          </label>
          <input
            type="password"
            className="input font-mono"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={connected ? '••••••••  (stored – leave blank to reuse)' : 'e.g. 9a8b7c6d…'}
          />
        </div>
        <div>
          <label className="label">Athlete ID <span className="font-normal text-gray-400">(leave "0" for yourself)</span></label>
          <input
            className="input"
            value={athleteId}
            onChange={e => setAthleteId(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="label">Import last N days</label>
          <input
            type="number"
            className="input w-28"
            min={1} max={3650}
            value={daysBack}
            onChange={e => setDaysBack(parseInt(e.target.value) || 90)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={startImport}
          disabled={importing || (!apiKey && !connected)}
          className="btn-primary flex-1 justify-center"
        >
          <Download size={16} className={importing ? 'animate-bounce' : ''} />
          {importing ? 'Importing…' : 'Import from Intervals.icu'}
        </button>
        {importing && (
          <button onClick={cancelImport} className="btn-secondary px-3" title="Cancel import">
            <X size={15} />
          </button>
        )}
      </div>

      {importing && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              {progress.total > 0 ? 'Importing activities…' : 'Fetching activity list…'}
            </span>
            {progress.total > 0 && (
              <span className="tabular-nums">{progress.done} / {progress.total}</span>
            )}
          </div>
          {progress.total > 0 && (
            <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {result && !importing && (
        <div className={`p-3 rounded-lg text-sm space-y-0.5 ${
          result.error
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
        }`}>
          {result.error
            ? <p>Error: {result.error}</p>
            : <>
                <p>✓ Imported: <strong>{result.imported}</strong></p>
                <p>Skipped (already existed): <strong>{result.skipped}</strong></p>
                {result.errors > 0 && <p>Failed: {result.errors}</p>}
              </>
          }
        </div>
      )}

      {/* Combined backfill */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Backfill</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Re-fetches complete stream data (pace, power, HR, cadence, vertical oscillation,
            ground contact time) and training-load metrics for all past Intervals.icu activities.
            Run this once to fill in any charts that are missing data.
          </p>
        </div>
        <button
          onClick={startBackfill}
          disabled={backfilling || !connected}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HardDriveDownload size={14} className={backfilling ? 'animate-bounce' : ''} />
          {backfilling ? 'Backfilling…' : 'Run backfill (one-time)'}
        </button>

        {backfilling && backfillStatus && (
          <div className="space-y-1 text-xs text-gray-400">
            {backfillStatus.phase === 'streams' && (
              <p className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Phase 1/2 — Streams: {backfillStatus.streams_done} / {backfillStatus.streams_total}
              </p>
            )}
            {backfillStatus.phase === 'metrics' && (
              <p className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Phase 2/2 — Metrics: {backfillStatus.metrics_done} / {backfillStatus.metrics_total}
              </p>
            )}
            {!backfillStatus.phase && (
              <p className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />Starting…</p>
            )}
          </div>
        )}

        {backfillStatus?.last_result && !backfilling && (() => {
          const r = backfillStatus.last_result
          return (
            <div className={`p-2.5 rounded-lg text-xs ${
              r.error
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            }`}>
              {r.error
                ? <p>Error: {r.error}</p>
                : <>
                    <p>✓ Streams: {r.streams_updated ?? 0} updated, {r.streams_skipped ?? 0} skipped{r.streams_errors > 0 ? `, ${r.streams_errors} errors` : ''}</p>
                    <p>✓ Metrics: {r.metrics_processed ?? 0} fetched, {r.metrics_skipped ?? 0} skipped{r.metrics_errors > 0 ? `, ${r.metrics_errors} errors` : ''}</p>
                  </>
              }
            </div>
          )
        })()}
      </div>
    </div>
  )
}
