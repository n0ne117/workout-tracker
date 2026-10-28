# Changelog

## 1.9.2

### Fixed

- **Indoor rides without a speed sensor still showed no charts.** Their only
  data is heart rate (sometimes cadence or power) over time, and the charts
  only knew how to plot against distance. Workouts without any distance now
  chart against elapsed time.

## 1.9.1

### Fixed

- **Indoor workouts came in with only their summary.** A treadmill run
  (or trainer ride, pool swim) has no GPS, and the importer only kept
  per-second data alongside GPS positions — so heart rate, pace, cadence
  and distance over time were thrown away. They are now kept, and the
  charts plot them against the recorded distance. FIT file imports had the
  same problem and are fixed too.
- To repair indoor workouts imported before this, run **Settings →
  Intervals.icu → Backfill** once; it now also fetches the missing data
  for workouts that have none.

## 1.9.0

### Added

- **A page per health metric.** Click a card at the top of the Health page
  (or a trend card's title) to see:
  - what the number means and what to look for,
  - latest, 7-day, usual and 1-year averages, plus your best and worst day,
  - **what stands out**: against three months ago and this time last year,
    how often you were in your usual range, what hard training does to it the
    next day, and your best and worst weekday,
  - the full history with your usual range shaded, monthly averages, and a
    weekday pattern.

## 1.8.0

### Changed

- **Health page: explanations and verdicts instead of "What moves
  together".**
  - Every metric says what it is, with what to look for behind the ⓘ
    button.
  - Values are judged against your own usual: **Better** (green) or
    **Worse** (red) where a direction is good for nearly everyone,
    plain higher/lower where it depends on your goal (weight). Changes
    within your normal day-to-day ups and downs count as "about usual".
  - New **This week vs your usual** summary: what moved this week, worse
    first.

### Fixed

- Info popovers (Health and RunLab) no longer run off the edge of a phone
  screen.

## 1.7.0

### Added

- **Health page.** Daily wellness from Intervals.icu — resting HR, HRV,
  sleep, weight, steps, VO2max, SpO2 and everything else it records, much of
  it from Apple Health — stored locally and shown as:
  - latest values against your 28-day average,
  - **what moves together**: the strongest relationships in the chosen range,
    in plain words, with every day behind each one as a scatter plot. Days
    are compared with your usual (4-week average), so slow drifts don't
    count, and "the day after" pairs show how training carries into the
    next day,
  - a trend per metric, each day plus the 7-day average,
  - every day as a table.
  
  The first sync after updating fetches your whole wellness history; after
  that every sync keeps it current. The page also has its own Import and
  Refresh buttons.

## 1.6.0

### Added

- **Backup progress.** The backup buttons now show what is happening:
  "Preparing" while the archive is built, then a progress bar with the size
  while it downloads, then the saved file name.
- **The workout list updates after a sync.** When Sync finds new workouts,
  the list reloads by itself, keeping your filters.

## 1.5.2

### Fixed

- **TCX imports had no heart rate or cadence.** A parser quirk treated every
  reading as missing. Files imported from now on keep them; workouts already
  imported from TCX need re-importing to get them.
- **The gear picker could miss gear added a moment ago** on the Gear page or
  restored from a backup.
- **Gear detail kept the previous item's activities** when moving straight
  from one gear item to another.
- **RunLab's "today" lagged behind** for the first hour or two after midnight.
- **The health check said "ok" even when nothing could be saved**, for
  example with an unwritable data folder. Docker now sees it as unhealthy.

### Changed

- Backend tests now live in the repository and run before every release; a
  failing test stops the image from being built.

## 1.5.1

### Fixed

- **Leaving Settings during an import left its progress poller running.**
  Every visit added another one. They now stop with the page, and the
  metrics backfill progress picks up again when you come back, as the
  import progress already did.
- **With the server unreachable, pages looked empty instead of broken.**
  Races, Stats and others showed "nothing yet". A banner now says the
  server can't be reached and disappears once it answers again.

### Changed

- Dependencies updated within their current major versions: FastAPI,
  Starlette, uvicorn, SQLAlchemy, pydantic, Vite, PostCSS. The frontend
  now builds on Node 22, and the release workflow uses current action
  versions.

## 1.5.0

**Before updating:** take a backup, and make sure `TZ` is set to your
timezone. On first start this version converts the start times of
file-imported workouts (see below), once, using `TZ`. With `TZ` unset or
UTC nothing is converted.

### Fixed

- **A new workout could show a deleted one's training data.** Deleting a
  workout left its metrics row behind, and SQLite gives the freed id to the
  next workout, which then showed someone else's HR zones and training load.
  Deletes now remove metrics too, and leftover rows are cleaned up on start.
- **Restore lost data.** A workouts-only restore dropped every gear link, no
  backup included metrics, and the dashboard showed pre-restore numbers until
  the next change. Backups now carry metrics and gear links, and restoring an
  old backup without links says so instead of failing silently.
- **File imports were stored in UTC.** Everything else is local time, so FIT,
  GPX, TCX and KML workouts showed hours off and never matched their
  Intervals.icu copy. New imports are converted (FIT uses the watch's own
  offset), existing ones are converted once on start, and re-uploading a
  workout that is already stored is refused. Converted workouts that match an
  Intervals copy now show up under "Duplicates only".
- **Off-by-one dates.** The default month in the list and the Stats heatmap
  were a day early for anyone east of UTC.
- **Search results could arrive out of order** and show matches for an
  earlier, shorter search term.
- **Large backups could not be restored.** Uploads over 100 MB failed with
  "Unexpected token '<'"; the restore limit is now 2 GB.
- **Google Earth KML tracks** were rejected as having no track.

### Security

- Any web page open in a browser on the same network could read or delete
  the data, because the API allowed every origin. Cross-origin access is now
  off (opt in with `CORS_ORIGINS`), and writes from another site are refused.

### Changed

- The gear activity list and race predictions no longer load GPS tracks they
  never show.
- The release image is smoke-tested before it is published, and `:latest`
  only moves for the newest stable version.
- Removed the unused Garmin Connect code, six unused Python packages and the
  old two-container build files. `npm run dev` proxies to `localhost:8000`
  again (`VITE_API_TARGET` to change it).

## 1.4.2

### Fixed

- **Expanding a collapsed year or month took two clicks.** The displayed state
  falls back to a default when nothing is stored, but the toggle flipped the
  *stored* value — so for a group with no entry yet, the first click wrote
  "collapsed" onto something already showing as collapsed and nothing moved.
  Only the second click expanded it. Collapsing was unaffected, which is why it
  looked like a double-click was needed one way but not the other. The toggle
  now flips what is actually on screen.

## 1.4.1

### Added

- **GPS marker in the workout list.** A small pin beside the title on any
  activity carrying a track. Not decoration — 380 of 1,664 activities have no
  track at all, and legitimately so: every indoor session, most pool swims,
  anything logged without a watch. It also settles which row to keep when
  clearing duplicates, since the re-imported copy usually arrives without its
  track. Of the 157 rows in the duplicates view, 75 have a track and 82 do not.

## 1.4.0

### Added

- **Select workouts from the list, and act on them together.** A Select button
  puts checkboxes on every row; an action bar then offers mark as race, remove
  the race flag, download, and delete.
  - Shift-click fills the range between two rows, and the header checkbox takes
    everything currently on screen — collapsed months are deliberately excluded,
    since sweeping up rows you cannot see is how bulk tools cause accidents.
  - Changing a filter clears the selection, for the same reason.
  - Delete asks first and names the count. It is the only irreversible action
    here, and it removes gear links alongside the workouts so none are orphaned.
  - On phones the checkbox appears on each card and tapping the card selects
    rather than opening it.
- **Download selected** produces a zip with `workouts.json` and a `.gpx` per
  workout that has a GPS track — heart rate and cadence included in Garmin's
  TrackPointExtension, so the tracks load into other tools. This is an export,
  not a restore point: restoring replaces the entire database.
- `PATCH /api/workouts/bulk`, `POST /api/workouts/bulk/delete` and
  `POST /api/workouts/bulk/export`, capped at 2000 ids per call.

## 1.3.0

### Added

- **"Duplicates only" filter.** Shows every activity that shares a start time
  and sport with another — the same rule the importer enforces, read from one
  module so the filter and the guard cannot disagree. Switching it on clears
  the date range, since the list opens on the current month and duplicates are
  a whole-history hunt. Combines with the sport and date filters for working
  through them in batches.

## 1.2.1

### Added

- **Start time in the workout list.** Duplicate imports share a timestamp, so
  showing it lines them up as visibly identical adjacent rows.

### Fixed

- **The importer created duplicate workouts.** Intervals.icu can hold several
  records for one physical activity — a re-upload, a re-sync, a re-processed
  copy — each with its own id. Matching on that id alone imported every one
  as a separate workout: a single swim on 8 September became four rows, and a
  2015 ride exists three times with identical start and duration but distances
  of 19.3, 23.3 and 23.3 km. Imports now also reject an activity whose start
  time and sport match something already stored, which two genuinely different
  activities cannot do. Verified against real data: the same sync that
  previously added 8 rows now imports 3 genuinely new ones and skips 39.

  This mattered more with 1.2.0's scheduled sync, which would otherwise have
  accumulated duplicates unattended. Existing duplicates are untouched — 61
  rows across 51 groups, inflating totals by roughly 337 km.

## 1.2.0

### Added

- **Scheduled Intervals.icu sync.** A background task pulls new activities on
  its own, hourly by default. Configure it under Settings → Automatic sync:
  on/off, interval (15 min to daily), and how far back each run looks.
  The scheduler wakes once a minute and asks whether a run is due rather than
  sleeping for the whole interval, so a changed setting takes effect at once
  and a restart doesn't lose the schedule — the last-run time lives in the
  database. Intervals below 5 minutes are refused: an import takes longer
  than that, so they would only overlap.
- `PATCH /api/intervals/schedule`; the existing status endpoint now reports
  the schedule and the last run's outcome.

### Fixed

- **The workout list claimed every activity had a GPS track.** A workout
  without one stores JSON `null`, which SQLite holds as the 4-character text
  `"null"` — the length check used to resolve `has_track` counted that as a
  track, so the list disagreed with the detail view on 380 of 1,664
  activities. It now asks `json_type()` instead.

### Changed

- The Sync button and the scheduler share one code path, so they cannot drift
- Challenge prices (`cost_eur`) dropped from the schema — they were never
  shown in the UI. Existing databases lose the column on upgrade; a seed file
  that still carries it loads fine, the field is simply ignored

## 1.1.0

First published release. The mobile and desktop interfaces are now one
responsive app, and a single Docker image replaces the two-container setup.

### Added

- **All-in-one Docker image** at `ghcr.io/n0ne117/workout-tracker` — nginx
  serves the SPA and proxies `/api` to uvicorn on loopback. One port (80),
  one volume (`/data`). Optional `PUID`/`PGID` drop the API process off root
  so files on an array aren't left root-owned
- **Week / month / year summary** on the Statistics page, at every screen size
- `DATA_DIR` and `DATABASE_URL` environment variables
- Unraid template, README and this changelog

### Changed

- **One responsive interface.** The app used to fork at 639px into two
  independent trees — `pages/` for desktop, `mobile/` for phones. They had
  drifted far enough to disagree about the same workout, and phones couldn't
  edit gear, races or settings at all. There is now one route tree and one
  implementation of each screen, with a bottom tab bar on phones and a full
  header nav from `md` up
- `utils/sports.js` is the single source of sport labels, icons, colours and
  units, replacing three drifted tables
- Statistics reports `total_moving_hours` alongside `total_elapsed_hours`
  (was `total_duration_hours`); per-sport and per-period buckets likewise
  expose `moving_hours` and `elapsed_hours`
- `DELETE /api/workouts` requires `?confirm=true`
- Challenge seeding reads `/data/challenges_seed.json` instead of a hardcoded
  list, keeping personal purchase history out of the source tree
- Replaced the deprecated `on_event("startup")` hook with a lifespan handler

### Fixed

- **Pace and speed came from elapsed time in the mobile view.** An 8 km walk
  with 7h24m elapsed and 1h31m moving read 54:59/km on a phone and 11:21/km
  on desktop. Every rate now derives from moving time through one helper
- **Each sport gets its own unit.** Cycling records read km/h instead of
  "2:00/km", swims read min/100m, and swims in the workout list no longer
  showed an elevation figure in the pace column
- **`date_to` filters dropped the final day.** A bare date parsed to midnight,
  so `<= date_to` excluded everything recorded later that day — a September
  range returned 14 of 16 activities. Affected the phone statistics view daily
- **The "Moving Time" total was elapsed time** — 1,249 h shown against 969 h
  actual, a 29% overstatement
- **GPS noise appeared as personal records.** A 52 m swim logging 2,333 m of
  climb was the swimming elevation record; an 82 m row had a "best pace" of
  2h20m/km. Records are now guarded by distance, duration and grade
- **Heart-rate chart peaks were under-reported.** Summary stats read the max
  of an every-Nth downsample, so a stored 142 bpm rendered as 136. Stats now
  use the full series; only the drawn line is downsampled
- The pace chart labelled a median as "avg"
- Gear wear hours used elapsed time, inflating every service limit
- `allow_credentials` no longer pairs with a wildcard CORS origin, a
  combination browsers reject outright

### Performance

- `GET /api/workouts` loaded the `track_points` blob for every row and then
  stripped it from the response. Deferred, with `has_track` resolved in one
  indexed query: **500 rows went from 2.05 s to 0.19 s**

### Removed

- Roughly 1,900 lines of dead and duplicated code: the entire `mobile/` tree,
  three unused chart modules, `WorkoutCard`, `StatsBar`, `ImportModal` and
  `utils/constants.js`
- Empty `nginx/` and `data/` directories left over from an earlier layout
