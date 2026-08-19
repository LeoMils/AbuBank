/*
 * sessionRepetition.ts — E3: within ONE session she must never repeat herself verbatim.
 * ════════════════════════════════════════════════════════════════════════════
 * Device transcript: Abu repeated the Sharon answer word-for-word and re-announced the Mor card
 * twice. Card re-announce is stopped deterministically in LiveTools (an identical active card is not
 * re-created). This module is the SPOKEN-sentence half: a pure, tested guard that remembers the
 * sentences Abu has already said this session and flags a verbatim repeat, so the instruction rule is
 * backed by a real detector (recorded on the trace; a future monitor-repair can act on it).
 *
 * Pure + no I/O: normalise → split into sentences → a repeat is a sentence (of real length) already
 * said. Punctuation/whitespace/case-folded so "כן, בסדר." and "כן בסדר" count as the same line.
 */

/** Normalise a spoken line for repeat comparison: NFC, lowercase, strip punctuation, collapse space. */
export function normalizeSpokenLine(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,!?;:"'’“”…()\[\]־–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split an utterance into comparable sentences (by sentence punctuation / newlines). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** A sentence is worth guarding only if it carries real content — short acks ("כן", "טוב", "בסדר")
 *  are allowed to recur naturally and are NOT treated as a repetition. */
function isSubstantive(normalized: string): boolean {
  return normalized.split(' ').filter(Boolean).length >= 4
}

export class SessionRepetitionGuard {
  private readonly said = new Set<string>()

  /** Record what Abu just said; return the substantive sentences that are VERBATIM repeats of
   *  something she already said this session (empty when nothing repeats). */
  noteSpoken(text: string): { repeats: string[] } {
    const repeats: string[] = []
    for (const sentence of splitSentences(text)) {
      const norm = normalizeSpokenLine(sentence)
      if (!isSubstantive(norm)) continue
      if (this.said.has(norm)) repeats.push(sentence)
      else this.said.add(norm)
    }
    return { repeats }
  }

  /** Has this exact substantive line already been said this session? (No mutation.) */
  wasSaid(sentence: string): boolean {
    const norm = normalizeSpokenLine(sentence)
    return isSubstantive(norm) && this.said.has(norm)
  }

  reset(): void { this.said.clear() }
}
