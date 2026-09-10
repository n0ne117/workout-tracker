import { useState, useRef } from 'react'
import { X, FileUp } from 'lucide-react'
import { api } from '../hooks/useApi'

export default function ImportModal({ onClose }) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState(null) // null | loading | success | error
  const [message, setMessage] = useState('')
  const fileRef = useRef(null)

  async function handleFiles(files) {
    setStatus('loading')
    setMessage('')
    const results = []
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase()
      if (!['gpx', 'fit', 'tcx'].includes(ext)) {
        results.push(`${file.name}: unsupported format`)
        continue
      }
      const fd = new FormData()
      fd.append('file', file)
      try {
        await api.upload(`/import/${ext}`, fd)
        results.push(`✓ ${file.name}`)
      } catch (e) {
        results.push(`✗ ${file.name}: ${e.message}`)
      }
    }
    setStatus('done')
    setMessage(results.join('\n'))
    // Refresh page after 1.5s
    setTimeout(() => window.location.reload(), 1500)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import Workouts</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
              : 'border-gray-300 dark:border-gray-700 hover:border-brand-400'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp className="mx-auto mb-3 text-gray-400" size={32} />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Drop .fit, .gpx or .tcx files here
          </p>
          <p className="text-xs text-gray-400 mt-1">or click to browse</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".fit,.gpx,.tcx"
          multiple
          className="hidden"
          onChange={e => handleFiles(Array.from(e.target.files))}
        />

        {/* Status */}
        {status && status !== 'loading' && message && (
          <div className={`mt-4 p-3 rounded-lg text-sm whitespace-pre-line ${
            status === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
          }`}>
            {message}
          </div>
        )}

        {status === 'loading' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <RefreshCw size={14} className="animate-spin" />
            Processing…
          </div>
        )}
      </div>
    </div>
  )
}
