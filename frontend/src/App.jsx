import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useMobile } from './hooks/useMobile'
import MobileApp from './mobile/MobileApp'
import Layout from './components/Layout'
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

// Allow forcing desktop view via ?desktop=1 in URL
function forceDesktop() {
  if (typeof window === 'undefined') return false
  const p = new URLSearchParams(window.location.search)
  if (p.get('desktop') === '1') {
    // Persist for this session
    sessionStorage.setItem('forceDesktop', '1')
    // Clean up URL
    p.delete('desktop')
    const newUrl = window.location.pathname + (p.toString() ? '?' + p.toString() : '')
    window.history.replaceState({}, '', newUrl)
    return true
  }
  return sessionStorage.getItem('forceDesktop') === '1'
}

function DesktopApp() {
  return (
    <Layout>
      <Routes>
        <Route path="/"               element={<Dashboard />} />
        <Route path="/workouts/:id"   element={<WorkoutDetail />} />
        <Route path="/races"          element={<Races />} />
        <Route path="/stats"          element={<Stats />} />
        <Route path="/gear"           element={<Gear />} />
        <Route path="/gear/:id"       element={<GearDetail />} />
        <Route path="/conqueror"      element={<Conqueror />} />
        <Route path="/race-calendar"  element={<RaceCalendar />} />
        <Route path="/runlab"         element={<RunLab />} />
        <Route path="/settings"       element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  const isMobile = useMobile()
  const desktop  = forceDesktop()

  return (
    <BrowserRouter>
      {isMobile && !desktop ? <MobileApp /> : <DesktopApp />}
    </BrowserRouter>
  )
}
