import clsx from 'clsx'
import { CheckCircle2, AlertTriangle, ArrowUp, ArrowDown, Minus, Info } from 'lucide-react'
import { meta } from '../../utils/wellness'
import InfoTip from '../runlab/InfoTip'

// ── Verdicts ──────────────────────────────────────────────────────────────────

export const VERDICT = {
  better: { text: 'Better than usual', icon: CheckCircle2, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  worse:  { text: 'Worse than usual',  icon: AlertTriangle, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  higher: { text: 'Higher than usual', icon: ArrowUp,  cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  lower:  { text: 'Lower than usual',  icon: ArrowDown, cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  usual:  { text: 'About usual',       icon: Minus,    cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
}

/** Icon and words with the colour, so the verdict never rests on colour alone. */
export function Verdict({ verdict, short = false }) {
  const v = VERDICT[verdict]
  const Icon = v.icon
  return (
    <span className={clsx('badge gap-1 whitespace-nowrap', v.cls)}>
      <Icon size={12} />
      {short ? v.text.replace(' than usual', '') : v.text}
    </span>
  )
}

export function Explainer({ field }) {
  const m = meta(field)
  const text = [m.desc, m.good].filter(Boolean).join(' ')
  return text ? <InfoTip text={text} /> : null
}

/** The icon for an insight's tone, coloured like the verdict badges. */
export function ToneIcon({ tone, size = 16 }) {
  if (tone === 'better') return <CheckCircle2 size={size} className="flex-shrink-0 text-green-600 dark:text-green-400" aria-label="better" />
  if (tone === 'worse')  return <AlertTriangle size={size} className="flex-shrink-0 text-red-600 dark:text-red-400" aria-label="worse" />
  return <Info size={size} className="flex-shrink-0 text-gray-400" aria-hidden="true" />
}

export const TONE_TEXT = {
  better: 'text-green-700 dark:text-green-300',
  worse: 'text-red-700 dark:text-red-300',
  neutral: 'text-gray-900 dark:text-white',
}
