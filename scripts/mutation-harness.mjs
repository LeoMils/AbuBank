#!/usr/bin/env node
/*
 * Mutation harness — Phase M of the TOTAL QA run (docs/warroom/).
 *
 * "The test of the tests." A green suite proves nothing about defect-catching
 * power until you inject a real defect and confirm a test turns red. This harness
 * injects one deliberate bug at a time into a DETERMINISTIC guard, runs ONLY the
 * owning test file, and records whether the bug was KILLED (a test failed) or
 * SURVIVED (all tests still passed = a missing test = a liability).
 *
 * Safety: the original file content is restored in a finally block for every
 * mutant, so the working tree is never left mutated even if a run throws or is
 * killed. Each mutant self-validates that its anchor string occurs EXACTLY once
 * before mutating; a stale anchor is reported, never silently skipped.
 *
 * Scope: deterministic guards only. Model-instruction P0s (distress, warmth) are
 * verified by the key-gated companion suite, NOT here — see docs/warroom/OPEN.md O2.
 *
 * Run: node scripts/mutation-harness.mjs
 * Add mutants by appending to MUTANTS. `expect: 'kill'` = a real bug the suite
 * MUST catch. `expect: 'survive'` = a harmless negative control proving the
 * harness can tell the difference (if a control is "killed", the harness lies).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const R = (p) => join(ROOT, p)

/** Each mutant: a single, surgical, deterministic bug + the test that owns it. */
const MUTANTS = [
  {
    id: 'phone-not-redacted', layer: 'A/Platform', severity: 'P0',
    desc: 'PII phone mask disabled — a phone number would survive redaction',
    file: 'src/evolution/redaction.ts',
    find: "cls: 'phone', mask: '[phone]'",
    replace: "cls: 'phone', mask: '[LEAK]'",
    owner: 'src/evolution/redaction.test.ts', expect: 'kill',
  },
  {
    id: 'email-not-redacted', layer: 'A/Platform', severity: 'P1',
    desc: 'PII email mask disabled',
    file: 'src/evolution/redaction.ts',
    find: "cls: 'email', mask: '[email]'",
    replace: "cls: 'email', mask: '[LEAK]'",
    owner: 'src/evolution/redaction.test.ts', expect: 'kill',
  },
  {
    id: 'secret-not-removed', layer: 'A/Platform', severity: 'P0',
    desc: 'Secret scrubbing disabled — a Bearer/api key would be kept',
    file: 'src/evolution/redaction.ts',
    find: "return '[secret-removed]'",
    replace: "return '[kept]'",
    owner: 'src/evolution/redaction.test.ts', expect: 'kill',
  },
  {
    id: 'granddaughter-wrong-gender', layer: 'A/Brain', severity: 'P0',
    desc: 'Feminine grandchild term swapped to masculine (Ofir is female)',
    file: 'src/screens/AbuAI/familyRelationEngine.ts',
    find: "grandchild:        ['נכדה', 'נכד'],",
    replace: "grandchild:        ['נכד', 'נכדה'],",
    // Owner was ofirGenderRegression (gender DATA only) — it SURVIVED this in Run 1.
    // familyRelationLabelGender guards the OUTPUT label and kills it. See warroom LOG.
    owner: 'src/screens/AbuAI/familyRelationLabelGender.test.ts', expect: 'kill',
  },
  {
    id: 'yesterday-becomes-tomorrow', layer: 'A/Brain', severity: 'P1',
    desc: 'Date reasoning bug — אתמול (yesterday) resolves to +1 day',
    file: 'src/screens/AbuAI/dateParser.ts',
    find: 'd.setDate(d.getDate() - 1)',
    replace: 'd.setDate(d.getDate() + 1)',
    owner: 'src/screens/AbuAI/dateParser.test.ts', expect: 'kill',
  },
  {
    id: 'online-honesty-gate-disabled', layer: 'A/Brain·Online', severity: 'P0',
    desc: 'NO TOOL RESULT = NO CLAIM: zero-source honesty gate disabled — a fabricated ungrounded answer would surface as ok:true (the World Cup incident)',
    file: 'api/abuai-online.ts',
    find: 'if (sources.length === 0) {',
    replace: 'if (sources.length < 0) {',
    owner: 'src/eval/onlineGroundingGate.test.ts', expect: 'kill',
  },
  {
    id: 'israeli-id-not-redacted', layer: 'A/Platform·Privacy', severity: 'P1',
    desc: 'Israeli-ID (9-digit) PII mask disabled — an ID would survive redaction',
    file: 'src/evolution/redaction.ts',
    find: "cls: 'israeli_id', mask: '[id]'",
    replace: "cls: 'israeli_id', mask: '[LEAK]'",
    owner: 'src/evolution/redaction.test.ts', expect: 'kill',
  },
  // ── Layer B · App (deterministic guards with jsdom/unit owners) ──
  {
    id: 'app-touch-target-40', layer: 'B/App·SeniorUX', severity: 'P1',
    desc: 'Minimum touch target dropped 56px→40px (below the senior-first floor; MIN_TOUCH feeds Card + PrimaryButton)',
    file: 'src/design/space.ts',
    find: 'export const MIN_TOUCH = 56',
    replace: 'export const MIN_TOUCH = 40',
    owner: 'src/design/seniorFirst.test.ts', expect: 'kill',
  },
  {
    id: 'app-body-text-12', layer: 'B/App·SeniorUX', severity: 'P1',
    desc: 'Minimum body text dropped 16px→12px (below readable floor for 80+)',
    file: 'src/design/space.ts',
    find: 'export const MIN_BODY_PX = 16',
    replace: 'export const MIN_BODY_PX = 12',
    owner: 'src/design/seniorFirst.test.ts', expect: 'kill',
  },
  {
    id: 'app-calendar-drop-title-on-save', layer: 'B/App·DataIntegrity', severity: 'P0',
    desc: 'Calendar save silently drops the title field — data loss on persist (B4 round-trip)',
    file: 'src/screens/AbuCalendar/service.ts',
    find: 'durable.setString(STORAGE_KEY, JSON.stringify(appts))',
    replace: 'durable.setString(STORAGE_KEY, JSON.stringify(appts.map(({ title, ...rest }) => rest)))',
    owner: 'src/screens/AbuCalendar/calendarPersistence.test.ts', expect: 'kill',
  },
  {
    id: 'second-voice-engine-reintroduced', layer: 'B/App·OneVoiceEngine', severity: 'P0',
    desc: 'D7 one-voice-engine guard: a getUserMedia capture is reintroduced into the AbuCalendar screen (a second speech engine) — singleVoiceEntry must turn red',
    file: 'src/screens/AbuCalendar/index.tsx',
    find: 'aria-label="לדבר עם Abu כדי להוסיף אירוע"',
    replace: 'aria-label="לדבר עם Abu כדי להוסיף אירוע" /* navigator.mediaDevices.getUserMedia reintroduced */',
    owner: 'src/screens/AbuCalendar/singleVoiceEntry.test.ts', expect: 'kill',
  },
  // ── Layer D · Journeys (end-to-end handoffs) ──
  {
    id: 'journey-whatsapp-handoff-drops-message', layer: 'D/Journey', severity: 'P1',
    desc: 'card→WhatsApp handoff: the composed message is not passed to the wa.me link (Martita taps Send and the text is missing)',
    file: 'src/services/liveActionCards.ts',
    find: 'const { url, reason } = handoff(recipient, message)',
    replace: "const { url, reason } = handoff(recipient, '')",
    owner: 'src/services/liveActionCards.test.ts', expect: 'kill',
  },
  {
    id: 'journey-confirm-two-events', layer: 'D/Journey', severity: 'P0',
    desc: 'confirm→two-events: exactly-once dedup by call id disabled — the same calendar confirm creates the event twice',
    file: 'src/screens/AbuAI/realtime/calendarDraftController.ts',
    find: 'if (cached) return cached',
    replace: 'if (cached && false) return cached',
    owner: 'src/screens/AbuAI/realtime/calendarRuntimeIntegration.test.ts', expect: 'kill',
  },
  // ── Layer C · Platform ──
  {
    id: 'platform-stale-bundle-undetected', layer: 'C/Platform·PWA', severity: 'P1',
    desc: 'SW/stale-bundle detection broken — a new deployed version is NOT detected as stale, so the device serves old code forever',
    file: 'src/services/versionSync.ts',
    find: 'const stale = c !== s',
    replace: 'const stale = c === s',
    owner: 'src/services/versionSync.test.ts', expect: 'kill',
  },
  // NOTE: the idle-timeout session-lifecycle mutant (12s stop-streaming / 25s ask-once /
  // 45s warm-goodbye) is NOT seeded — no deterministic module/constants exist for it
  // (IDLE_RUNTIME is a cognitive-runtime state, responseLifecycle is audio-state only).
  // That absence is a real feature gap, tracked in OPEN.md O-LIFECYCLE — see docs/warroom.
  // ── Layer C · Platform · Session lifecycle (O-LIFECYCLE) ──
  {
    id: 'lifecycle-closes-mid-task', layer: 'C/Platform·Lifecycle', severity: 'P0',
    desc: 'never-close-mid-task law removed — an idle session would close/interrupt while a task is in flight',
    file: 'src/services/sessionLifecycle.ts',
    find: "if (i.midTask) return { action: 'none', closes: false }",
    replace: "if (false) return { action: 'none', closes: false }",
    owner: 'src/services/sessionLifecycle.test.ts', expect: 'kill',
  },
  {
    id: 'lifecycle-goodbye-does-not-close', layer: 'C/Platform·Lifecycle', severity: 'P1',
    desc: 'warm goodbye no longer closes the session — an idle session keeps streaming (cost + confusion)',
    file: 'src/services/sessionLifecycle.ts',
    find: "return { action: 'warm-goodbye', speak: GOODBYE_HE, closes: true }",
    replace: "return { action: 'warm-goodbye', speak: GOODBYE_HE, closes: false }",
    owner: 'src/services/sessionLifecycle.test.ts', expect: 'kill',
  },
  // ── Negative control: a comment edit that changes NO behavior. MUST survive. ──
  {
    id: 'control-comment-noop', layer: 'control', severity: 'control',
    desc: 'Harmless comment edit — proves the harness distinguishes kill vs survive',
    file: 'src/evolution/redaction.ts',
    find: '// ── PII patterns (masked, not deleted — we keep the SHAPE for debugging) ─────',
    replace: '// PII patterns (control-mutant marker; behavior unchanged)',
    owner: 'src/evolution/redaction.test.ts', expect: 'survive',
  },
]

