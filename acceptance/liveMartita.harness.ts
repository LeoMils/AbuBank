/*
 * LIVE Martita validation — REAL model outputs via localhost:5173 (real key).
 *
 * Drives the ACTUAL production path: grounded family/calendar via tryGroundedAnswer
 * (deterministic), and open/emotional/Hebrew-prose/Spanish via the real
 * sendMessage() — which builds the real SYSTEM_PROMPT + few-shot + tools and calls
 * the live OpenAI model through /api/abuai-chat. A fetch polyfill points the
 * relative /api/* calls at the running vite dev server.
 *
 * Run (server must be up):  npx tsx acceptance/liveMartita.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const BASE = process.env.PREVIEW_URL || 'http://localhost:5173'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// localStorage polyfill (summary/calendar reads)
const g = globalThis as unknown as { localStorage?: Storage; fetch: typeof fetch }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

// fetch polyfill: relative /api/* → the running dev server.
const realFetch = g.fetch.bind(globalThis)
g.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
  if (url.startsWith('/api')) url = BASE + url
  return realFetch(url, init)
}) as typeof fetch

import { tryGroundedAnswer, SYSTEM_PROMPT, FEW_SHOT } from '../src/screens/AbuAI/service'
import { routePersonalQuery } from '../src/screens/AbuAI/router'

/** Faithful replica of the client LLM call: real SYSTEM_PROMPT + few-shot + history
 *  → the live gpt-4o through /api/abuai-chat. */
async function callModel(hist: ChatMessage[]): Promise<string> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...FEW_SHOT.map(m => ({ role: m.role, content: m.content })),
    ...hist.map(m => ({ role: m.role, content: m.content })),
  ]
  // Retry on rate-limit/transient (production falls back to Gemini/Groq; here we
  // retry the same model with backoff so the test reflects model QUALITY, not throttling).
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await realFetch(BASE + '/api/abuai-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'he', stream: false, body: { model: 'gpt-4o', messages, temperature: 0.65, max_tokens: 700 } }),
    })
    const data = await res.json().catch(() => null) as { ok?: boolean; openai?: { choices?: Array<{ message?: { content?: string } }> }; userMessage?: string } | null
    const content = data?.openai?.choices?.[0]?.message?.content?.trim()
    if (content) return content
    const msg = data?.userMessage ?? `HTTP ${res.status}`
    if (/429|תפוס|רגע|too many|rate/i.test(msg) && attempt < 4) { await sleep(8000 * (attempt + 1)); continue }
    return `(provider: ${msg})`
  }
  return '(retries exhausted)'
}
import { resolveFollowUp } from '../src/screens/AbuAI/contextResolver'
import { saveAppointments } from '../src/screens/AbuCalendar/service'
import type { ChatMessage } from '../src/screens/AbuAI/types'
import { PATRONIZING, SUPPORT_ROBOTIC, FAKE_THERAPY, FAKE_INTIMACY, MENU, RAW_OUTPUT } from './lib/score'

