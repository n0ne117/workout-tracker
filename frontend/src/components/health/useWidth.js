import { useEffect, useRef, useState } from 'react'

/**
 * The rendered width of an element, kept current as it resizes.
 *
 * The health charts draw in real pixels rather than a stretched viewBox, so
 * dots stay round and text keeps its size on every screen.
 */
export function useWidth(initial = 320) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(120, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
