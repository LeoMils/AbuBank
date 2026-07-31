/*
 * Operator Mode — the ONE canonical gate for operator/diagnostics tools.
 * ─────────────────────────────────────────────────────────────────────
 * Replaces the several inconsistent checks (index.tsx isOperatorView,
 * AbuWhatsApp isOperatorQueryParam). Persistent so it survives navigation,
 * refresh, Safari relaunch and installed-PWA launches (whose start_url has no
 * query string):
 *   • ?operator=1  → enable + persist in localStorage.
 *   • ?operator=0  → disable + clear.
 *   • otherwise    → whatever was persisted (or dev).
 * Normal users never see operator tools (they never set the flag).
 */

const KEY = 'abu-operator'

function urlParam(): string | null {
  try {
    if (typeof window === 'undefined' || !window.location) return null
    return new URLSearchParams(window.location.search || '').get('operator')
  } catch { return null }
}

/** True when operator tools should be shown. Reads the URL param (which also
 *  persists/clears the flag) then falls back to the persisted value. */
export function isOperatorMode(): boolean {
  try {
    if (import.meta.env.DEV) return true
  } catch { /* env may be absent in some test contexts */ }
  const p = urlParam()
  if (p === '1') { setOperatorMode(true); return true }
  if (p === '0') { setOperatorMode(false); return false }
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'
  } catch { return false }
}

/** Explicitly enable/disable persistent operator mode (Settings toggle). */
export function setOperatorMode(on: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch { /* private mode / quota */ }
}

/** The persisted value only (ignores the URL + dev), for a Settings toggle's
 *  checked state so it reflects the durable setting. */
export function isOperatorPersisted(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1' }
  catch { return false }
}
