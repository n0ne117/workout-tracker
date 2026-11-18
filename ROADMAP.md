# Roadmap

Planned work that isn't scheduled yet. Shipped changes live in
[CHANGELOG.md](CHANGELOG.md).

## Planned

### Import strength sets instead of typing them

Strength sessions (1.10.0) are entered by hand, but the sets are already
recorded elsewhere — Hevy and the Garmin Fenix both log exercise, weight and
reps. Importing them would remove the double entry. Three possible sources:

- **Garmin FIT via Intervals.icu** — the likely first choice. Intervals.icu
  keeps the original FIT file, which the importer already downloads for its GPS
  fallback, and Garmin strength FITs carry one message per set. Needs neither a
  Hevy subscription nor the Garmin API. Main work: mapping Garmin's exercise
  categories onto the German catalog. Covers sessions logged on the watch.
- **Hevy API** — complete data, but requires a Hevy Pro subscription.
- **Garmin personal API** — available, not in use yet.

## Deliberately deferred

- **Tailwind 4 and Vite 8** — together, as one release. Tailwind 4 moves its
  configuration into CSS and changes defaults (border colours, shadow and ring
  sizes, the custom gray palette behind dark mode), so every page needs a visual
  check. Clears the remaining `npm audit` warnings, all in build-time tooling
  that never ships in the image. (React 19 and React Router 7 landed in 1.12.0.)
- **lucide-react 1.x** — icons only, with renames to chase; no gain yet.
