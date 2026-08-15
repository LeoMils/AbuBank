/*
 * scripts/eval/preambleGapProbe.ts — M1: DERIVE the commit window from real data, do not choose it.
 * ════════════════════════════════════════════════════════════════════════════
 * The client commit window suppresses a preamble ONLY if the function_call arrives inside it. The
 * owner's device shows LONG preambles ("שנייה, אני בודקת את המחיר העדכני בארץ, כדי לא לנחש" ≈ 4s).
 * If the tool call lands seconds after audio starts, a small window catches nothing AND taxes every
 * plain answer. So MEASURE: over real tool turns, the preamble length (words → estimated spoken ms)
 * and the gap from first spoken token to the function_call. Report the distribution and the trade.
 *
 * FIDELITY: the instrument is TEXT-mode realtime, so the GAP measured here is TEXT-generation time,
 * which is FASTER than audio playback — it UNDER-estimates the audio-mode gap. The preamble WORD
 * COUNT → estimated audio duration (words × ~350ms for Hebrew TTS) is the more faithful proxy for
 * what the owner hears. Both are reported; the word-count estimate is the decision metric.
 *   npx vite-node scripts/eval/preambleGapProbe.ts
 */
import './nodeShim'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runConversationRealtime } from './realtimeRunner'
import { firstWinsOnlineFetch } from '../../src/services/online/firstWinsFetch'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
      let v = m[2]!; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[m[1]!] = v
    }
  } catch { /* */ }
  return { ...env, ...process.env as Record<string, string> }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const MS_PER_HEB_WORD = 350 // rough spoken pace for the audio-duration estimate

// Turns that SHOULD trigger a tool (family, calendar, online) — where the preamble appears.
const TOOL_TURNS = [
  'מי זאת מור?', 'מה הקשר בין עדי ללאו?', 'מי הנכדים שלי?',
  'מה יש לי ביומן מחר?', 'תקבעי לי תור לרופא ביום ראשון בעשר',
  'כמה עולה בושם בלו דה שאנל?', 'מה מזג האוויר היום בכפר סבא?', 'איזה סרטים רצים היום?',
  'תשלחי הודעה למור שאני אוהבת אותה', 'תזכירי לי לקחת תרופה בשמונה בערב',
]
// Plain conversational turns — no tool — to measure how OFTEN a turn is a tool turn.
const PLAIN_TURNS = [
  'בוקר טוב, מה שלומך?', 'אני קצת עייפה היום', 'ספרי לי בדיחה',
  'איזה יום יפה היום', 'אני אוהבת אותך', 'תודה רבה לך',
]

const pctl = (xs: number[], q: number) => xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]! : 0

async function main() {
  const env = loadEnv()
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
  const braveKey = env.BRAVE_API_KEY
  if (!openaiKey) { console.error('BLOCKED: no OPENAI_API_KEY'); process.exit(2) }
  const model = env.EVAL_REALTIME_MODEL || 'gpt-realtime'
  const onlineFetch = firstWinsOnlineFetch({ braveKey, openaiKey })
  const iters = Number(env.PREAMBLE_ITERS || 3) // ~30 tool turns at 3

  const preWords: number[] = [], gapMs: number[] = [], estAudioMs: number[] = []
  let toolTurns = 0, withPreamble = 0, transport = 0
  const samples: string[] = []

  for (let it = 0; it < iters; it++) {
    for (const q of TOOL_TURNS) {
      let r
      try { [r] = await runConversationRealtime([q], { openaiKey, braveKey, model, onlineFetch }) } catch { continue }
      await sleep(600)
      if (!r) continue
      if (r.totalMs < 500 && !r.text && !r.toolCalls.length) { transport++; continue }
      if (r.toolCalls.length === 0) continue // model chose not to call a tool this time
      toolTurns++
      const words = r.preambleText.trim() ? r.preambleText.trim().split(/\s+/).length : 0
      if (words > 0) {
        withPreamble++
        preWords.push(words)
        estAudioMs.push(words * MS_PER_HEB_WORD)
        if (r.ttftMs !== null && r.functionCallAtMs !== null && r.functionCallAtMs >= r.ttftMs) gapMs.push(r.functionCallAtMs - r.ttftMs)
        if (samples.length < 8) samples.push(`${words}w "${r.preambleText.trim().slice(0, 60)}"`)
      }
    }
  }
  // tool-turn fraction over a realistic mix (one pass of plain + tool)
  let mixTool = 0, mixTotal = 0
  for (const q of [...PLAIN_TURNS, ...TOOL_TURNS]) {
    try { const [r] = await runConversationRealtime([q], { openaiKey, braveKey, model, onlineFetch }); await sleep(600); if (!r) continue; mixTotal++; if (r.toolCalls.length) mixTool++ } catch { /* */ }
  }

  const suppressAt = (windowMs: number) => estAudioMs.length ? estAudioMs.filter((d) => d <= windowMs).length / estAudioMs.length : 0
  console.log('\n════ M1 PREAMBLE GAP — real instrument (text-mode; audio est. from words) ════')
  console.log(`tool turns measured: ${toolTurns} · with a preamble: ${withPreamble} (${toolTurns ? (100 * withPreamble / toolTurns).toFixed(0) : 0}%) · transport fails: ${transport}`)
  console.log(`preamble WORDS: median ${pctl(preWords, 0.5)} · p95 ${pctl(preWords, 0.95)} · max ${Math.max(0, ...preWords)}`)
  console.log(`est. spoken preamble ms (words×${MS_PER_HEB_WORD}): median ${pctl(estAudioMs, 0.5)} · p95 ${pctl(estAudioMs, 0.95)} · max ${Math.max(0, ...estAudioMs)}`)
  console.log(`text-mode gap ms (first token→function_call, UNDER-estimates audio): median ${pctl(gapMs, 0.5)} · p95 ${pctl(gapMs, 0.95)} · max ${Math.max(0, ...gapMs)}`)
  console.log(`tool-turn fraction over a plain+tool mix: ${mixTool}/${mixTotal} (${mixTotal ? (100 * mixTool / mixTotal).toFixed(0) : 0}%)`)
  console.log('\nsuppression rate of a client window at various sizes (by est. audio duration):')
  for (const w of [400, 700, 1000, 1500, 2000, 3000]) console.log(`  window ${w}ms → suppresses ${(100 * suppressAt(w)).toFixed(0)}% of preambles, taxes EVERY plain answer +${w}ms`)
  console.log('\nsamples:'); for (const s of samples) console.log('  ' + s)
  console.log('\nDECISION INPUT: if most preambles exceed an affordable window (≤ ~700ms of the 4s budget),')
  console.log('the client commit window cannot both suppress AND stay in budget → prefer the two-response pattern')
  console.log('(a round-trip on TOOL turns only) over a delay on EVERY turn. Choose on these numbers.')
}
main().catch((e) => { console.error('PREAMBLE_GAP_ERROR', e?.stack || e?.message || String(e)); process.exit(1) })
