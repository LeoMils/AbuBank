/*
 * GARBLE MUTATOR (intake-rebuild P3).
 * ════════════════════════════════════════════════════════════════════════════
 * Deterministic Hebrew STT-corruption simulator: it takes clean text and an
 * index and returns a reproducibly "garbled" variant, mimicking the real ways a
 * dictated Hebrew sentence gets mangled. NO randomness (index-seeded) so the
 * garble suite is stable and permanent.
 *
 * Mutation classes (the ones that actually show up in Martita's transcripts):
 *   • phonetic near-homophones  ק↔כ · ת↔ט · ב↔ו · ע↔א · ס↔שׂ · ח↔כ
 *   • definite-ה insertion / deletion
 *   • a splice (split a word with a space, or join two with none)
 */

/** Near-homophone swap pairs (symmetric). */
const HOMOPHONES: Array<[string, string]> = [
  ['ק', 'כ'], ['ת', 'ט'], ['ב', 'ו'], ['ע', 'א'], ['ח', 'כ'], ['ס', 'שׂ'],
]

/** Apply ONE homophone swap at the nth eligible position (deterministic). */
function swapHomophone(text: string, n: number): string {
  const chars = [...text]
  const positions: number[] = []
  for (let i = 0; i < chars.length; i++) {
    if (HOMOPHONES.some(([a, b]) => chars[i] === a || chars[i] === b)) positions.push(i)
  }
  if (positions.length === 0) return text
  const pos = positions[n % positions.length]!
  const c = chars[pos]!
  const pair = HOMOPHONES.find(([a, b]) => a === c || b === c)!
  chars[pos] = c === pair[0] ? pair[1] : pair[0]
  return chars.join('')
}

/** Insert or drop a definite ה at a word boundary (deterministic by index). */
function heNoise(text: string, n: number): string {
  const words = text.split(' ')
  if (words.length === 0) return text
  const wi = n % words.length
  const w = words[wi]!
  words[wi] = w.startsWith('ה') && w.length > 2 ? w.slice(1) : 'ה' + w
  return words.join(' ')
}

/** Split a word with a space, or join two words (deterministic by index). */
function splice(text: string, n: number): string {
  const words = text.split(' ')
  if (n % 2 === 0) {
    // split the (n)th word roughly in the middle
    const wi = n % words.length
    const w = words[wi]!
    if (w.length < 4) return text
    const cut = Math.floor(w.length / 2)
    words[wi] = w.slice(0, cut) + ' ' + w.slice(cut)
    return words.join(' ')
  }
  // join a pair
  if (words.length < 2) return text
  const wi = n % (words.length - 1)
  words.splice(wi, 2, words[wi]! + words[wi + 1]!)
  return words.join(' ')
}

/** The garble variants for a text, in a stable order. `garble(text, i)` is pure. */
export function garble(text: string, index: number): string {
  const mutators = [swapHomophone, heNoise, splice]
  const m = mutators[index % mutators.length]!
  return m(text, Math.floor(index / mutators.length))
}

/** All distinct single-mutation garbles of a text (for a suite). */
export function garbleVariants(text: string, count = 6): string[] {
  const out = new Set<string>()
  for (let i = 0; i < count * 3; i++) {
    const g = garble(text, i)
    if (g !== text) out.add(g)
    if (out.size >= count) break
  }
  return [...out]
}
