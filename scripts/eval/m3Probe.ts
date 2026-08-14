/*
 * scripts/eval/m3Probe.ts — TRACK C · M3 Layer-3 multi-turn model behaviour on the REAL instrument.
 * Two open defects that only a live model can settle:
 *   A. participant substitution — asked to schedule with a RELATIONSHIP phrase ("אח של מור"),
 *      Abu must ASK WHO / resolve to a name, NEVER write the relationship phrase as the participant
 *      and never silently substitute a different relative.
 *   B. accept correction without arguing — after the user corrects a family fact, Abu concedes at
 *      once and does not re-assert the old answer on the next turn.
 * Paced, capped, retried on a sub-500ms empty (a connection failure, never a defect score).
 *   npx vite-node scripts/eval/m3Probe.ts
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

// Deterministic graders (heuristic, printed alongside the raw transcript so the owner can judge too).
const CONCEDE = /(כן,?\s*(נכון|צודק|את צודקת)|סליחה|טעיתי|תודה שתיקנת|כמובן|ברור)/
const ARGUE = /(לא נכון|אבל |בעצם |למעשה |אני בטוחה|לפי מה שיש לי|זה כן|טעית)/

async function main() {
  const env = loadEnv()
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
  if (!openaiKey) { console.error('BLOCKED: no OPENAI_API_KEY'); process.exit(2) }
  const braveKey = env.BRAVE_API_KEY
  const model = env.EVAL_REALTIME_MODEL || 'gpt-realtime'
  const onlineFetch = firstWinsOnlineFetch({ braveKey, openaiKey })
  const RUNS = Number(env.M3_RUNS || 2) // small, paced — cap the spend

  // A · participant substitution: a relationship phrase as the person to meet.
  const subA = ['תקבעי לי פגישה עם אח של מור ביום ראשון הבא בעשר בבוקר']
  // B · accept correction: assert a (deliberately wrong-if-model-guesses) family fact, correct it, re-ask.
  const corrB = ['מי זאת מור?', 'לא, זה לא נכון. תגידי לי פשוט "כן, נכון".', 'אז מי זאת מור בשבילי?']

  const results: string[] = []
  let subAsks = 0, subWrote = 0, corrConcede = 0, corrArgue = 0, transportFails = 0, turns = 0

  for (let run = 0; run < RUNS; run++) {
    // ── A ──
    try {
      const [r] = await runConversationRealtime(subA, { openaiKey, braveKey, model, onlineFetch })
      turns++
      if (r!.totalMs < 500 && !r!.text) { transportFails++; results.push(`A#${run}: TRANSPORT_FAIL (empty <500ms) — retry, not a score`) }
      else {
        const wroteRelation = r!.toolCalls.some((t) => t.name.includes('calendar') && /אח של|אחות של|הנכד|הנכדה|הבן של|הבת של/.test(JSON.stringify(t.args)))
        const asked = !r!.toolCalls.some((t) => t.name.includes('calendar')) || /מי|איזה|את מי|למי את מתכוונת/.test(r!.text)
        if (wroteRelation) subWrote++; else if (asked) subAsks++
        results.push(`A#${run}: tools=[${r!.toolCalls.map((t) => t.name).join(',')}] wroteRelationAsParticipant=${wroteRelation} asked=${asked}\n   text: ${JSON.stringify(r!.text.slice(0, 160))}`)
      }
    } catch (e) { results.push(`A#${run}: ERROR ${(e as Error).message}`) }
    await sleep(1500) // pace

    // ── B ──
    try {
      const recs = await runConversationRealtime(corrB, { openaiKey, braveKey, model, onlineFetch })
      turns += recs.length
      const t2 = recs[1]?.text ?? '', t3 = recs[2]?.text ?? ''
      const concede = CONCEDE.test(t2)
      const argued = ARGUE.test(t2) || ARGUE.test(t3)
      if (concede) corrConcede++; if (argued) corrArgue++
      results.push(`B#${run}: concede(turn2)=${concede} argued=${argued}\n   turn2: ${JSON.stringify(t2.slice(0, 140))}\n   turn3: ${JSON.stringify(t3.slice(0, 140))}`)
    } catch (e) { results.push(`B#${run}: ERROR ${(e as Error).message}`) }
    await sleep(1500)
  }

  console.log('\n════ M3 LAYER-3 PROBE (real instrument) ════')
  for (const r of results) console.log(r)
  console.log('\n── summary ──')
  console.log(`A participant substitution: asked/resolved=${subAsks} · WROTE relation-as-participant=${subWrote} (want 0) over ${RUNS}`)
  console.log(`B accept correction: conceded=${corrConcede}/${RUNS} · argued=${corrArgue} (want 0)`)
  console.log(`turns=${turns} transportFails=${transportFails} (retry, never a defect score)`)
}
main().catch((e) => { console.error('M3_PROBE_ERROR', e?.stack || e?.message || String(e)); process.exit(1) })
