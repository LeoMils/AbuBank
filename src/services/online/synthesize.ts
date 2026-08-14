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
export interface Synthesis { status: 'answer' | 'no_answer'; answer: string }
export interface SynthesizeOpts { openaiKey: string; model?: string; fetchImpl?: typeof fetch; timeoutMs?: number }

const SYS = `You are given TEXT fetched from web pages and a user QUESTION (Hebrew or Spanish). Extract ONLY the answer to the question about the SPECIFIC product/place/thing asked — not a different product that also appears on the page. Return STRICT JSON: {"status":"answer"|"no_answer","answer":"..."}.
Rules for "answer": ONE short natural sentence in the QUESTION'S language; a real concrete value (a price or price RANGE with its currency, a real list of names, a real time) taken from the TEXT; NEVER a website/store/app/source name; no URLs; no marketing copy; no cart/filter text. If the TEXT does not actually contain the answer FOR THE ASKED thing, return {"status":"no_answer","answer":""}. Never invent a value.`

/** Synthesize one clean answer from fetched page text, or no_answer. Never throws — a failure
 *  is an honest no_answer (the caller then declines rather than speaking a dump). */
export async function synthesizeAnswer(query: string, pageText: string, opts: SynthesizeOpts): Promise<Synthesis> {
  const text = (pageText ?? '').slice(0, 6000).trim()
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
