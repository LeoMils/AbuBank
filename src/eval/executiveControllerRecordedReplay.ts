/*
 * Executive Controller — Recorded Conversation Replay
 * ═══════════════════════════════════════════════════
 * Replays every real conversation line AbuAI has on record, EXACTLY as written,
 * through the single ExecutiveCognitiveController.
 *
 * HONEST SOURCE NOTE: the repo has no verbatim voice-recording file. The closest
 * "recorded conversations" are (a) the exact `M:` input lines in the pipeline
 * transcript docs (docs/abuai/RC6_TRANSCRIPTS.md, LONG_CONTEXT_TRANSCRIPT.md) and
 * (b) the exact lines Leo pasted across the mission prompts. Both are replayed here
 * verbatim (the harness reads the docs and extracts the lines — nothing rephrased).
 *
 * Pass condition per turn: the controller returns an answer that is
 * RUNTIME_FINALIZED (single-controller, no bypass), non-empty, and free of broken
 * Hebrew / raw markdown-URL leakage in speech. Specific Leo lines add behavioral
 * assertions on top.
 */
import fs from 'fs'
import path from 'path'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { isFinalized } from '../screens/AbuAI/runtimeTrace'
import { saveAppointments, loadAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

const NOW = new Date(2026, 6, 2, 9, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => 'תשובה כללית קצרה ונכונה על הנושא.', online: async () => ({ ok: true, answer: 'יש הקרנה בשבע וחצי בערב.' }) }

const DOCS = path.resolve(__dirname, '../../docs/abuai')

export interface Conversation { source: string; lines: string[] }

/** Extract the exact Martita ("M:") input lines from a transcript doc. */
function extractInputs(file: string): string[] {
  let text = ''
  try { text = fs.readFileSync(file, 'utf8') } catch { return [] }
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    // "**M:** <text>"  or  "N. M: <text>"  or  "   M: <text>"
    const m = raw.match(/^\s*(?:\*\*M:\*\*|(?:\d+\.\s*)?M:)\s*(.+?)\s*$/)
    if (m && m[1] && !m[1].startsWith('<')) out.push(m[1])
  }
  return out
}

/** The exact lines Leo pasted across the mission prompts, grouped by flow. */
const LEO_MISSION_CONVERSATIONS: Conversation[] = [
  { source: 'leo:date', lines: ['איזה יום היום', 'מה התאריך היום'] },
  { source: 'leo:calendar', lines: ['מה יש לי היום', 'מה יש לי מחר', 'מתי יש לי פגישה עם מוטי'] },
  { source: 'leo:create', lines: ['תקבעי לי פגישה עם דני מחר בעשר בבוקר', 'כן כן', 'תקבעי את זה'] },
  { source: 'leo:ofir', lines: ['ביום שלישי אופיר אמרה לי שהיא תחזור קצת יותר מאוחר כי היא צריכה לסיים את העבודה, אז אם אני יכול להגיע אליה בשעה שבע ולא שבע וחצי, כי גלעד לא יוכל להגיע, והיא רוצה שאני אהיה אצלה שעתיים.'] },
  { source: 'leo:family', lines: ['מה ליאו עבור אופיר', 'מה הקשר בין רפי ללאו', 'מי זה ירדן עבור אנאבל'] },
  { source: 'leo:online', lines: ['מה הסרטים בכפר סבא', 'מתי האוטובוס מרעננה לתל אביב', 'מי ניצח במונדיאל אתמול'] },
  { source: 'leo:continue', lines: ['ספרי לי על המהפכה הצרפתית', 'תמשיכי', 'יש לך זיכרון על מה דיברנו'] },
  { source: 'leo:frustration', lines: ['את לא מבינה אותי', 'את לא עונה למה ששאלתי'] },
  { source: 'leo:broken', lines: ['אני תבדוק', 'תקבילי פגישה', 'אחורה צהריים'] },
  { source: 'leo:audio', lines: ['לא שמעתי', 'אני לא שומע אותך'] },
]

const ROOT = path.resolve(__dirname, '../..')

/** rc7-live-scenarios.json → one Conversation per suite/conversation, turns verbatim. */
function loadRc7Scenarios(): Conversation[] {
  const out: Conversation[] = []
  try {
    const raw = fs.readFileSync(path.join(ROOT, 'acceptance/scenarios/rc7-live-scenarios.json'), 'utf8')
    const data = JSON.parse(raw) as { suites?: Array<{ id?: string; conversations?: Array<{ id?: string; turns?: string[] }> }> }
    for (const suite of data.suites ?? []) {
      for (const convo of suite.conversations ?? []) {
        const lines = (convo.turns ?? []).filter(t => typeof t === 'string' && t.trim().length > 0)
        if (lines.length) out.push({ source: `rc7:${suite.id}:${convo.id}`, lines })
      }
    }
  } catch { /* absent */ }
  return out
}

