/*
 * gen-build-flags.mjs — emit public/build-flags.json at build time so the DEPLOYED build's flag
 * states are MACHINE-VERIFIABLE from the URL. This is the durable fix for "a fix that ships
 * disabled is a fix that does not exist": the owner (and a probe) can fetch /build-flags.json and
 * see exactly which capabilities are ON in the specific build being tested — no more guessing why
 * 9/9 tool calls had a preamble.
 *
 * ENV-gated (VITE_LIVE_*) flags are read from process.env at build (Vercel injects them). CODE-default
 * flags are mirrored from source with a test (buildFlags.test.ts) asserting they match, so this file
 * cannot silently drift from the real constants. Runs in `build` before `vite build`.
 */
import fs from 'node:fs'

const on = (v) => v === '1' || v === 'true'
const env = process.env

// ENV-gated client flags (default OFF; a deployment turns them on at build).
const envFlags = {
  LIVE_PREAMBLE_TWO_RESPONSE: on(env.VITE_LIVE_PREAMBLE_TWO_RESPONSE),
  LIVE_AUDIO_TUNE_V2: on(env.VITE_LIVE_AUDIO_TUNE_V2),
  LIVE_BARGE_IN_TRUNCATE: on(env.VITE_LIVE_BARGE_IN_TRUNCATE),
  LIVE_PREFETCH_WARM: on(env.VITE_LIVE_PREFETCH_WARM),
  LIVE_CLASSIFIED_MONITOR: on(env.VITE_LIVE_CLASSIFIED_MONITOR),
}

// CODE-default flags (defined in source; mirrored here, asserted by buildFlags.test.ts). These are
// the values shipped unless a future source edit changes them — the test catches drift.
const codeFlags = {
  LIVE_OUTPUT_MONITOR_REPAIR: true,   // src/services/liveSession.ts
  LIVE_INTERRUPT_RESPONSE: false,     // src/services/liveSession.ts (correct permanent default)
  ONLINE_GENERAL_SEARCH: true,        // src/services/online/flags.ts
}

// Read the visible app version without importing TS.
let version = 'unknown'
try {
  const v = fs.readFileSync('src/version.ts', 'utf8').match(/version:\s*'([^']+)'/)
  if (v) version = v[1]
} catch { /* leave unknown */ }

const manifest = {
  version,
  generatedBy: 'scripts/gen-build-flags.mjs',
  note: 'Effective flag states in THIS build. env-gated flags come from the build env; code flags mirror source (buildFlags.test.ts asserts no drift).',
  env: envFlags,
  code: codeFlags,
}

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('public/build-flags.json', JSON.stringify(manifest, null, 2) + '\n')
const onList = [...Object.entries(envFlags), ...Object.entries(codeFlags)].filter(([, v]) => v).map(([k]) => k)
console.log(`[build-flags] v${version} · ON: ${onList.join(', ') || '(none)'} · wrote public/build-flags.json`)
