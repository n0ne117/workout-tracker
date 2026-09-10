import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import Dashboard from './pages/Dashboard'
import WorkoutDetail from './pages/WorkoutDetail'
import Races from './pages/Races'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Gear from './pages/Gear'
import GearDetail from './pages/GearDetail'
import Conqueror from './pages/Conqueror'
import RaceCalendar from './pages/RaceCalendar'
import RunLab from './pages/RunLab'
import More from './pages/More'

/**
 * One route tree for every screen size.
 *
 * This used to fork at 639px into two independent applications — `pages/`
 * for desktop and `mobile/` for phones — which drifted into showing
 * different numbers for the same workout and left phones unable to edit
 * gear, races or settings. Layout differences are now handled by CSS
 * breakpoints inside AppShell and the pages themselves, so there is exactly
 * one implementation of each screen.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/workouts/:id"  element={<WorkoutDetail />} />
          <Route path="/races"         element={<Races />} />
          <Route path="/stats"         element={<Stats />} />
          <Route path="/gear"          element={<Gear />} />
          <Route path="/gear/:id"      element={<GearDetail />} />
          <Route path="/conqueror"     element={<Conqueror />} />
          <Route path="/race-calendar" element={<RaceCalendar />} />
          <Route path="/runlab"        element={<RunLab />} />
          <Route path="/settings"      element={<Settings />} />
          <Route path="/more"          element={<More />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
