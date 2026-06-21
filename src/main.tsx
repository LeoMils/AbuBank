import './design/tokens.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { App } from './App'
import { APP_VERSION } from './version'
import { durable } from './services/durableStore'

console.info('[AbuBank Build]', APP_VERSION)

// Dev-only self-heal: unregister any prior service worker so the Vite
// dev server is never shadowed by a stale production cache. Production
// PWA behavior is unaffected (this block is dead code in production
// builds — `import.meta.env.DEV` is statically false there).
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true
    && typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length === 0) return
    Promise.all(regs.map(r => r.unregister())).then(() => {
      console.info('[AbuBank Dev] Unregistered', regs.length, 'stale service worker(s). Reloading to clear cached UI.')
      // One reload after unregister so the freshly-served Vite modules take over.
      try { window.location.reload() } catch { /* nothing */ }
    })
  }).catch(() => { /* nothing — best-effort cleanup */ })
}

// Hydrate durable storage (migrate localStorage → IndexedDB, restore the
// localStorage mirror from IndexedDB so evicted appointments/reminders come
// back) BEFORE mounting, so the first read sees durable data. Best-effort:
// any failure degrades gracefully to the localStorage-only path.
async function boot() {
  try { await durable.init() } catch { /* best-effort; degrade to localStorage */ }
  const root = document.getElementById('root')
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  }
}
void boot()
