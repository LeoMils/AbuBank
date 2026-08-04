/*
 * Version-truth contract.
 *
 * Single visible-version source: src/version.ts → APP_VERSION.version.
 * Package.json carries the npm semver (a separate release lane); that string
 * must NOT appear in any UI surface — Leo must always see the build label, not
 * the legacy npm version. The npm semver is read DYNAMICALLY from package.json
 * below so this guard can never drift as the package version is bumped.
 * See docs/engineering-os/VERSION_CONTRACT.md for the two-lane contract.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { APP_VERSION } from './version'

const PROJECT_ROOT = path.resolve(__dirname, '..')

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf8')
}

const VISIBLE_UI_FILES = [
  'src/main.tsx',
  'src/App.tsx',
  'src/state/store.ts',
  'src/state/types.ts',
  'src/components/BottomBar/index.tsx',
  'src/screens/Home/index.tsx',
  'src/screens/Settings/index.tsx',
  'src/screens/Admin/index.tsx',
  'src/screens/AbuWhatsApp/index.tsx',
  'src/screens/AbuWhatsApp/familyQuickFaces.tsx',
  'src/screens/AbuWhatsApp/FamilyContactsSetup.tsx',
]

describe('APP_VERSION shape', () => {
  it('exposes version, buildLabel, buildDate, branchHint, commitHint', () => {
    expect(APP_VERSION.version).toBe('0.175.0-realtime-denial-dial-fn-plus-destructive-sweep-rc')
    expect(APP_VERSION.buildLabel).toBe('AbuBank 0.175.0 — DENIAL_DIAL_FALSE_NEGATIVE + DESTRUCTIVE_SWEEP (ADR-0001 §7/§12). Destructive/mutation sweep of the REAL adapter chain (control plane→kernel→orchestrator→controller) found CD-FN-001: the capability-denial monitor matched "לא יכולה להתקשר" but NOT "לא יכולה לחייג" (to dial), so the model could deny a READY call capability unchecked. Fixed by adding the dial verb to the denial set (mechanism, not phrase). New destructiveSweep.test.ts attacks stale/generation+revision rejection, cancel/replace WHILE a tool result is in flight, exactly-once across duplicate/reordered completion shapes, privacy of args/receipts, safe-label vs local-phone resolution, fallback/reconnect not reviving cancelled actions, greeting-once across reconnect, one canonical projection — each proven to die under an injected control-plane + truth-monitor mutation. Evidence: CODE+TEST (sweep+monitor+livePath 42; typecheck 0; full suite; build). PHYSICAL/live-provider/deployed-telemetry unchanged and still blocked. — TRUTHMONITOR_HEBREW_HARDENED (ADR-0001 §7/§16): certified the forward-Hebrew false-positive fix with 22 adversarial Hebrew variants (punctuation, ו/כ/ש prefixes, mixed clauses, questions, negation, capability-denial both ways) — real 1st-person fabricated completions still caught; test-only hardening over 0.173.0. — REALTIME_TRUTHMONITOR_FORWARD_HEBREW_FP (ADR-0001 §7/§16). Fixes two truth-monitor FALSE POSITIVES in normal forward Hebrew found by a production-convergence audit: (1) the "כבר…" completion group carried 2nd-person "שלחת" ("YOU sent"), so an assistant question like "כבר שלחת לו?" was wrongly flagged as a fabricated 1st-person completion and would trigger a nonsensical self-repair; (2) "דיברתי עם" lacked the "לא " negation guard every other completion verb had, so "לא דיברתי עם מור" over-blocked. Both now require the negation guard and count only first-person claims; positive fabrications ("כבר שלחתי", "דיברתי עם … והכל סודר") stay caught. Red-first regression tests added. Evidence: CODE + TEST (truthMonitor + realtimeLivePath + realtime slice green; typecheck 0; full suite 11940). PHYSICAL-ONLY unchanged. Builds on 0.172.0. — REALTIME_LIVE_FUNCTIONTOOL (ADR-0001 §12/§17-5). Wires the ACTUAL live WebRTC Realtime function-tool path behind ?voice=realtime2 (needs the realtime beta; OFF by default; certified brain-driven voice path unchanged). buildRealtimeSessionUpdate declares session.tools (prepare_whatsapp/prepare_call/replace_active_action/cancel_active_action) + tool_choice auto + create_response TRUE ONLY in slice mode; RealtimeVoiceSession routes a completed function_call (response.output_item.done / response.function_call_arguments.done / response.done) through realtimeFunctionBridge → RealtimeCommController → SessionOrchestrator (control plane commits, kernel resolves via the ONE buildCommunicationAction authority) → SAFE function_call_output (never a number/completion) + response.create → the model speaks grounded, guarded by the streaming truth monitor (fabricated completion / unsupported denial → repair next turn + incident). The committed ActiveActionViewModel renders the canonical in-session ActiveActionCard while the conversation stays live. Idempotent by model call_id; recipient/revision/generation on every receipt; atomic Call↔WhatsApp replace. FIX: the truth monitor no longer over-blocks a NEGATED completion ("לא נשלח") — a false-positive the live-path campaign caught. Evidence: CODE + TEST (realtime slice suite incl. a production-faithful RealtimeVoiceSession adapter journey via injected server events, tool schemas, event bridge, live controller, negation regression; typecheck 0; build green; full suite). PHYSICAL-ONLY: the real mic→model→tool→audio round-trip + Hebrew naturalness per §20 — not claimed. Builds on 0.170.0.')
    expect(typeof APP_VERSION.buildDate).toBe('string')
    expect(APP_VERSION.buildDate.length).toBeGreaterThan(0)
    expect(typeof APP_VERSION.branchHint).toBe('string')
    expect(APP_VERSION.branchHint.length).toBeGreaterThan(0)
    expect(typeof APP_VERSION.commitHint).toBe('string')
    expect(APP_VERSION.commitHint.length).toBeGreaterThan(0)
  })
})

describe('canonical version identity is single-sourced and health stays in sync', () => {
  it('api/health.ts BUILD_VERSION matches APP_VERSION.version (no manual drift)', () => {
    const health = readSrc('api/health.ts')
    const mVer = health.match(/const BUILD_VERSION = '([^']+)'/)
    const mLabel = health.match(/const BUILD_LABEL = '([^']+)'/)
    expect(mVer).not.toBeNull()
    expect(mLabel).not.toBeNull()
    expect(mVer![1]).toBe(APP_VERSION.version)
    expect(mLabel![1]).toBe(APP_VERSION.buildLabel)
  })

  it('buildDate and branchHint are not the known-stale placeholders', () => {
    expect(APP_VERSION.buildDate).not.toBe('2026-06-11')
    expect(APP_VERSION.branchHint).not.toBe('feat/calendar-revolution')
  })
})

// The npm semver is read live from package.json so this guard tracks the
// current value (e.g. 30.14.0) instead of a hardcoded literal that goes stale.
const NPM_SEMVER = (JSON.parse(readSrc('package.json')) as { version: string }).version

describe('no visible UI source hardcodes the npm semver', () => {
  it('the npm semver is a real semver string and differs from the visible build version', () => {
    expect(/^\d+\.\d+\.\d+/.test(NPM_SEMVER)).toBe(true)
    // The two version lanes are intentionally distinct (see VERSION_CONTRACT.md).
    expect(NPM_SEMVER).not.toBe(APP_VERSION.version)
  })
  for (const rel of VISIBLE_UI_FILES) {
    it(`${rel} does not include the npm semver "${NPM_SEMVER}"`, () => {
      const src = readSrc(rel)
      expect(src.includes(NPM_SEMVER)).toBe(false)
    })
  }
})

describe('store.appVersion is sourced from APP_VERSION (not VITE_APP_VERSION)', () => {
  const storeSrc = readSrc('src/state/store.ts')

  it('imports APP_VERSION', () => {
    expect(/from\s+['"]\.\.\/version['"]/.test(storeSrc)).toBe(true)
    expect(storeSrc.includes('APP_VERSION')).toBe(true)
  })

  it('initial state assigns appVersion: APP_VERSION.version', () => {
    expect(/appVersion:\s*APP_VERSION\.version/.test(storeSrc)).toBe(true)
  })

  it('does not fall back to import.meta.env.VITE_APP_VERSION for visible appVersion', () => {
    // VITE_APP_VERSION may still appear in vite-env.d.ts / vite.config.ts but
    // must not appear as the store.appVersion source any more.
    expect(/appVersion:\s*import\.meta\.env\.VITE_APP_VERSION/.test(storeSrc)).toBe(false)
  })
})

describe('visible UI surfaces show the new build version', () => {
  it('Home renders the QA build marker via APP_VERSION-derived appVersion', () => {
    const homeSrc = readSrc('src/screens/Home/index.tsx')
    expect(homeSrc.includes('home-qa-version')).toBe(true)
    expect(homeSrc.includes('QA: v')).toBe(true)
    // No more hardcoded git hash either.
    expect(homeSrc.includes('382e71f')).toBe(false)
  })

  it('Settings About panel still exposes APP_VERSION.buildLabel + version', () => {
    const settingsSrc = readSrc('src/screens/Settings/index.tsx')
    expect(settingsSrc.includes('settings-build-identity')).toBe(true)
    expect(settingsSrc.includes('APP_VERSION.buildLabel')).toBe(true)
    expect(settingsSrc.includes('APP_VERSION.version')).toBe(true)
  })

  it('AbuWhatsApp Martita-facing screen no longer surfaces the build version (clean header)', () => {
    // v0.4.x — the Martita header is now Title + Subtitle only. The build
    // version pill moved to operator-only surfaces.
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('abuwhatsapp-build-version')).toBe(false)
    // Operator setup still shows the build version (gated by ?operator=1).
    const setupSrc = readSrc('src/screens/AbuWhatsApp/FamilyContactsSetup.tsx')
    expect(setupSrc.includes('setup-build-version')).toBe(true)
    expect(setupSrc.includes('APP_VERSION.version')).toBe(true)
  })

  it('main.tsx logs APP_VERSION on startup', () => {
    const src = readSrc('src/main.tsx')
    expect(src.includes("console.info('[AbuBank Build]', APP_VERSION)")).toBe(true)
  })
})
