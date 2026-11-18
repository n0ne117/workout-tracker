import clsx from 'clsx'

/**
 * Pick an exercise's muscle groups: tap once for "main", again for
 * "assists", a third time to clear. Main groups count fully in the muscle
 * split, assisting ones half.
 */
export default function MuscleGroupPicker({ groups, primary, secondary, onChange }) {
  function cycle(g) {
    if (primary.includes(g)) onChange({ primary: primary.filter(x => x !== g), secondary: [...secondary, g] })
    else if (secondary.includes(g)) onChange({ primary, secondary: secondary.filter(x => x !== g) })
    else onChange({ primary: [...primary, g], secondary })
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {groups.map(g => {
          const state = primary.includes(g) ? 'main' : secondary.includes(g) ? 'assist' : null
          return (
            <button key={g} type="button" onClick={() => cycle(g)}
                    className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      state === 'main' && 'bg-brand-600 border-brand-600 text-white',
                      state === 'assist' && 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/30 dark:border-brand-700 dark:text-brand-300',
                      !state && 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400')}>
              {g}{state === 'assist' && ' ·½'}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">Tap: main group → assists (counts half) → off</p>
    </div>
  )
}
