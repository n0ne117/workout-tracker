import clsx from 'clsx'
import { sportIconComponent, sportSolidClass, sportDotClass, sportLabel } from '../utils/sports'

/**
 * The one way to draw a sport.
 *
 * Replaces three drifted implementations: emoji glyphs on desktop, lucide
 * icons on mobile, and an unused set of 12×12 pixel-art sprites. Every sport
 * in the backend's SPORT_CATEGORIES is covered.
 *
 * variant:
 *   'circle' → white glyph on the sport's solid colour (feed rows, headers)
 *   'plain'  → glyph tinted with the sport's colour (dense tables, inline)
 */
export default function SportIcon({
  sport,
  size = 20,
  variant = 'circle',
  className = '',
  title,
}) {
  const Icon = sportIconComponent(sport)
  const label = title ?? sportLabel(sport)

  if (variant === 'plain') {
    return (
      <Icon
        size={size}
        aria-label={label}
        className={clsx(sportDotClass(sport), className)}
      />
    )
  }

  // Circle scales with the glyph so callers only pass one number.
  const box = Math.round(size * 1.9)
  return (
    <span
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex items-center justify-center rounded-full flex-shrink-0',
        sportSolidClass(sport),
        className,
      )}
      style={{ width: box, height: box }}
    >
      <Icon size={size} className="text-white" strokeWidth={2} />
    </span>
  )
}