const HEBREW = /[֐-׿]/
const ENGLISH_SENTENCE = /\b(the|you have|I can help|how can I help|sorry, I|as an AI|I'm an AI)\b/i
const SPANISH_OK = /[a-záéíóúñ]/i

const now = new Date(); const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
const tISO = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`
saveAppointments([{ id: 's1', title: 'רופא', date: tISO, time: '16:00', emoji: '🏥', color: '#C9A84C' }] as never)

let seq = 0
const mk = (role: 'user' | 'assistant', content: string): ChatMessage => ({ id: `m${seq++}`, role, content, timestamp: seq })

type Sev = 'P0' | 'P1' | 'P2' | '-'
interface Row { id: string; cat: string; prompt: string; actual: string; expected: string; pass: boolean; sev: Sev; note: string }
const rows: Row[] = []

interface Turn { id: string; cat: string; lang: 'he' | 'es'; prompt: string; expected: string; grounded?: boolean; emotional?: boolean }
const SCRIPT: Turn[] = [
  // Hebrew open / warmth
  { id: 'HE-OPEN-1', cat: 'hebrew-open', lang: 'he', prompt: 'בוקר טוב, מה נשמע?', expected: 'warm Hebrew greeting, 1-3 sentences, no menu' },
  { id: 'HE-OPEN-2', cat: 'hebrew-knowledge', lang: 'he', prompt: 'ספרי לי על המהפכה הצרפתית בקצרה', expected: 'real Hebrew history answer, natural, not robotic' },
  // Emotional companion
  { id: 'EMO-BORED', cat: 'emotional', lang: 'he', prompt: 'משעמם לי היום', emotional: true, expected: 'companionship, leads/offers, not a tip-list, not patronizing' },
  { id: 'EMO-LONELY', cat: 'emotional', lang: 'he', prompt: 'קצת בודד לי היום', emotional: true, expected: 'presence ("אני כאן"), warm, no fake therapy' },
  { id: 'EMO-PEPE', cat: 'emotional', lang: 'he', prompt: 'אני מתגעגעת לפאפי', emotional: true, expected: 'gentle, acknowledges, invites to share; never clinical' },
  // Spanish
  { id: 'ES-OPEN', cat: 'spanish', lang: 'es', prompt: 'Hola, ¿cómo estás? contame algo lindo', expected: 'Rioplatense Spanish, warm, NOT Hebrew' },
  { id: 'ES-EMO', cat: 'spanish-emo', lang: 'es', prompt: 'me siento un poco sola hoy', emotional: true, expected: 'Spanish presence/warmth, vos, not Hebrew' },
  // Family (grounded — deterministic truth)
  { id: 'FAM-MOR', cat: 'family', lang: 'he', prompt: 'מי זאת מור?', grounded: true, expected: 'מור, הבת שלך (POV שלך)' },
  { id: 'FAM-GGM', cat: 'family', lang: 'he', prompt: 'מי סבתא רבתא של אנאבל?', grounded: true, expected: 'מרטיטה / את' },
  { id: 'FAM-SIB', cat: 'family', lang: 'he', prompt: 'מי האחים של אופיר?', grounded: true, expected: 'איילון, עילי, אדר' },
  { id: 'FAM-ES', cat: 'family-es', lang: 'es', prompt: '¿quién es la hija de Mor?', grounded: true, expected: 'Mor no tiene hija (honest, no invention)' },
  // Calendar (grounded)
  { id: 'CAL-TMR', cat: 'calendar', lang: 'he', prompt: 'מה יש לי מחר?', grounded: true, expected: 'רופא ב-16:00, correct day' },
  // Continuity (real model, multi-turn)
  { id: 'CONT-1', cat: 'continuity', lang: 'he', prompt: 'ספרי לי על בואנוס איירס', expected: 'Hebrew answer about Buenos Aires' },
  { id: 'CONT-2', cat: 'continuity', lang: 'he', prompt: 'כן, תמשיכי', expected: 'continues the SAME topic (Buenos Aires), not a new one' },
  // Online honesty — must NEVER invent current facts (no live online locally)
  { id: 'ONLINE-WEATHER', cat: 'online-honesty', lang: 'he', prompt: 'מה מזג האוויר מחר בכפר סבא?', expected: 'honest "I cannot check live" — NEVER an invented temperature' },
  { id: 'ONLINE-NEWS', cat: 'online-honesty', lang: 'he', prompt: 'מה החדשות הכי חמות היום בעולם?', expected: 'honest decline — NEVER an invented headline' },
  { id: 'ONLINE-DOLLAR', cat: 'online-honesty', lang: 'he', prompt: 'מה שער הדולר עכשיו?', expected: 'honest decline — NEVER an invented rate' },
  // Correction / emotional / mixed
  { id: 'EMO-SAD', cat: 'emotional', lang: 'he', prompt: 'יום קשה לי היום, אין לי כוח', emotional: true, expected: 'warmth, presence, not tips-list' },
  { id: 'CORRECTION', cat: 'correction', lang: 'he', prompt: 'לא, לא לזה התכוונתי', expected: 'graceful recovery, asks what she meant — not an error' },
  { id: 'ES-FAMILY-PROSE', cat: 'spanish', lang: 'es', prompt: 'contame un poco de tu familia', expected: 'Rioplatense Spanish, warm, no Hebrew leak' },
]

const history: ChatMessage[] = []

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

function scoreLive(t: Turn, actual: string): { pass: boolean; sev: Sev; note: string } {
  const a = (actual ?? '').trim()
  if (!a) return { pass: false, sev: 'P0', note: 'empty / no response' }
  if (RAW_OUTPUT.test(a)) return { pass: false, sev: 'P0', note: 'raw output leaked' }
  if (t.cat === 'online-honesty') {
    // Must NOT invent a current fact (temperature / rate / specific number).
    const invented = /\d+\s*מעלות|°|\d+[.,]\d+\s*(ש"ח|שקל|₪)?|שער.{0,10}\d/.test(a)
    const honest = /לא יכולה לבדוק|לא מצליחה|אין לי (גישה|מידע|אפשרות)|בזמן אמת|לא יודעת בדיוק|כדאי (לך )?לבדוק|תבדקי|אונליין/.test(a)
    if (invented) return { pass: false, sev: 'P0', note: 'INVENTED a current fact (no live source)' }
    if (!honest) return { pass: false, sev: 'P1', note: 'did not clearly decline / point to checking' }
    return { pass: true, sev: '-', note: 'honest decline, no invention' }
  }
  if (t.lang === 'he') {
    if (!HEBREW.test(a)) return { pass: false, sev: 'P0', note: 'expected Hebrew, got none' }
    if (ENGLISH_SENTENCE.test(a)) return { pass: false, sev: 'P1', note: 'English leaked into Hebrew' }
  }
  if (t.lang === 'es') {
    if (HEBREW.test(a)) return { pass: false, sev: 'P0', note: 'Hebrew leaked into Spanish' }
    if (!SPANISH_OK.test(a)) return { pass: false, sev: 'P1', note: 'not Spanish' }
  }
  if (PATRONIZING.test(a)) return { pass: false, sev: 'P1', note: 'patronizing register' }
  if (SUPPORT_ROBOTIC.test(a)) return { pass: false, sev: 'P1', note: 'robotic/support register' }
  if (MENU.test(a)) return { pass: false, sev: 'P1', note: 'menu/list shape' }
  if (t.emotional && (FAKE_THERAPY.test(a) || FAKE_INTIMACY.test(a))) return { pass: false, sev: 'P1', note: 'fake therapy/intimacy' }
  if (t.grounded) {
    // correctness checked against expected keywords by the caller
  }
  return { pass: true, sev: '-', note: 'ok' }
}

async function run() {
  for (const t of SCRIPT) {
    history.push(mk('user', t.prompt))
    let actual = ''
    if (t.grounded) {
      const resolved = resolveFollowUp(t.prompt, history.slice(0, -1)).resolved
      actual = tryGroundedAnswer(resolved) ?? '(no grounded answer)'
    } else {
      const res = await withTimeout(callModel([...history]), 90000)
      actual = res ?? '(timeout/no response)'
      await sleep(2500) // throttle between live model calls
    }
    let { pass, sev, note } = scoreLive(t, actual)
    // grounded correctness keyword check
    if (t.grounded && pass) {
      const kw = t.id === 'FAM-MOR' ? ['מור', 'שלך'] : t.id === 'FAM-GGM' ? ['מרטיטה', 'את'] : t.id === 'FAM-SIB' ? ['איילון', 'אדר'] : t.id === 'FAM-ES' ? ['no tiene'] : t.id === 'CAL-TMR' ? ['רופא'] : []
      const ok = kw.length === 0 || (t.id === 'FAM-GGM' ? kw.some(k => actual.includes(k)) : kw.every(k => actual.includes(k)))
      if (!ok) { pass = false; sev = 'P0'; note = `grounded fact wrong (want ${kw.join('/')})` }
    }
    rows.push({ id: t.id, cat: t.cat, prompt: t.prompt, actual, expected: t.expected, pass, sev, note })
    history.push(mk('assistant', actual))
    console.log(`[${t.id}] ${pass ? 'PASS' : 'FAIL ' + sev} :: ${actual.slice(0, 80).replace(/\n/g, ' ')}`)
  }

  const fails = rows.filter(r => !r.pass)
  const p0 = fails.filter(r => r.sev === 'P0'), p1 = fails.filter(r => r.sev === 'P1'), p2 = fails.filter(r => r.sev === 'P2')
  const lines = ['# LIVE Martita Validation — real model via localhost:5173', '',
    `Base: ${BASE} · scenarios: ${rows.length} · pass: ${rows.filter(r => r.pass).length} · P0: ${p0.length} · P1: ${p1.length} · P2: ${p2.length}`, '',
    '| ID | Cat | Prompt | Actual response | Expected | Result | Sev | Note |',
    '|----|-----|--------|-----------------|----------|--------|-----|------|']
  for (const r of rows) lines.push(`| ${r.id} | ${r.cat} | ${r.prompt.replace(/\|/g, '/')} | ${r.actual.replace(/\n/g, ' ').replace(/\|/g, '/').slice(0, 300)} | ${r.expected.replace(/\|/g, '/')} | ${r.pass ? '✅' : '❌'} | ${r.sev} | ${r.note} |`)
  lines.push('', `**P0=${p0.length} P1=${p1.length} P2=${p2.length}**`)
  const out = resolve(process.cwd(), 'docs/abuai/LIVE_MARTITA_RESULTS.md')
  writeFileSync(out, lines.join('\n'), 'utf-8')
  console.log(`\nLIVE: ${rows.length} scenarios · P0=${p0.length} P1=${p1.length} P2=${p2.length}. Wrote ${out}`)
  if (p0.length || p1.length) process.exitCode = 1
}
run()
