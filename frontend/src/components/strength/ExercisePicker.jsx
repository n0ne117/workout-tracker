import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, X, LoaderCircle } from 'lucide-react'
import { api } from '../../hooks/useApi'
import MuscleGroupPicker from './MuscleGroupPicker'

/**
 * Search the catalog and pick an exercise — or create one on the spot when
 * the name isn't there yet, so a freeform session never needs Settings.
 */
export default function ExercisePicker({ exercises, groups, onPick, onCreated, onClose }) {
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(null)   // { primary, secondary } while defining a new one
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return exercises.filter(e => {
      const hay = `${e.name} ${e.primary.join(' ')}`.toLowerCase()
      return words.every(w => hay.includes(w))
    })
  }, [q, exercises])

  const exact = exercises.some(e => e.name.toLowerCase() === q.trim().toLowerCase())

  async function create() {
    setSaving(true)
    setError(null)
    try {
      const ex = await api.post('/strength/exercises', { name: q.trim(), ...creating })
      await onCreated?.()
      onPick(ex)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Search size={15} className="text-gray-400 shrink-0" />
        <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setCreating(null) }}
               placeholder="Search exercises — e.g. Latzug, Beine…" className="input py-1.5" />
        <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close"><X size={15} /></button>
      </div>

      {creating ? (
        <div className="space-y-2 p-1">
          <p className="text-sm text-gray-700 dark:text-gray-300">New exercise <strong>{q.trim()}</strong> — which muscles does it train?</p>
          <MuscleGroupPicker groups={groups} primary={creating.primary} secondary={creating.secondary} onChange={setCreating} />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={create} disabled={saving || !creating.primary.length} className="btn-primary py-1.5 text-xs">
              {saving ? <LoaderCircle size={13} className="animate-spin" /> : <Plus size={13} />} Create and add
            </button>
            <button onClick={() => setCreating(null)} className="btn-ghost py-1.5 text-xs">Back</button>
          </div>
        </div>
      ) : (
        <ul className="max-h-64 overflow-y-auto -mx-1">
          {matches.map(e => (
            <li key={e.id}>
              <button onClick={() => onPick(e)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-baseline justify-between gap-3">
                <span className="text-sm text-gray-900 dark:text-gray-100">{e.name}</span>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">{e.primary.join(', ')}</span>
              </button>
            </li>
          ))}
          {q.trim() && !exact && (
            <li>
              <button onClick={() => setCreating({ primary: [], secondary: [] })}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                <Plus size={14} /> Create “{q.trim()}”
              </button>
            </li>
          )}
          {!matches.length && !q.trim() && <li className="px-2 py-1.5 text-sm text-gray-400">No exercises yet</li>}
        </ul>
      )}
    </div>
  )
}
