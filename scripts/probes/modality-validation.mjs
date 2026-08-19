/*
 * Probe: WHICH output_modalities value on response.create does the REAL gpt-realtime reject?
 * ════════════════════════════════════════════════════════════════════════════
 * DEVICE FAILURE (v0.275.0, two-response ON): the session died on the FIRST user turn with
 * code=invalid_value. The two-response wiring sends TWO response.create values the single-response
 * path never sent: a TEXT-ONLY decision (`['text']`) and a spoken answer (`['audio','text']`).
 * The instrument previously proved `['text']` and `['audio']` alone are accepted; `['audio','text']`
 * was NEVER tested on the real model. This probe drives each candidate against the actual model and
 * reports the EXACT error (code + param + message) or a clean completion — no guessing from docs.
 *
 * Runs one FRESH session per candidate (a rejected create must not poison the next). Resolves on the
 * FIRST of {error event, response.done, timeout} — unlike runResponse (which ignores 'error'), because
 * an invalid_value is delivered as an 'error' event and NO response.done ever arrives.
 */
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'
import fs from 'node:fs'

const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = minimalSession(full)
const key = loadKey()

const CANDIDATES = [
  ['text'],            // decision response (proven valid before)
  ['audio'],           // single-audio (proven valid before; reference-session-config uses this)
  ['audio', 'text'],   // <-- the SHIPPING two-response ANSWER value (untested on the real model)
  ['text', 'audio'],   // reversed order, for completeness
]

/** Send ONE response.create with the given output_modalities; resolve on first error/done/timeout. */
function probeOne(session, output_modalities, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const off = session.on((msg) => {
      if (msg.type === 'error') {
        clearTimeout(timer); off()
        resolve({ outcome: 'ERROR', code: msg.error?.code ?? null, param: msg.error?.param ?? null, message: msg.error?.message ?? null })
      } else if (msg.type === 'response.done') {
        clearTimeout(timer); off()
        const status = msg.response?.status
        const errCode = status === 'failed' ? (msg.response?.status_details?.error?.code ?? 'failed') : null
        resolve({ outcome: errCode ? 'RESPONSE_FAILED' : 'OK', code: errCode, param: null, message: msg.response?.status_details?.error?.message ?? null })
      }
    })
    const timer = setTimeout(() => { off(); resolve({ outcome: 'TIMEOUT', code: null, param: null, message: null }) }, timeoutMs)
    session.send({ type: 'response.create', response: { output_modalities } })
  })
}

async function main() {
  console.log('=== OUTPUT_MODALITIES VALIDATION PROBE (real gpt-realtime, WS instrument) ===\n')
  const results = []
  for (const mod of CANDIDATES) {
    const s = openSession(key, cfg)
    await s.waitOpen()
    await sleep(200)
    if (!s.state.credit) { console.log('CREDIT WALL — aborting'); s.close(); process.exit(2) }
    userText(s, 'שלום, מה שלומך?')
    const r = await probeOne(s, mod)
    results.push({ output_modalities: mod, ...r })
    const tag = r.outcome === 'OK' ? 'ACCEPTED' : r.outcome
    console.log(`output_modalities=${JSON.stringify(mod).padEnd(20)} → ${tag}` +
      (r.code ? `  code=${r.code}` : '') + (r.param ? `  param=${r.param}` : '') + (r.message ? `\n    message: ${r.message}` : ''))
    s.close()
    await sleep(700)
  }
  fs.writeFileSync('docs/eval/MODALITY_VALIDATION_PROBE.json', JSON.stringify(results, null, 2))
  console.log('\nwrote docs/eval/MODALITY_VALIDATION_PROBE.json')
  const rejected = results.filter((r) => r.outcome === 'ERROR' || r.outcome === 'RESPONSE_FAILED')
  console.log(`\nVERDICT: ${rejected.length ? rejected.map((r) => JSON.stringify(r.output_modalities) + ' → ' + r.code).join(' ; ') : 'all candidates accepted'}`)
  process.exit(0)
}
main().catch((e) => { console.error('probe error:', e.message); process.exit(1) })
