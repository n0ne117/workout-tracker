import { useMemo, useState } from 'react'
import { Search, Pencil, Trash2, Plus, Loader2, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../hooks/useApi'
import { useCatalog } from './catalog'
import MuscleGroupPicker from './MuscleGroupPicker'

/**
 * Settings card for the strength exercise catalog: rename, re-assign muscle
 * groups, add your own. Built-in entries can be edited but not deleted;
 * your own can be deleted while no workout uses them.
 */
export default function ExerciseCatalog() {
  const { exercises, groups, reload } = useCatalog()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)   // { id?, name, primary, secondary }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return exercises.filter(e => words.every(w => `${e.name} ${e.primary.join(' ')} ${e.secondary.join(' ')}`.toLowerCase().includes(w)))
  }, [q, exercises])

  async function save() {
    setBusy(true); setError(null)
    try {
      const body = { name: editing.name, primary: editing.primary, secondary: editing.secondary }
      if (editing.id) await api.patch(`/strength/exercises/${editing.id}`, body)
      else await api.post('/strength/exercises', body)
      await reload()
      setEditing(null)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function remove(e) {
    if (!window.confirm(`Delete “${e.name}”?`)) return
    try { await api.delete(`/strength/exercises/${e.id}`); await reload() } catch (err) { setError(err.message) }
  }

  const form = editing && (
    <div className="rounded-lg border border-brand-200 dark:border-brand-800 p-3 space-y-2.5">
      <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
             placeholder="Name, e.g. Latzug (Maschine)" className="input" autoFocus />
      <MuscleGroupPicker groups={groups} primary={editing.primary} secondary={editing.secondary}
                         onChange={g => setEditing({ ...editing, ...g })} />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy || !editing.name.trim() || !editing.primary.length} className="btn-primary py-1.5 text-xs">
          {busy && <Loader2 size={13} className="animate-spin" />} Save
        </button>
        <button onClick={() => { setEditing(null); setError(null) }} className="btn-ghost py-1.5 text-xs">Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="card p-6 space-y-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start justify-between gap-3 text-left">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Strength exercises</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {exercises.length} exercises and the muscle groups each one trains — used for the muscle split
          </p>
        </div>
        <ChevronDown size={18} className={clsx('mt-1 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && <>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="input pl-9" />
          </div>
          <button onClick={() => setEditing({ name: q, primary: [], secondary: [] })} className="btn-secondary">
            <Plus size={15} /> Add
          </button>
        </div>
        {editing && !editing.id && form}
        {error && !editing && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[28rem] overflow-y-auto">
          {shown.map(e => (
            <li key={e.id} className="py-2">
              {editing?.id === e.id ? form : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {e.name}{e.custom && <span className="ml-1.5 badge bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">yours</span>}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {e.primary.join(', ')}{e.secondary.length > 0 && <span className="text-gray-400"> · assists: {e.secondary.join(', ')}</span>}
                    </p>
                  </div>
                  <button onClick={() => { setError(null); setEditing({ id: e.id, name: e.name, primary: e.primary, secondary: e.secondary }) }}
                          className="btn-ghost p-1.5" aria-label={`Edit ${e.name}`}><Pencil size={14} /></button>
                  {e.custom && (
                    <button onClick={() => remove(e)} className="btn-ghost p-1.5 text-red-500" aria-label={`Delete ${e.name}`}><Trash2 size={14} /></button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </>}
    </div>
  )
}
