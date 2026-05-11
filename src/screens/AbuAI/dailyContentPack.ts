/*
 * AbuAI Daily Content Pack (B2.2)
 *
 * Pure builder. Given optional sources (calendar summary, weather summary,
 * local-idea seeds, content seeds, conversation seeds) returns a small,
 * gentle pack used to enrich the proactive conversation when AbuAI opens.
 *
 * Truth rules:
 *   • If a field is missing or empty, it is OMITTED — never invented.
 *   • The pack NEVER overrides live tool results. It is a soft layer.
 *   • At most 5 content seeds in the final output. Long lists are
 *     truncated quietly so the renderer never overwhelms Martita.
 */

export interface DailyPackInput {
  /** Pre-computed Hebrew/Spanish/English calendar one-liner — provided
   *  by the runtime when the calendar tool returned something. */
  calendarSummary?: string | null
  /** Pre-computed weather one-liner — provided by the runtime when the
   *  weather source returned something. */
  weatherSummary?: string | null
  /** Up to N short ideas for "what is nearby today" — already cleaned. */
  localIdeas?: ReadonlyArray<string>
  /** Up to N short evergreen content seeds (story, film, podcast). */
  contentSeeds?: ReadonlyArray<string>
  /** Up to N short conversation prompts (memories, riddles, …). */
  conversationSeeds?: ReadonlyArray<string>
}

export interface DailyContentPack {
  calendarSummary?: string
  weatherSummary?: string
  localIdeas: ReadonlyArray<string>
  contentSeeds: ReadonlyArray<string>
  conversationSeeds: ReadonlyArray<string>
  totalSeeds: number
}

const MAX_TOTAL_SEEDS = 5

function dedupeAndTrim(values: ReadonlyArray<string> | undefined): string[] {
  if (!values || values.length === 0) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const trimmed = (v ?? '').trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/**
 * Build a daily content pack. Pure — missing data is omitted; no LLM,
 * no fetch. Honours the 5-seed cap by trimming evenly across categories.
 */
export function buildDailyContentPack(input: DailyPackInput = {}): DailyContentPack {
  const localIdeas = dedupeAndTrim(input.localIdeas)
  const contentSeeds = dedupeAndTrim(input.contentSeeds)
  const conversationSeeds = dedupeAndTrim(input.conversationSeeds)

  // Cap total to MAX_TOTAL_SEEDS — sample evenly across categories.
  const slots = capSlots([localIdeas.length, contentSeeds.length, conversationSeeds.length], MAX_TOTAL_SEEDS)
  const cappedLocal = localIdeas.slice(0, slots[0])
  const cappedContent = contentSeeds.slice(0, slots[1])
  const cappedConv = conversationSeeds.slice(0, slots[2])

  const calendar = (input.calendarSummary ?? '').trim()
  const weather = (input.weatherSummary ?? '').trim()

  const pack: DailyContentPack = {
    localIdeas: cappedLocal,
    contentSeeds: cappedContent,
    conversationSeeds: cappedConv,
    totalSeeds: cappedLocal.length + cappedContent.length + cappedConv.length,
  }
  if (calendar) pack.calendarSummary = calendar
  if (weather) pack.weatherSummary = weather
  return pack
}

function capSlots(counts: [number, number, number], total: number): [number, number, number] {
  // Round-robin fill so no single category dominates the cap.
  const [a, b, c] = counts
  const max = a + b + c
  if (max <= total) return [a, b, c]
  const slots: [number, number, number] = [0, 0, 0]
  let remaining = total
  let i = 0
  while (remaining > 0) {
    const idx = (i % 3) as 0 | 1 | 2
    const cur = idx === 0 ? a : idx === 1 ? b : c
    if ((slots[idx] as number) < cur) {
      slots[idx] = (slots[idx] as number) + 1
      remaining--
    } else {
      // category exhausted; check if all three are exhausted
      if (slots[0] >= a && slots[1] >= b && slots[2] >= c) break
    }
    i++
  }
  return slots
}
