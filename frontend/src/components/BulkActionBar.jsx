import { useState } from 'react'
import { Trash2, Trophy, Download, X, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../hooks/useApi'

/**
 * Actions for a multi-selection, docked above the phone tab bar.
 *
 * Delete asks first and names the count — it is the one action here that
 * cannot be undone, and the likeliest reason to be selecting rows at all is
 * clearing out duplicates.
 */
export default function BulkActionBar({ selected, onClear, onChanged }) {
  const [busy, setBusy] = useState(null)      // 'race' | 'unrace' | 'download' | 'delete'
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)

  const ids = [...selected]
  const count = ids.length
  if (!count) return null

  async function run(kind, fn, { reload = true } = {}) {
    setBusy(kind)
    setError(null)
    try {
      await fn()
      if (reload) onChanged()
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  const setRace = value => run(
    value ? 'race' : 'unrace',
    () => api.patch('/workouts/bulk', { ids, is_race: value }),
  )

  const download = () => run('download', async () => {
    const res = await fetch('/api/workouts/bulk/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Export failed')
    }
    // Take the filename the server chose so exports stay timestamped.
    const disposition = res.headers.get('content-disposition') || ''
    const named = /filename="([^"]+)"/.exec(disposition)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = named ? named[1] : 'workouts.zip'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, { reload: false })

  const remove = () => run('delete', async () => {
    await api.post('/workouts/bulk/delete', { ids })
    onClear()
  })

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl
                 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-5"
    >
      <div className="card shadow-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
        {error && <p className="text-xs text-red-500 px-1">{error}</p>}

        {confirming ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-700 dark:text-gray-200 flex-1 min-w-0">
              Delete {count} workout{count !== 1 ? 's' : ''}? This cannot be undone.
            </span>
            <button onClick={() => setConfirming(false)} className="btn-secondary text-xs px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={remove}
              disabled={busy === 'delete'}
              className="btn text-xs px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy === 'delete' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete {count}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
              {count} selected
            </span>

            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              <button onClick={() => setRace(true)} disabled={!!busy}
                      className="btn-secondary text-xs px-2.5 py-1.5" title="Mark as race">
                {busy === 'race' ? <Loader2 size={13} className="animate-spin" /> : <Trophy size={13} />}
                <span className="hidden sm:inline">Race</span>
              </button>
              <button onClick={() => setRace(false)} disabled={!!busy}
                      className="btn-secondary text-xs px-2.5 py-1.5" title="Remove race flag">
                <span className="hidden sm:inline">Not a race</span>
                <span className="sm:hidden">Un-race</span>
              </button>
              <button onClick={download} disabled={!!busy}
                      className="btn-secondary text-xs px-2.5 py-1.5" title="Download as zip (JSON + GPX)">
                {busy === 'download' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                <span className="hidden sm:inline">Download</span>
              </button>
              <button onClick={() => setConfirming(true)} disabled={!!busy}
                      className="btn text-xs px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                      title="Delete selected">
                <Trash2 size={13} />
                <span className="hidden sm:inline">Delete</span>
              </button>
              <button onClick={onClear} className="btn-ghost p-1.5" title="Clear selection" aria-label="Clear selection">
                <X size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