function runOwner(owner) {
  // vitest exit 0 = all pass (mutant SURVIVED); non-zero = a test failed (KILLED).
  try {
    execSync(`npx vitest run ${owner} --reporter=dot`, {
      cwd: ROOT, stdio: 'pipe', timeout: 180000,
    })
    return 'survived'
  } catch {
    return 'killed'
  }
}

const results = []
for (const m of MUTANTS) {
  const path = R(m.file)
  const original = readFileSync(path, 'utf8')
  const occurrences = original.split(m.find).length - 1
  if (occurrences !== 1) {
    results.push({ ...m, status: 'ANCHOR_STALE', note: `anchor found ${occurrences}× (need exactly 1)` })
    console.log(`⚠️  ${m.id}: ANCHOR_STALE (${occurrences}×) — mutant skipped, not applied`)
    continue
  }
  try {
    writeFileSync(path, original.replace(m.find, m.replace), 'utf8')
    const outcome = runOwner(m.owner)          // 'killed' | 'survived'
    const ok = outcome === m.expect || (m.expect === 'kill' && outcome === 'killed')
    const verdict = m.expect === 'survive'
      ? (outcome === 'survived' ? 'CONTROL_OK' : 'HARNESS_BROKEN')
      : (outcome === 'killed' ? 'KILLED' : 'SURVIVED')
    results.push({ ...m, outcome, verdict })
    const icon = verdict === 'KILLED' || verdict === 'CONTROL_OK' ? '✅' : '❌'
    console.log(`${icon} ${m.id} [${m.severity}] → ${outcome} (${verdict})`)
  } finally {
    writeFileSync(path, original, 'utf8')          // ALWAYS restore
  }
}

