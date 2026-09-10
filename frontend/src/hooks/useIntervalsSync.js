import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from './useApi'

/**
 * Drives an Intervals.icu import and polls it to completion.
 *
 * Previously copy-pasted into Layout.jsx, MobileMore.jsx and MobileFeed.jsx,
 * which meant three slightly different poll intervals and three different
 * error strings for the same failure.
 *
 * state: 'idle' | 'running' | 'done' | 'error'
 */
const POLL_MS = 2000

export function useIntervalsSync({ autoDismissMs = 5000, daysBack = 30 } = {}) {
  const [state, setState]       = useState('idle')
  const [progress, setProgress] = useState({ total: 0, done: 0 })
  const [result, setResult]     = useState(null)

  const pollRef    = useRef(null)
  const dismissRef = useRef(null)

  const stopTimers = useCallback(() => {
    if (pollRef.current)    { clearInterval(pollRef.current);   pollRef.current = null }
    if (dismissRef.current) { clearTimeout(dismissRef.current); dismissRef.current = null }
  }, [])

  const reset = useCallback(() => {
    stopTimers()
    setState('idle')
    setResult(null)
    setProgress({ total: 0, done: 0 })
  }, [stopTimers])

  // Clear timers if the component unmounts mid-sync.
  useEffect(() => stopTimers, [stopTimers])

  const fail = useCallback((message) => {
    stopTimers()
    setState('error')
    setResult({ error: message })
    if (autoDismissMs) {
      dismissRef.current = setTimeout(reset, autoDismissMs + 3000)
    }
  }, [stopTimers, reset, autoDismissMs])

  const start = useCallback(async () => {
    if (state === 'running') return
    stopTimers()
    setState('running')
    setResult(null)
    setProgress({ total: 0, done: 0 })

    try {
      await api.post('/intervals/import', { api_key: '', athlete_id: '0', days_back: daysBack })
    } catch (e) {
      fail(e.message)
      return
    }

    pollRef.current = setInterval(async () => {
      try {
        const s = await api.get('/intervals/import/status')
        setProgress({ total: s.total || 0, done: s.done || 0 })
        if (s.running) return

        stopTimers()
        const r = s.last_result || {}
        setResult(r)
        setState(r.error ? 'error' : 'done')
        if (autoDismissMs) {
          dismissRef.current = setTimeout(reset, r.error ? autoDismissMs + 3000 : autoDismissMs)
        }
      } catch {
        fail('Lost connection to server')
      }
    }, POLL_MS)
  }, [state, daysBack, stopTimers, reset, fail, autoDismissMs])

  const pct = progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : null

  return {
    state,
    progress,
    pct,
    result,
    start,
    reset,
    running: state === 'running',
  }
}
