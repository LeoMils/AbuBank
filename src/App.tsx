import { useEffect, lazy, Suspense } from 'react'
import { useAppStore } from './state/store'
import { Screen, SCREEN_LABELS } from './state/types'
import { IMMUTABLE_DEFAULTS } from './state/defaults'
import { cancelNavigation } from './services/navigationService'
import { openService } from './services/navigationService'
import * as storageService from './services/storageService'
import * as adminService from './services/adminService'
import { Shell } from './components/Shell'
import { MoreModal } from './components/MoreModal'
import { UpdateToast } from './components/UpdateToast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSWUpdate } from './hooks/useSWUpdate'
// T7.1: Critical path — keep in main bundle
import { Home } from './screens/Home'
import { Opening } from './screens/Opening'
import { Offline } from './screens/Offline'
import { ErrorScreen } from './screens/Error'
// T7.1: Lazy-load heavy screens for faster initial load
const Admin = lazy(() => import('./screens/Admin').then(m => ({ default: m.Admin })))
const AbuAI = lazy(() => import('./screens/AbuAI').then(m => ({ default: m.AbuAI })))
const AbuWhatsApp = lazy(() => import('./screens/AbuWhatsApp').then(m => ({ default: m.AbuWhatsApp })))
const Settings = lazy(() => import('./screens/Settings').then(m => ({ default: m.Settings })))
const AbuGames = lazy(() => import('./screens/AbuGames').then(m => ({ default: m.AbuGames })))
const AbuWeather = lazy(() => import('./screens/AbuWeather').then(m => ({ default: m.AbuWeather })))
const AbuCalendar = lazy(() => import('./screens/AbuCalendar').then(m => ({ default: m.AbuCalendar })))
const FamilyGallery = lazy(() => import('./screens/FamilyGallery').then(m => ({ default: m.FamilyGallery })))
import styles from './App.module.css'

// T7.1: Loading fallback for lazy screens
function ScreenLoader() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#050A18', minHeight: '100dvh',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '3px solid rgba(212,184,122,0.20)',
        borderTopColor: '#D4B87A',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function renderScreen(currentScreen: Screen): JSX.Element | null {
  switch (currentScreen) {
    // Critical path — no Suspense needed (in main bundle)
    case Screen.Home:    return <ErrorBoundary><Home /></ErrorBoundary>
    case Screen.Opening: return <Opening />
    case Screen.Offline: return <Offline />
    case Screen.Error:   return <ErrorScreen />
    // T7.1: Lazy-loaded screens wrapped in Suspense
    case Screen.Admin:   return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><Admin /></ErrorBoundary></Suspense>
    case Screen.AbuAI:       return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><AbuAI /></ErrorBoundary></Suspense>
    case Screen.AbuWhatsApp: return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><AbuWhatsApp /></ErrorBoundary></Suspense>
    case Screen.Settings:    return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><Settings /></ErrorBoundary></Suspense>
    case Screen.AbuGames:    return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><AbuGames /></ErrorBoundary></Suspense>
    case Screen.AbuWeather:  return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><AbuWeather /></ErrorBoundary></Suspense>
    case Screen.AbuCalendar: return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><AbuCalendar /></ErrorBoundary></Suspense>
    case Screen.FamilyGallery: return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><FamilyGallery /></ErrorBoundary></Suspense>
    default:              return null
  }
}

export function App() {
  const currentScreen = useAppStore(s => s.currentScreen)
  const services = useAppStore(s => s.services)
  const isMoreModalOpen = useAppStore(s => s.isMoreModalOpen)
  const setMoreModalOpen = useAppStore(s => s.setMoreModalOpen)
  const setScreen = useAppStore(s => s.setScreen)
  const setOnline = useAppStore(s => s.setOnline)
  const lockAdmin = useAppStore(s => s.lockAdmin)
  const setServices = useAppStore(s => s.setServices)
  const setStorageMode = useAppStore(s => s.setStorageMode)
  const setAdminFirstBoot = useAppStore(s => s.setAdminFirstBoot)
  const setAdminInitComplete = useAppStore(s => s.setAdminInitComplete)
  const setInstallDismissed = useAppStore(s => s.setInstallDismissed)
  const { updateReady, applyUpdate } = useSWUpdate()

  // §9 lifecycle useEffect
  useEffect(() => {
    // INITIALIZATION — runs once, in this order
    // appVersion is already set in store initial state — not here.
    const init = async () => {
      // Step 1: load services from storage
      const r = await storageService.readServices()
      if (r.ok) {
        setServices(r.data)
        setStorageMode('persistent')
      } else {
        setServices([...IMMUTABLE_DEFAULTS])
        setStorageMode('volatile')
      }

      // Step 2: load admin first boot state
      // H1-FIX: ONLY set adminInitComplete after readAdminFirstBoot resolves
      const firstBoot = await adminService.readAdminFirstBoot()
      setAdminFirstBoot(firstBoot)
      setAdminInitComplete(true)

      // Step 3: restore install dismissal
      if (localStorage.getItem('abu-dismiss-v1')) setInstallDismissed(true)
    }
    init()

    // LIFECYCLE EVENTS
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // M2-FIX: called SEPARATELY — cancelNavigation does NOT call lockAdmin
        cancelNavigation()
        lockAdmin()
      }
    }

    const handlePageHide = () => {
      cancelNavigation()
    }

    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '')
      console.error('[AbuBank] Unhandled rejection:', msg)
      const { currentScreen, setError } = useAppStore.getState()
      setError(currentScreen, 'משהו לא עבד. לחצי לחזור הביתה.')
      setScreen(Screen.Error)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // freeze event — not all browsers support it
    if ('onfreeze' in document) {
      document.addEventListener('freeze', cancelNavigation)
    }

    // blur is NOT registered — reason in §3

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      if ('onfreeze' in document) {
        document.removeEventListener('freeze', cancelNavigation)
      }
    }
  }, [lockAdmin, setAdminFirstBoot, setAdminInitComplete, setInstallDismissed, setOnline, setScreen, setServices, setStorageMode])

  const ninthService = services[8] // type: ServiceConfig | undefined

  return (
    <>
      <Shell>
        {renderScreen(currentScreen)}
      </Shell>

      {isMoreModalOpen && ninthService && (
        <MoreModal
          service={ninthService}
          onClose={() => setMoreModalOpen(false)}
          onServiceTap={(id) => { setMoreModalOpen(false); openService(id) }}
        />
      )}

      {updateReady && <UpdateToast onUpdate={applyUpdate} />}

      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {SCREEN_LABELS[currentScreen]}
      </div>
    </>
  )
}
