import { useEffect, useState, lazy, Suspense } from 'react'
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
import { StaleBuildBanner } from './components/StaleBuildBanner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DiagnosticOverlay } from './components/DiagnosticOverlay'
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
const AbuBank = lazy(() => import('./screens/AbuBank').then(m => ({ default: m.AbuBank })))
const AbuNews = lazy(() => import('./screens/AbuNews').then(m => ({ default: m.AbuNews })))
const FamilyGallery = lazy(() => import('./screens/FamilyGallery').then(m => ({ default: m.FamilyGallery })))
const FamilyRecord = lazy(() => import('./screens/FamilyRecord').then(m => ({ default: m.FamilyRecord })))
const FamilyPhones = lazy(() => import('./screens/FamilyPhones').then(m => ({ default: m.FamilyPhones })))
import { matchFamilyPhonesRoute, FAMILY_PHONES_PATH } from './screens/FamilyPhones/familyPhonesImport'
// Milestone 1: the ISOLATED live-voice screen. Opened via ?live=1 as a top-level
// overlay (mirrors the FamilyPhones isolation) — it uses ONLY liveSession.ts and
// touches no existing screen or the legacy voice cascade.
const LiveScreen = lazy(() => import('./screens/Live/LiveScreen').then(m => ({ default: m.LiveScreen })))
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
    case Screen.AbuBank:     return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><AbuBank /></ErrorBoundary></Suspense>
    case Screen.AbuNews:     return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><AbuNews /></ErrorBoundary></Suspense>
    case Screen.FamilyGallery: return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><FamilyGallery /></ErrorBoundary></Suspense>
    case Screen.FamilyRecord: return <Suspense fallback={<ScreenLoader />}><ErrorBoundary><FamilyRecord /></ErrorBoundary></Suspense>
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

  // Private Family Phones page (/settings/family-phones). Path-based so it opens
  // DIRECTLY in iPhone Safari (Vercel SPA rewrite serves index.html; this detects
  // the path on mount). Rendered as a top-level overlay to avoid touching the Shell
  // and the Screen enum — zero risk to existing screens (incl. the voice work).
  const [familyPhonesOpen, setFamilyPhonesOpen] = useState<boolean>(() => {
    try { return matchFamilyPhonesRoute(window.location.pathname, window.location.hash) } catch { return false }
  })
  useEffect(() => {
    const check = () => {
      try { setFamilyPhonesOpen(matchFamilyPhonesRoute(window.location.pathname, window.location.hash)) } catch { /* */ }
    }
    window.addEventListener('popstate', check)
    window.addEventListener('hashchange', check)
    ;(window as unknown as { __abubankOpenFamilyPhones?: () => void }).__abubankOpenFamilyPhones = () => {
      try { window.history.pushState({}, '', FAMILY_PHONES_PATH) } catch { /* */ }
      setFamilyPhonesOpen(true)
    }
    return () => {
      window.removeEventListener('popstate', check)
      window.removeEventListener('hashchange', check)
      delete (window as unknown as { __abubankOpenFamilyPhones?: () => void }).__abubankOpenFamilyPhones
    }
  }, [])
  const closeFamilyPhones = () => {
    try { if (window.location.pathname === FAMILY_PHONES_PATH) window.history.pushState({}, '', '/') } catch { /* */ }
    setFamilyPhonesOpen(false)
  }

  // Abu AI live path — now the DEFAULT and only Abu AI. The home Abu AI tile opens
  // this overlay via the __abubankOpenLive global (no ?live=1 required anymore). The
  // ?live=1 URL is still honored as a harmless deep-link alias, but is no longer a
  // gate. The legacy AbuAI screen survives ONLY behind ?legacy=1 (see below).
  const readLiveParam = () => {
    try { return new URL(window.location.href).searchParams.get('live') === '1' } catch { return false }
  }
  const [liveOpen, setLiveOpen] = useState<boolean>(readLiveParam)
  useEffect(() => {
    const check = () => { if (readLiveParam()) setLiveOpen(true) }
    window.addEventListener('popstate', check)
    window.addEventListener('hashchange', check)
    // The one entry point: any tile/button opens the live path through this global,
    // mirroring __abubankOpenFamilyPhones / __abubankOpenDiag (no prop drilling
    // through the Suspense/lazy boundary).
    ;(window as unknown as { __abubankOpenLive?: () => void }).__abubankOpenLive = () => setLiveOpen(true)
    return () => {
      window.removeEventListener('popstate', check)
      window.removeEventListener('hashchange', check)
      delete (window as unknown as { __abubankOpenLive?: () => void }).__abubankOpenLive
    }
  }, [])
  const closeLive = () => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('live') === '1') { url.searchParams.delete('live'); window.history.pushState({}, '', url.pathname + url.search) }
    } catch { /* */ }
    setLiveOpen(false)
  }

  // Legacy AbuAI screen — DEPRECATED, kept reachable ONLY via ?legacy=1 (never from
  // the home tile). Routes the legacy Screen enum on mount so the old canned-string
  // cascade cannot be reached from the default route.
  useEffect(() => {
    try {
      if (new URL(window.location.href).searchParams.get('legacy') === '1') setScreen(Screen.AbuAI)
    } catch { /* */ }
  }, [setScreen])

  // Diagnostic/test affordance: ?screen=<Screen> renders any screen directly, so the screen-invariant
  // browser harness can verify EVERY screen (incl. state screens like Offline/Error) for render, RTL,
  // >=16px text, and no dev/QA text in a production build. Only a VALID Screen enum value is honoured
  // (junk is ignored); Admin is already tap-reachable, so this exposes nothing new.
  useEffect(() => {
    try {
      const want = new URL(window.location.href).searchParams.get('screen')
      if (want && (Object.values(Screen) as string[]).includes(want)) setScreen(want as Screen)
    } catch { /* */ }
  }, [setScreen])

  // P0.3 — app-wide diagnostic overlay. Visible whenever the user
  // navigates to ?diagnostics=1 / ?diagnostic=1 / #diagnostics, or when
  // any entry point (Settings top button, Home pill) opens it.
  const [diagOpen, setDiagOpen] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return false
      const url = new URL(window.location.href)
      if (url.searchParams.get('diagnostics') === '1' || url.searchParams.get('diagnostic') === '1') return true
      if (url.hash === '#diagnostics' || url.hash === '#diagnostic') return true
      return false
    } catch { return false }
  })
  useEffect(() => {
    function checkHash() {
      try {
        const url = new URL(window.location.href)
        const open = url.searchParams.get('diagnostics') === '1'
          || url.searchParams.get('diagnostic') === '1'
          || url.hash === '#diagnostics' || url.hash === '#diagnostic'
        if (open) setDiagOpen(true)
      } catch { /* nothing */ }
    }
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])
  useEffect(() => {
    // Expose a single global so any deeply-nested component (Settings
    // top button, Home pill) can request the overlay without prop
    // drilling through Suspense boundaries.
    ;(window as unknown as { __abubankOpenDiag?: () => void }).__abubankOpenDiag = () => setDiagOpen(true)
    return () => {
      delete (window as unknown as { __abubankOpenDiag?: () => void }).__abubankOpenDiag
    }
  }, [])

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
      <StaleBuildBanner />
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

      {diagOpen && <DiagnosticOverlay onClose={() => setDiagOpen(false)} />}

      {familyPhonesOpen && (
        <Suspense fallback={<ScreenLoader />}>
          <ErrorBoundary><FamilyPhones onClose={closeFamilyPhones} /></ErrorBoundary>
        </Suspense>
      )}

      {liveOpen && (
        <Suspense fallback={<ScreenLoader />}>
          <ErrorBoundary><LiveScreen onClose={closeLive} /></ErrorBoundary>
        </Suspense>
      )}

      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {SCREEN_LABELS[currentScreen]}
      </div>
    </>
  )
}
