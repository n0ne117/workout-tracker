import { useMemo, useState } from 'react'
import { useWidth } from './useWidth'
import { formatValue, displayValue, parseDay } from '../../utils/wellness'
import { formatDate } from '../../utils/format'

const PAD = { top: 8, right: 8, bottom: 20, left: 40 }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * One metric over time: each day as a faint dot, the 7-day average as the
 * line. `domain` is the page's date range, so every small multiple shares
 * the same x-axis and their wiggles line up by date.
 *
 * Optional, for the larger detail view:
 *   band       [{ date, lo, hi }] — a shaded "usual range" behind the data
 *   height     plot height in px (month ticks appear from 180 up)
 *   dotRadius / dotOpacity — make the dots the main mark (monthly averages)
 *   labels     { day: fn(iso) → string, value: string, mean: string } for the tooltip;
 *              mean: null hides the second line
 */
export default function TrendChart({
  field, series, domain, band = null, height = 120,
  dotRadius = 1.75, dotOpacity = 0.3, labels = {},
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const iw = width - PAD.left - PAD.right
  const ih = height - PAD.top - PAD.bottom
  const dayLabel = labels.day ?? (iso => formatDate(parseDay(iso)))
  const meanLabel = labels.mean === undefined ? '7-day avg' : labels.mean

  const geo = useMemo(() => {
    if (!series.length) return null
    const t0 = parseDay(domain[0]).getTime()
    const t1 = Math.max(parseDay(domain[1]).getTime(), t0 + 86_400_000)
    const vals = [
      ...series.flatMap(p => [p.value, p.mean]),
      ...(band ?? []).flatMap(b => [b.lo, b.hi]),
    ].map(v => displayValue(field, v))
    let lo = Math.min(...vals), hi = Math.max(...vals)
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.08
    lo -= pad; hi += pad
    const x = iso => ((parseDay(iso).getTime() - t0) / (t1 - t0)) * iw
    const y = v => ih - ((displayValue(field, v) - lo) / (hi - lo)) * ih
    const points = series.map(p => ({ ...p, px: x(p.date), py: y(p.value), my: y(p.mean) }))
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)},${p.my.toFixed(1)}`).join('')
    const area = band?.length
      ? 'M' + band.map(b => `${x(b.date).toFixed(1)},${y(b.hi).toFixed(1)}`).join('L')
        + 'L' + [...band].reverse().map(b => `${x(b.date).toFixed(1)},${y(b.lo).toFixed(1)}`).join('L') + 'Z'
      : null

    // Month ticks for the big chart; every month, or every n-th when crowded.
    let ticks = []
    if (height >= 180) {
      const d = new Date(t0); d.setDate(1); d.setMonth(d.getMonth() + 1)
      for (; d.getTime() <= t1; d.setMonth(d.getMonth() + 1)) {
        ticks.push({ px: ((d.getTime() - t0) / (t1 - t0)) * iw, month: d.getMonth(), year: d.getFullYear() })
      }
      const every = Math.ceil(ticks.length / Math.max(1, Math.floor(iw / 56)))
      ticks = ticks.filter((_, i) => i % every === 0)
    }
    const raw = series.map(p => p.value)
    return { points, line, area, ticks, yLo: y(Math.min(...raw)), yHi: y(Math.max(...raw)) }
  }, [series, domain, band, field, iw, ih, height])

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
  const bandAt = hover && band ? band.find(b => b.date === hover.date) : null

  return (
    <div ref={ref} className="relative select-none">
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block">
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {geo && <>
            {geo.area && <path d={geo.area} className="fill-gray-200/70 dark:fill-gray-700/40" />}

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
            {geo.ticks.length ? geo.ticks.map(t => (
              <text key={`${t.year}-${t.month}`} x={t.px} y={ih + 14} textAnchor="middle" className="fill-gray-400 text-[10px]">
                {t.month === 0 ? t.year : MONTHS[t.month]}
              </text>
            )) : <>
              <text x={0} y={ih + 14} className="fill-gray-400 text-[10px]">{dayLabel(domain[0])}</text>
              <text x={iw} y={ih + 14} textAnchor="end" className="fill-gray-400 text-[10px]">{dayLabel(domain[1])}</text>
            </>}

            {geo.points.map(p => (
              <circle key={p.date} cx={p.px} cy={p.py} r={dotRadius} className="fill-brand-500" opacity={dotOpacity} />
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
          <p className="text-gray-500 dark:text-gray-400">{dayLabel(hover.date)}</p>
          <p className="font-medium text-gray-900 dark:text-white tabular-nums">
            {labels.value && <span className="font-normal text-gray-500 dark:text-gray-400">{labels.value} </span>}
            {formatValue(field, hover.value)}
          </p>
          {meanLabel && (
            <p className="text-gray-500 dark:text-gray-400 tabular-nums">{meanLabel} {formatValue(field, hover.mean)}</p>
          )}
          {bandAt && (
            <p className="text-gray-500 dark:text-gray-400 tabular-nums">
              usual {formatValue(field, bandAt.lo, { unit: false })}–{formatValue(field, bandAt.hi)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
