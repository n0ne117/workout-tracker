import { useMemo, useState } from 'react'
import { useWidth } from './useWidth'
import { meta, formatValue, displayValue, parseDay } from '../../utils/wellness'
import { formatDate } from '../../utils/format'

const H = 260
const PAD = { top: 10, right: 12, bottom: 40, left: 52 }

function ticks(lo, hi, count = 4) {
  const span = hi - lo || 1
  const step = 10 ** Math.floor(Math.log10(span / count))
  const nice = [1, 2, 5, 10].map(m => m * step).find(s => span / s <= count) ?? step * 10
  const out = []
  for (let v = Math.ceil(lo / nice) * nice; v <= hi + 1e-9; v += nice) out.push(+v.toFixed(10))
  return out
}

/**
 * Every shared day of one relationship as a dot, with the least-squares
 * line through them. Hover picks the nearest dot, so small marks stay easy
 * to read.
 */
export default function ScatterChart({ rel }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const iw = width - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const { x: fx, y: fy, lag } = rel

  const geo = useMemo(() => {
    const pts = rel.pairs.map(([x, y, date, rawX, rawY]) => ({ x: displayValue(fx, x), y: displayValue(fy, y), rawX, rawY, devX: x, devY: y, date }))
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const bounds = v => {
      let lo = Math.min(...v), hi = Math.max(...v)
      if (lo === hi) { lo -= 1; hi += 1 }
      const pad = (hi - lo) * 0.06
      return [lo - pad, hi + pad]
    }
    const [x0, x1] = bounds(xs), [y0, y1] = bounds(ys)
    const sx = v => ((v - x0) / (x1 - x0)) * iw
    const sy = v => ih - ((v - y0) / (y1 - y0)) * ih

    // Least-squares fit, drawn across the data's own x-extent.
    const n = pts.length
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
    const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / (pts.reduce((a, p) => a + (p.x - mx) ** 2, 0) || 1)
    const lx0 = Math.min(...xs), lx1 = Math.max(...xs)
    const fit = [lx0, lx1].map(v => [sx(v), sy(my + slope * (v - mx))])

    return {
      dots: pts.map(p => ({ ...p, px: sx(p.x), py: sy(p.y) })),
      xt: ticks(x0, x1).map(v => ({ v, p: sx(v) })),
      yt: ticks(y0, y1).map(v => ({ v, p: sy(v) })),
      fit,
    }
  }, [rel, fx, fy, iw, ih])

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left - PAD.left, my = e.clientY - rect.top - PAD.top
    let best = null, bestD = Infinity
    for (const d of geo.dots) {
      const dist = (d.px - mx) ** 2 + (d.py - my) ** 2
      if (dist < bestD) { bestD = dist; best = d }
    }
    setHover(bestD < 40 ** 2 ? best : null)
  }

  // Axes are distance from each metric's own 4-week average, 0 = a usual day.
  const xLabel = `${meta(fx).label}${lag ? ', day before' : ''} vs usual${meta(fx).unit ? ` · ${meta(fx).unit}` : ''}`
  const yLabel = `${meta(fy).label} vs usual${meta(fy).unit ? ` · ${meta(fy).unit}` : ''}`
  const signed = (f, v) => `${v >= 0 ? '+' : '−'}${formatValue(f, Math.abs(v), { unit: false })}`
  const fmtTick = v => v.toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div ref={ref} className="relative select-none">
      <svg width={width} height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block"
           role="img" aria-label={`${yLabel} against ${xLabel}, ${rel.n} days`}>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {geo.yt.map(t => (
            <g key={`y${t.v}`}>
              <line x1={0} x2={iw} y1={t.p} y2={t.p} className="stroke-gray-100 dark:stroke-gray-800" />
              <text x={-8} y={t.p} dy="0.32em" textAnchor="end" className="fill-gray-400 text-[10px] tabular-nums">{fmtTick(t.v)}</text>
            </g>
          ))}
          {geo.xt.map(t => (
            <text key={`x${t.v}`} x={t.p} y={ih + 14} textAnchor="middle" className="fill-gray-400 text-[10px] tabular-nums">{fmtTick(t.v)}</text>
          ))}
          <line x1={0} x2={iw} y1={ih} y2={ih} className="stroke-gray-200 dark:stroke-gray-700" />
          <text x={iw / 2} y={ih + 32} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400 text-[11px]">{xLabel}</text>
          <text transform={`translate(${-40},${ih / 2}) rotate(-90)`} textAnchor="middle"
                className="fill-gray-500 dark:fill-gray-400 text-[11px]">{yLabel}</text>

          <line x1={geo.fit[0][0]} y1={geo.fit[0][1]} x2={geo.fit[1][0]} y2={geo.fit[1][1]}
                className="stroke-gray-400 dark:stroke-gray-500" strokeWidth={1.5} />
          {geo.dots.map(d => (
            <circle key={d.date} cx={d.px} cy={d.py} r={4} strokeWidth={2} opacity={hover && hover !== d ? 0.45 : 0.75}
                    className="fill-brand-600 dark:fill-brand-500 stroke-white dark:stroke-gray-900" />
          ))}
          {hover && (
            <circle cx={hover.px} cy={hover.py} r={6} strokeWidth={2}
                    className="fill-brand-600 dark:fill-brand-500 stroke-white dark:stroke-gray-900" />
          )}
          <rect x={0} y={0} width={Math.max(0, iw)} height={ih} fill="transparent" />
        </g>
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white/95 dark:bg-gray-900/95 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            top: Math.max(0, PAD.top + hover.py - 60),
            ...(hover.px > iw / 2 ? { right: width - PAD.left - hover.px + 12 } : { left: PAD.left + hover.px + 12 }),
          }}
        >
          <p className="text-gray-500 dark:text-gray-400">{formatDate(parseDay(hover.date))}</p>
          <p className="text-gray-900 dark:text-white tabular-nums">
            {meta(fy).label}: <span className="font-medium">{formatValue(fy, hover.rawY)}</span>
            <span className="text-gray-500 dark:text-gray-400"> ({signed(fy, hover.devY)} vs usual)</span>
          </p>
          <p className="text-gray-900 dark:text-white tabular-nums">
            {meta(fx).label}{lag ? ', day before' : ''}: <span className="font-medium">{formatValue(fx, hover.rawX)}</span>
            <span className="text-gray-500 dark:text-gray-400"> ({signed(fx, hover.devX)} vs usual)</span>
          </p>
        </div>
      )}
    </div>
  )
}
