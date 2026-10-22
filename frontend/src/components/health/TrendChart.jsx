import { useMemo, useState } from 'react'
import { useWidth } from './useWidth'
import { formatValue, displayValue, parseDay } from '../../utils/wellness'
import { formatDate } from '../../utils/format'

const H = 120
const PAD = { top: 8, right: 8, bottom: 20, left: 40 }

/**
 * One metric over time: each day as a faint dot, the 7-day average as the
 * line. `domain` is the page's date range, so every small multiple shares
 * the same x-axis and their wiggles line up by date.
 */
export default function TrendChart({ field, series, domain }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const iw = width - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom

  const geo = useMemo(() => {
    if (!series.length) return null
    const t0 = parseDay(domain[0]).getTime()
    const t1 = Math.max(parseDay(domain[1]).getTime(), t0 + 86_400_000)
    const vals = series.flatMap(p => [displayValue(field, p.value), displayValue(field, p.mean)])
    let lo = Math.min(...vals), hi = Math.max(...vals)
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.08
    lo -= pad; hi += pad
    const x = iso => ((parseDay(iso).getTime() - t0) / (t1 - t0)) * iw
    const y = v => ih - ((displayValue(field, v) - lo) / (hi - lo)) * ih
    const points = series.map(p => ({ ...p, px: x(p.date), py: y(p.value), my: y(p.mean) }))
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)},${p.my.toFixed(1)}`).join('')
    const raw = series.map(p => p.value)
    return { points, line, yLo: y(Math.min(...raw)), yHi: y(Math.max(...raw)) }
  }, [series, domain, field, iw, ih])

  function onMove(e) {
    if (!geo) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left - PAD.left
    let best = geo.points[0]
    for (const p of geo.points) if (Math.abs(p.px - mx) < Math.abs(best.px - mx)) best = p
    setHover(best)
  }

  const minRaw = series.length ? Math.min(...series.map(p => p.value)) : null
  const maxRaw = series.length ? Math.max(...series.map(p => p.value)) : null

  return (
    <div ref={ref} className="relative select-none">
      <svg width={width} height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block">
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {geo && <>
            {/* Recessive frame: hairlines at the highest and lowest day. */}
            {[geo.yHi, geo.yLo].map((yy, i) => (
              <line key={i} x1={0} x2={iw} y1={yy} y2={yy} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth={1} />
            ))}
            <text x={-6} y={geo.yHi} dy="0.32em" textAnchor="end" className="fill-gray-400 text-[10px] tabular-nums">
              {formatValue(field, maxRaw, { unit: false })}
            </text>
            <text x={-6} y={geo.yLo} dy="0.32em" textAnchor="end" className="fill-gray-400 text-[10px] tabular-nums">
              {formatValue(field, minRaw, { unit: false })}
            </text>
            <text x={0} y={ih + 14} className="fill-gray-400 text-[10px]">{formatDate(parseDay(domain[0]))}</text>
            <text x={iw} y={ih + 14} textAnchor="end" className="fill-gray-400 text-[10px]">{formatDate(parseDay(domain[1]))}</text>

            {geo.points.map(p => (
              <circle key={p.date} cx={p.px} cy={p.py} r={1.75} className="fill-brand-500" opacity={0.3} />
            ))}
            <path d={geo.line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                  className="stroke-brand-600 dark:stroke-brand-500" />

            {hover && <>
              <line x1={hover.px} x2={hover.px} y1={0} y2={ih} className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1} />
              <circle cx={hover.px} cy={hover.my} r={4} strokeWidth={2}
                      className="fill-brand-600 dark:fill-brand-500 stroke-white dark:stroke-gray-900" />
            </>}
          </>}
          {/* Hit area covering the whole plot, not just the line. */}
          <rect x={0} y={0} width={Math.max(0, iw)} height={ih} fill="transparent" />
        </g>
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white/95 dark:bg-gray-900/95 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={hover.px > iw / 2
            ? { right: width - PAD.left - hover.px + 10 }
            : { left: PAD.left + hover.px + 10 }}
        >
          <p className="text-gray-500 dark:text-gray-400">{formatDate(parseDay(hover.date))}</p>
          <p className="font-medium text-gray-900 dark:text-white tabular-nums">{formatValue(field, hover.value)}</p>
          <p className="text-gray-500 dark:text-gray-400 tabular-nums">7-day avg {formatValue(field, hover.mean)}</p>
        </div>
      )}
    </div>
  )
}
