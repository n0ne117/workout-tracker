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
