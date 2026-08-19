/*
 * rc-acceptance-replacement-paths.mjs — prove the paths the Gemini/Groq REMOVAL rerouted. (§16 add-1)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/rc-acceptance-replacement-paths.mjs <rcUrl>
 *
 * Removing the Gemini/Groq CLIENT providers did not only delete code — it REROUTED live runtime paths.
 * A red test asserting the OLD client path, dispositioned STALE, is formally correct while the product
 * is silently broken UNLESS the REPLACEMENT is proven at the runtime-visible evidence class. This
 * proves each rerouted capability on the DEPLOYED clean RC (PREVIEW class):
 *   • STT   : client Groq Whisper → /api/abuai-stt (OpenAI whisper-1, server key)
 *   • TTS   : Gemini client tier removed → /api/abuai-tts (OpenAI gpt-4o-mini-tts, server key) → WebSpeech
 *   • CHAT  : Gemini/Groq client tiers → /api/abuai-chat (OpenAI gpt-4o server proxy)
 *   • WhatsApp compose: Groq client → /api/abuai-chat (proven separately by rc-acceptance-whatsapp: 5/5)
 * A REAL round-trip is the oracle: TTS synthesizes Hebrew audio, STT transcribes it back — proving BOTH
 * replacement media paths end-to-end with real providers. Writes docs/eval/RC_ACCEPTANCE_REPLACEMENT_PATHS.json.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { installNodeFetchAuth } from './lib/acceptance-session.mjs'

const RC = (process.argv[2] || '').replace(/\/$/, '')
installNodeFetchAuth() // CI session header for the now-authenticated billable endpoints
if (!RC) { console.error('usage: node scripts/rc-acceptance-replacement-paths.mjs <rcUrl>'); process.exit(2) }

const steps = []
const rec = (id, pass, detail) => { steps.push({ id, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(26)} ${detail ?? ''}`) }
const SAY = 'שלום, אני מרטיטה, זאת בדיקה קטנה.'   // the Hebrew phrase we synthesize then transcribe back

async function main() {
  console.log(`=== RC REPLACEMENT-PATHS ACCEPTANCE · ${RC} ===\n`)
  let audio = null

  // ── TTS replacement (OpenAI gpt-4o-mini-tts via /api/abuai-tts) ─────────────
  try {
    const res = await fetch(`${RC}/api/abuai-tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: { model: 'gpt-4o-mini-tts', input: SAY, voice: 'coral', speed: 1 } }),
    })
    const ct = res.headers.get('content-type') || ''
    if (res.ok && ct.includes('audio')) { audio = Buffer.from(await res.arrayBuffer()) }
    rec('tts.replacement', !!audio && audio.length > 1000, audio ? `OpenAI TTS → ${ct}, ${audio.length} bytes` : `HTTP ${res.status} ct=${ct}`)
  } catch (e) { rec('tts.replacement', false, `threw: ${String(e?.message || e).slice(0, 120)}`) }

  // ── STT replacement (OpenAI whisper-1 via /api/abuai-stt) — transcribe the TTS audio back ──
  if (audio) {
    try {
      const fd = new FormData()
      fd.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'recording.mp3')
      fd.append('language', 'he')
      const res = await fetch(`${RC}/api/abuai-stt`, { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      const text = (j?.text || '').trim()
      // Round-trip: a real transcript comes back and shares content with the spoken phrase.
      const overlap = text && (text.includes('מרטיטה') || text.includes('בדיקה') || text.includes('שלום'))
      rec('stt.replacement', j?.ok === true && !!text, j?.ok ? `whisper-1 → "${text.slice(0, 50)}"` : `error ${j?.error}`)
      rec('stt.roundtrip', overlap, overlap ? 'transcript matches the synthesized phrase (TTS→STT round-trip)' : `no overlap: "${text.slice(0, 50)}"`)
    } catch (e) { rec('stt.replacement', false, `threw: ${String(e?.message || e).slice(0, 120)}`) }
  } else {
    rec('stt.replacement', false, 'skipped — no TTS audio to transcribe')
  }

  // ── CHAT replacement (OpenAI gpt-4o via /api/abuai-chat server proxy) ─────────
  try {
    const res = await fetch(`${RC}/api/abuai-chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: { model: 'gpt-4o', messages: [{ role: 'user', content: 'תעני במילה אחת: מה בירת צרפת?' }], max_tokens: 20 }, lang: 'he', stream: false }),
    })
    const j = await res.json().catch(() => ({}))
    const content = j?.openai?.choices?.[0]?.message?.content?.trim() || ''
    rec('chat.replacement', j?.ok === true && content.includes('פריז'), j?.ok ? `gpt-4o proxy → "${content.slice(0, 40)}"` : `error ${j?.errorCode}`)
  } catch (e) { rec('chat.replacement', false, `threw: ${String(e?.message || e).slice(0, 120)}`) }

  const passed = steps.filter((s) => s.pass).length
  const allPass = steps.length > 0 && passed === steps.length
  const summary = {
    $schema: 'internal://abu/rc-acceptance-replacement-paths', rc: RC, when: new Date().toISOString(),
    rerouted: {
      STT: 'client Groq Whisper → /api/abuai-stt (OpenAI whisper-1)',
      TTS: 'Gemini client tier removed → /api/abuai-tts (OpenAI gpt-4o-mini-tts) → WebSpeech fallback',
      CHAT: 'Gemini/Groq client tiers → /api/abuai-chat (OpenAI gpt-4o server proxy)',
      WHATSAPP_COMPOSE: 'Groq client → /api/abuai-chat (proven by rc-acceptance-whatsapp: 5/5)',
    },
    evidenceClass: 'PREVIEW (deployed RC, real OpenAI providers, TTS→STT round-trip)',
    verdict: allPass ? 'PROVEN_PASS' : 'PROVEN_FAIL',
    passed, total: steps.length, steps,
  }
  writeFileSync(resolve('docs/eval/RC_ACCEPTANCE_REPLACEMENT_PATHS.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(`\n=== ${summary.verdict}  ${passed}/${steps.length} ===`)
  console.log('wrote docs/eval/RC_ACCEPTANCE_REPLACEMENT_PATHS.json')
  process.exit(allPass ? 0 : 1)
}
main().catch((e) => { console.error('replacement-paths error:', e?.message || e); process.exit(1) })
