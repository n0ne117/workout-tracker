import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { Info } from 'lucide-react'

export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const ref = useRef(null)
  const popRef = useRef(null)

  // The popover hangs left from its button; near the left edge of a phone
  // that put most of it off screen. Nudge it back inside the viewport.
  useLayoutEffect(() => {
    if (!open || !popRef.current) { setShift(0); return }
    const r = popRef.current.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    setShift(r.left < 8 ? 8 - r.left : r.right > vw - 8 ? vw - 8 - r.right : 0)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors leading-none"
        aria-label="More info"
      >
        <Info size={13} />
      </button>
      {open && (
        <div ref={popRef} style={{ transform: `translateX(${shift}px)` }}
             className="absolute z-30 right-0 top-5 w-64 max-w-[calc(100vw-1rem)] p-3 rounded-xl
                        bg-gray-900 dark:bg-gray-800 text-white text-xs leading-relaxed
                        shadow-xl border border-white/10">
          {text}
        </div>
      )}
    </div>
  )
}