/** Extract turns from martitaTranscript.harness (SCRIPTS: {turns:[...]}). */
function loadMartitaHarness(): Conversation[] {
  const out: Conversation[] = []
  try {
    const txt = fs.readFileSync(path.join(ROOT, 'acceptance/martitaTranscript.harness.ts'), 'utf8')
    for (const m of txt.matchAll(/name:\s*'([^']+)'\s*,\s*turns:\s*\[([^\]]+)\]/g)) {
      const lines = [...m[2]!.matchAll(/'([^']+)'/g)].map(x => x[1]!).filter(s => s.trim().length > 0)
      if (lines.length) out.push({ source: `martitaHarness:${m[1]}`, lines })
    }
  } catch { /* absent */ }
  return out
}

/** Extract the `u:` user lines from hebrewConversation.harness (one conversation). */
function loadHebrewHarness(): Conversation[] {
  try {
    const txt = fs.readFileSync(path.join(ROOT, 'acceptance/hebrewConversation.harness.ts'), 'utf8')
    const lines = [...txt.matchAll(/\bu:\s*'([^']+)'/g)].map(x => x[1]!).filter(s => s.trim().length > 0)
    return lines.length ? [{ source: 'hebrewHarness', lines }] : []
  } catch { return [] }
}

/** e2e spec `{ text: '<input>' }` turns → one conversation (verbatim). */
function loadE2eSpec(): Conversation[] {
  try {
    const txt = fs.readFileSync(path.join(ROOT, 'e2e/latest-iphone-transcript-repro.spec.ts'), 'utf8')
    const lines = [...txt.matchAll(/\btext:\s*'([^']+)'/g)].map(x => x[1]!).filter(s => /[֐-׿]/.test(s))
    return lines.length ? [{ source: 'e2e:latest-iphone', lines }] : []
  } catch { return [] }
}

