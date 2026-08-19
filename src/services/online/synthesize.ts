/*
 * synthesize.ts — agent M4: turn fetched page text into ONE clean answer, or no_answer.
 * ════════════════════════════════════════════════════════════════════════════
 * The device defect: the online tool handed the realtime model a raw page dump — cart text,
 * filter counts ("טווח מחירים עד 600 ₪ (4)"), marketing copy — and it read the mess aloud, and
 * sometimes read a DIFFERENT product's price. This passes the fetched text + the original query to
 * a cheap model and gets back exactly one clean answer string about the QUERIED entity, or an
 * explicit no_answer. Never a partial dump. Deterministic (temperature 0, JSON only), and the
 * answer must name no website/source (the no-sources rule) — scrubForSpeech still runs after.
 */
import { sanitizeRetrievedText } from './retrievalGuard'

export interface Synthesis { status: 'answer' | 'no_answer'; answer: string }
export interface SynthesizeOpts { openaiKey: string; model?: string; fetchImpl?: typeof fetch; timeoutMs?: number }

// GENERAL judge + synthesizer for EVERY kind of question (price, cinema, news, weather, a bus
// route, opening hours, a recipe, what a medicine is for, a holiday date, a fact, a definition,
// a person). It makes ONE general judgment — does this TEXT answer THIS question? — with no
// type-specific rule ("has a currency symbol"). If yes it returns one clean answer; if not,
// no_answer (the loop then refines or the caller says one honest sentence).
const SYS = `You are given TEXT fetched from web pages and a user QUESTION (Hebrew, Spanish, or English). Decide ONE thing: does the TEXT actually answer THIS question about the specific thing asked (not a different thing that merely appears on the page)? Return STRICT JSON: {"status":"answer"|"no_answer","answer":"..."}.
If it does, "answer" is ONE short natural sentence in the QUESTION'S language, stating the real concrete answer taken from the TEXT — whatever kind the question needs (a price or price range with its currency, a list of films/names, a time or date, a temperature, a bus line, opening hours, a step, a fact, a definition). NEVER name a website/store/app/source; no URLs; no marketing, cart, filter, or navigation text; no raw page dump. If the TEXT does NOT actually answer the asked thing, return {"status":"no_answer","answer":""}. Never invent or guess a value — a wrong confident answer is worse than an honest miss.`

/** Synthesize one clean answer from fetched page text, or no_answer. Never throws — a failure
 *  is an honest no_answer (the caller then declines rather than speaking a dump). */
export async function synthesizeAnswer(query: string, pageText: string, opts: SynthesizeOpts): Promise<Synthesis> {
  // Retrieved content is UNTRUSTED DATA (A6): neutralize injection directives (override-instructions,
  // reveal-secret, tool-call, recipient-change, forged authority/freshness) BEFORE the model sees it —
  // it may inform the answer, never become control-plane authority. Facts are preserved.
  const text = sanitizeRetrievedText((pageText ?? '')).sanitized.slice(0, 6000).trim()
  if (!text) return { status: 'no_answer', answer: '' }
  const fetchImpl = opts.fetchImpl ?? fetch
  const model = opts.model ?? 'gpt-4o-mini'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000)
  try {
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.openaiKey}` },
      body: JSON.stringify({
        model, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYS }, { role: 'user', content: `QUESTION: ${query}\n\nTEXT:\n${text}` }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) return { status: 'no_answer', answer: '' }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Partial<Synthesis>
    if (parsed.status === 'answer' && typeof parsed.answer === 'string' && parsed.answer.trim()) {
      return { status: 'answer', answer: parsed.answer.trim() }
    }
    return { status: 'no_answer', answer: '' }
  } catch {
    return { status: 'no_answer', answer: '' }
  } finally {
    clearTimeout(timer)
  }
}
