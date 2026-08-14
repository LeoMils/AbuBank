/*
 * calibrateJudge.ts — Phase 0b. Measure the judge's agreement with the owner's labels.
 * The judge classifies each incident's Abu response BLIND (never sees the human label),
 * from the fixed taxonomy. Agreement = human_primary ∈ judge.classes, over text-scorable
 * incidents (voice-path INC-08 is excluded — overlap is not text-detectable). Reports
 * agreement % and every disagreement verbatim. Run: npx tsx scripts/eval/calibrateJudge.ts
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const env: Record<string, string> = {}
for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2]!; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  env[m[1]!] = v
}
const KEY = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
const MODEL = env.CAL_JUDGE_MODEL || 'gpt-4o'

interface Row { incident: string; lines: number[]; human_primary: string; human_secondary: string | null; voice_path: boolean; text_scorable: boolean; context: string; abu_response: string }
const rows: Row[] = readFileSync(join(ROOT, 'docs/eval/human-trace/calibration-set.jsonl'), 'utf8')
  .split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as Row)

const TAXONOMY = ['preamble', 'source_citing', 'over_explaining', 'factual_error', 'arguing_back', 'capability_refusal', 'tone', 'interruption', 'task_failure', 'language_ignored', 'unhelpful', 'entity_behavior', 'none']

const RUBRIC = `You review "Abu", a warm Hebrew voice companion for Martita, an 81-year-old woman alone at home. Given the user's turn and Abu's response, list EVERY defect a demanding elderly user would reject, from this fixed taxonomy (return exact tokens):
- preamble: announces she is about to check/look/think, or any filler before the answer ("בסדר, בואי נבדוק", "רגע").
- source_citing: names a website/app/store/source, or says where info came from ("מקור:", "מאתר X", "לפי").
- over_explaining: gives MORE than the direct answer/receipt. For a FAMILY RELATION the correct answer is ONE sentence stating only the relation ("איילון הוא הדוד של ארי"); naming the intermediate people or the derivation chain ("X אח של Y, Y בת של Z, אז...") IS over_explaining even if short and correct. For a prepared message/action, the receipt must be a SHORT "מוכן, תראי על המסך" — restating the message content OR the change she made (e.g. "עם השינוי לשעה 4 במקום 3") is over_explaining, because the user already sees the draft on screen. Also telling her about her own limits/process/problems.
- factual_error: a wrong fact, including a stale fact she was already told (retention), or a fabricated/invented entity.
- arguing_back: after the user corrects her (especially about the user's OWN family), she insists / stands her ground / does not accept immediately.
- capability_refusal: says she cannot do something (set a reminder, update a record/memory) that a companion for this user should do.
- tone: condescending, or not friend-like.
- interruption: talks over the user / does not stop when the user speaks.
- task_failure: fails a simple LITERAL instruction she could do in words (asked to count to five, gives meta instead of counting). This is NOT for actions that correctly require the user to confirm — Abu PREPARING a WhatsApp draft on screen or a calendar DRAFT awaiting save is the intended, safe behavior, never task_failure.
- language_ignored: asked to answer in a language (Yiddish/Spanish), answers in another.
- unhelpful: technically answered but the answer does not serve her (no real film list, no real price).
- entity_behavior: a prepared calendar/contact draft names the WRONG participant, or the title and participant mismatch confusingly (e.g. title "פגישה עם אח של מור" while the participant is "לאו").
- none: no defect.
Return ONLY JSON: {"classes":[...],"reason":"<=20 words"}. Do NOT see or guess any label.`

async function judge(context: string, abu: string): Promise<{ classes: string[]; reason: string }> {
  for (let a = 0; a < 5; a++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: RUBRIC },
        { role: 'user', content: JSON.stringify({ user_turn: context, abu_response: abu }) },
      ] }),
    })
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2500 * (a + 1))); continue }
    if (!res.ok) throw new Error(`judge HTTP ${res.status}`)
    const d = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const p = JSON.parse(d.choices?.[0]?.message?.content ?? '{}') as { classes?: string[]; reason?: string }
    const classes = (p.classes ?? []).filter((c) => TAXONOMY.includes(c))
    return { classes, reason: p.reason ?? '' }
  }
  throw new Error('judge failed')
}

async function main() {
  if (!KEY) { console.error('BLOCKED: no OPENAI_API_KEY'); process.exit(2) }
  const scorable = rows.filter((r) => r.text_scorable)
  const excluded = rows.filter((r) => !r.text_scorable)
  let agree = 0
  const results: Array<{ r: Row; classes: string[]; reason: string; match: boolean }> = []
  for (const r of scorable) {
    const j = await judge(r.context, r.abu_response)
    const match = j.classes.includes(r.human_primary)
    if (match) agree++
    results.push({ r, classes: j.classes, reason: j.reason, match })
    console.error(`[${r.incident}] human=${r.human_primary} judge=[${j.classes.join(',')}] ${match ? 'OK' : 'MISS'}`)
  }
  const pct = Math.round((agree / scorable.length) * 1000) / 10
  console.log('\n════════ JUDGE CALIBRATION ════════')
  console.log(`model=${MODEL} · scorable incidents=${scorable.length} (excluded voice-path: ${excluded.map((e) => e.incident).join(',') || 'none'})`)
  console.log(`AGREEMENT (human_primary ∈ judge.classes): ${agree}/${scorable.length} = ${pct}%`)
  console.log('\nDISAGREEMENTS (verbatim):')
  for (const x of results.filter((x) => !x.match)) {
    console.log(`  ${x.r.incident} · human=${x.r.human_primary}${x.r.human_secondary ? '(+' + x.r.human_secondary + ')' : ''} · judge=[${x.classes.join(',')}]`)
    console.log(`    context: ${x.r.context}`)
    console.log(`    abu: ${x.r.abu_response.slice(0, 160)}`)
    console.log(`    judge reason: ${x.reason}`)
  }
  console.log('\nPER-INCIDENT:')
  for (const x of results) console.log(`  ${x.r.incident} ${x.match ? '✓' : '✗'} human=${x.r.human_primary} judge=[${x.classes.join(',')}]`)
}
main().catch((e) => { console.error('CAL_ERROR', e?.message); process.exit(1) })
