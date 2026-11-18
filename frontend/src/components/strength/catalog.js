import { useCallback, useEffect, useState } from 'react'
import { api } from '../../hooks/useApi'

/**
 * The exercise catalog and muscle groups, shared by the editor, the picker
 * and Settings. `reload` after adding or editing an exercise.
 */
export function useCatalog() {
  const [exercises, setExercises] = useState([])
  const [groups, setGroups] = useState([])

  const reload = useCallback(async () => {
    const [ex, gr] = await Promise.all([api.get('/strength/exercises'), api.getCached('/strength/groups', 3_600_000)])
    setExercises(ex)
    setGroups(gr)
    return ex
  }, [])

  useEffect(() => { reload().catch(() => {}) }, [reload])

  const byId = Object.fromEntries(exercises.map(e => [e.id, e]))
  return { exercises, groups, byId, reload }
}

export function formatKg(v) {
  if (v == null) return '—'
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
}