// ── Report ──
const real = results.filter((r) => r.expect === 'kill' && r.status !== 'ANCHOR_STALE')
const killed = real.filter((r) => r.verdict === 'KILLED')
const p0p1 = real.filter((r) => r.severity === 'P0' || r.severity === 'P1')
const p0p1Killed = p0p1.filter((r) => r.verdict === 'KILLED')
const controls = results.filter((r) => r.expect === 'survive')
const controlsOk = controls.filter((r) => r.verdict === 'CONTROL_OK')
const stale = results.filter((r) => r.status === 'ANCHOR_STALE')

console.log('\n──────── MUTATION REPORT ────────')
console.log(`Real mutants: ${real.length} | KILLED ${killed.length} | SURVIVED ${real.length - killed.length}`)
console.log(`P0/P1 kill rate: ${p0p1Killed.length}/${p0p1.length}` +
  (p0p1.length ? ` (${Math.round((p0p1Killed.length / p0p1.length) * 100)}%)` : ''))
console.log(`Controls: ${controlsOk.length}/${controls.length} behaved (survived as expected)`)
if (stale.length) console.log(`Stale anchors (not run): ${stale.map((s) => s.id).join(', ')}`)
const survivors = real.filter((r) => r.verdict === 'SURVIVED')
if (survivors.length) {
  console.log('\n❌ SURVIVORS (missing tests — each needs a red-before-green regression):')
  for (const s of survivors) console.log(`   • ${s.id} [${s.severity}] ${s.file} — ${s.desc}`)
}
const harnessBroken = controls.filter((r) => r.verdict === 'HARNESS_BROKEN')
if (harnessBroken.length) console.log(`\n🔥 HARNESS_BROKEN controls: ${harnessBroken.map((h) => h.id).join(', ')}`)

// Exit non-zero if any real P0/P1 survived OR a control misbehaved OR an anchor is stale.
const fail = p0p1Killed.length !== p0p1.length || harnessBroken.length > 0 || stale.length > 0
process.exit(fail ? 1 : 0)
