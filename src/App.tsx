import { useEffect } from 'react'
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
import { Home } from './screens/Home'
import { Opening } from './screens/Opening'
import { Offline } from './screens/Offline'
import { ErrorScreen } from './screens/Error'
import { Admin } from './screens/Admin'
import { AbuAI } from './screens/AbuAI'
import { AbuWhatsApp } from './screens/AbuWhatsApp'
import { Settings } from './screens/Settings'
import { AbuGames } from './screens/AbuGames'
import { AbuWeather } from './screens/AbuWeather'
import { AbuCalendar } from './screens/AbuCalendar'
import styles from './App.module.css'

function renderScreen(currentScreen: Screen): JSX.Element | null {
  switch (currentScreen) {
    case Screen.Home:    return <ErrorBoundary><Home /></ErrorBoundary>
    case Screen.Opening: return <Opening />
    case Screen.Offline: return <Offline />
    case Screen.Error:   return <ErrorScreen />
    case Screen.Admin:   return <Admin />
    case Screen.AbuAI:       return <ErrorBoundary><AbuAI /></ErrorBoundary>
    case Screen.AbuWhatsApp: return <ErrorBoundary><AbuWhatsApp /></ErrorBoundary>
    case Screen.Settings:    return <Settings />
    case Screen.AbuGames:    return <ErrorBoundary><AbuGames /></ErrorBoundary>
    case Screen.AbuWeather:  return <ErrorBoundary><AbuWeather /></ErrorBoundary>
    case Screen.AbuCalendar: return <ErrorBoundary><AbuCalendar /></ErrorBoundary>
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

    const handleUnhandledRejection = () => {
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
