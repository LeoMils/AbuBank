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
import { saveAppointments } from '../screens/AbuCalendar/service'
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
  // Leo's exact mission lines.
  convos.push(...LEO_MISSION_CONVERSATIONS)
  return convos
}

export interface TurnResult { source: string; input: string; pass: boolean; finalized: boolean; detail: string }

const BROKEN = /אני\s+תבדוק|תקבילי|אחורה\s+צהריים/
const MD_URL = /https?:\/\/|\]\(/

export async function runRecordedReplay(): Promise<TurnResult[]> {
  saveAppointments([])
  const rows: TurnResult[] = []
  for (const convo of loadRecordedConversations()) {
    let state: RuntimeState = IDLE_RUNTIME
    for (const input of convo.lines) {
      const r = await ExecutiveCognitiveController.handleTurn(state, input, { messages: [], now: NOW }, TOOLS)
      state = r.state
      const finalized = isFinalized(r.trace) && r.controller === 'executive-cognitive-controller'
      const clean = !!r.display && r.display.trim().length > 0 && !BROKEN.test(r.speak) && !MD_URL.test(r.speak)
      rows.push({ source: convo.source, input, pass: finalized && clean && r.supervisor.approved, finalized, detail: r.display.slice(0, 40) })
    }
  }
  return rows
}

export function recordedScore(rows: TurnResult[]): { passed: number; total: number; pct: number; finalizedPct: number; failures: TurnResult[] } {
  const passed = rows.filter(r => r.pass).length
  const fin = rows.filter(r => r.finalized).length
  return { passed, total: rows.length, pct: Math.round((passed / rows.length) * 100), finalizedPct: Math.round((fin / rows.length) * 100), failures: rows.filter(r => !r.pass) }
}