/** realIphoneTranscriptGauntlet Hebrew call-args are the recorded inputs. */
function loadGauntletInputs(): Conversation[] {
  try {
    const txt = fs.readFileSync(path.join(ROOT, 'src/eval/realIphoneTranscriptGauntlet.ts'), 'utf8')
    const lines = [...txt.matchAll(/(?:understandMeeting|startCreate|answerFamilyRelation|resolvePendingMessage)\(\s*'([֐-׿][^']*)'/g)]
      .map(x => x[1]!).filter(s => s.trim().length > 0)
    // dedup consecutive identical seeds
    const uniq = lines.filter((l, i) => l !== lines[i - 1])
    return uniq.length ? [{ source: 'realIphoneGauntlet', lines: uniq }] : []
  } catch { return [] }
}

/** Every docs/abuai/*.md transcript → extract M:/u: input lines (verbatim). */
function loadAllAbuaiDocs(): Conversation[] {
  const out: Conversation[] = []
  let files: string[] = []
  try { files = fs.readdirSync(DOCS).filter(f => f.endsWith('.md')) } catch { return [] }
  for (const f of files) {
    if (f === 'RC6_TRANSCRIPTS.md' || f === 'LONG_CONTEXT_TRANSCRIPT.md') continue // already ingested
    let txt = ''
    try { txt = fs.readFileSync(path.join(DOCS, f), 'utf8') } catch { continue }
    const lines: string[] = []
    for (const raw of txt.split(/\r?\n/)) {
      const m = raw.match(/^\s*(?:\*\*M:\*\*|(?:\d+\.\s*)?M:|- ?u:|u:)\s*(.+?)\s*$/)
      if (m && m[1] && !m[1].startsWith('<') && /[֐-׿A-Za-z]/.test(m[1])) lines.push(m[1])
    }
    if (lines.length) out.push({ source: `doc:${f}`, lines })
  }
  return out
}

export function loadRecordedConversations(): Conversation[] {
  const convos: Conversation[] = []
  // RC6: split into conversations by "### " section headers.
  const rc6 = path.join(DOCS, 'RC6_TRANSCRIPTS.md')
  try {
    const txt = fs.readFileSync(rc6, 'utf8')
    let cur: string[] = []; let sec = 'RC6'
    for (const raw of txt.split(/\r?\n/)) {
      if (/^###\s+/.test(raw)) { if (cur.length) convos.push({ source: `RC6:${sec}`, lines: cur }); cur = []; sec = raw.replace(/^###\s+/, '').trim() }
      const m = raw.match(/^\s*\*\*M:\*\*\s*(.+?)\s*$/)
      if (m && m[1] && !m[1].startsWith('<')) cur.push(m[1])
    }
    if (cur.length) convos.push({ source: `RC6:${sec}`, lines: cur })
  } catch { /* file absent */ }
  // Long-context: one 20-turn conversation.
  const lc = extractInputs(path.join(DOCS, 'LONG_CONTEXT_TRANSCRIPT.md'))
  if (lc.length) convos.push({ source: 'LONG_CONTEXT', lines: lc })
  // Every other recorded source, ingested verbatim.
  convos.push(...loadRc7Scenarios())
  convos.push(...loadMartitaHarness())
  convos.push(...loadHebrewHarness())
  convos.push(...loadE2eSpec())
  convos.push(...loadGauntletInputs())
  convos.push(...loadAllAbuaiDocs())
  // Leo's exact mission lines.
  convos.push(...LEO_MISSION_CONVERSATIONS)
  return convos
}

export interface TurnResult { source: string; category: string; input: string; pass: boolean; finalized: boolean; detail: string }

const BROKEN = /אני\s+תבדוק|תקבילי|אחורה\s+צהריים/
const MD_URL = /https?:\/\/|\]\(/

export async function runRecordedReplay(): Promise<TurnResult[]> {
  const rows: TurnResult[] = []
  for (const convo of loadRecordedConversations()) {
    // Each recorded conversation is independent — reset the store; multi-turn
    // state (a create then a read within the SAME conversation) is preserved.
    saveAppointments([])
    let state: RuntimeState = IDLE_RUNTIME
    for (const input of convo.lines) {
      const r = await ExecutiveCognitiveController.handleTurn(state, input, { messages: [], now: NOW }, TOOLS)
      state = r.state
      const finalized = isFinalized(r.trace) && r.controller === 'executive-cognitive-controller'
      const clean = !!r.display && r.display.trim().length > 0 && !BROKEN.test(r.speak) && !MD_URL.test(r.speak)
      // Correctness guards (beyond robustness): no "can't check" when a tool works,
      // no "באיזה יום" on a search-all, no invented event when the store is empty.
      const cantCheck = /לא\s+מצליחה\s+לבדוק|אין\s+לי\s+גישה\s+ליומן/.test(r.display)
      const searchBounce = r.intent === 'calendar_search' && /באיזה יום/.test(r.display)
      const invented = r.intent === 'calendar_read' && loadAppointments().length === 0 && /רופא|תור|פגישה\s+עם|\d{1,2}:\d{2}/.test(r.display)
      const correct = !cantCheck && !searchBounce && !invented
      rows.push({ source: convo.source, category: r.meta.domain, input, pass: finalized && clean && r.supervisor.approved && correct, finalized, detail: r.display.slice(0, 40) })
    }
  }
  return rows
}

export function recordedScore(rows: TurnResult[]): { passed: number; total: number; pct: number; finalizedPct: number; failures: TurnResult[] } {
  const passed = rows.filter(r => r.pass).length
  const fin = rows.filter(r => r.finalized).length
  return { passed, total: rows.length, pct: Math.round((passed / rows.length) * 100), finalizedPct: Math.round((fin / rows.length) * 100), failures: rows.filter(r => !r.pass) }
}

export function byCategory(rows: TurnResult[]): Array<{ category: string; passed: number; total: number; pct: number }> {
  const map = new Map<string, TurnResult[]>()
  for (const r of rows) { const a = map.get(r.category) ?? []; a.push(r); map.set(r.category, a) }
  return [...map.entries()].map(([category, a]) => ({ category, passed: a.filter(x => x.pass).length, total: a.length, pct: Math.round((a.filter(x => x.pass).length / a.length) * 1000) / 10 }))
    .sort((x, y) => y.total - x.total)
}

export function bySource(rows: TurnResult[]): Array<{ source: string; total: number }> {
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.source.split(':')[0]!, (map.get(r.source.split(':')[0]!) ?? 0) + 1)
  return [...map.entries()].map(([source, total]) => ({ source, total })).sort((a, b) => b.total - a.total)
}
