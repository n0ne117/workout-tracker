import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

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
        <div className="absolute z-30 right-0 top-5 w-64 p-3 rounded-xl
                        bg-gray-900 dark:bg-gray-800 text-white text-xs leading-relaxed
                        shadow-xl border border-white/10">
          {text}
        </div>
      )}
    </div>
  )
}
