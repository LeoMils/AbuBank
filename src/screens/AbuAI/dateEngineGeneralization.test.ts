/**
 * DATE ENGINE — PROPERTY-BASED GENERALIZATION PROOF (principle C).
 * ════════════════════════════════════════════════════════════════
 * Leo's mandate: the system must KNOW date ARITHMETIC, not memorize phrases. This
 * GENERATES hundreds of novel date questions (random `now` + random N) and asserts
 * `dateReasoner` computes the right day — against an INDEPENDENT JS-Date oracle, so a
 * drift in the engine shows up as a failure, not a pass. Not a hand-picked snapshot.
 *
 * Evidence class: CODE (runs the real engine over generated data, deterministic).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dateReasoner } from './cognitiveRuntime'

beforeEach(() => {
  const s: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} })
})

const HE_DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']
const HE_WEEKDAY_IDX: Record<string, number> = { ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5, שבת: 6 }

// Deterministic PRNG (reproducible; no Math.random — banned in this repo's runtime).
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000 } }
/** A random-ish local noon date in 2025-2027 (avoids DST-midnight edge cases). */
function randDate(r: () => number): Date {
  const y = 2025 + Math.floor(r() * 3)
  const mo = Math.floor(r() * 12)
  const day = 1 + Math.floor(r() * 27) // 1..27 so month arithmetic never overflows oddly
  return new Date(y, mo, day, 12, 0, 0)
}
function addDays(d: Date, n: number): Date { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate() + n); return x }

describe('DATE_GENERALIZATION — arithmetic over generated cases', () => {
  it('"בעוד N ימים" lands on the correct weekday + day-of-month (200 cases)', () => {
    const bad: string[] = []
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed)
      const now = randDate(r)
      const n = 3 + Math.floor(r() * 18) // 3..20 (avoid 1/2 which have special words)
      const out = dateReasoner(`בעוד ${n} ימים`, now)
      const t = addDays(now, n)
      if (!out.includes(HE_DAYS[t.getDay()]!) || !out.includes(String(t.getDate()))) bad.push(`now=${now.toDateString()} +${n} → "${out}"`)
    }
    expect(bad).toEqual([])
  })

  it('"לפני N ימים" (backward) lands on the correct weekday (200 cases)', () => {
    const bad: string[] = []
    for (let seed = 500; seed < 700; seed++) {
      const r = rng(seed)
      const now = randDate(r)
      const n = 3 + Math.floor(r() * 18)
      const out = dateReasoner(`לפני ${n} ימים`, now)
      const t = addDays(now, -n)
      if (!out.includes(HE_DAYS[t.getDay()]!)) bad.push(`now=${now.toDateString()} -${n} → "${out}"`)
    }
    expect(bad).toEqual([])
  })

  it('"בעוד N שבועות" = now + 7N (150 cases)', () => {
    const bad: string[] = []
    for (let seed = 900; seed < 1050; seed++) {
      const r = rng(seed)
      const now = randDate(r)
      const n = 3 + Math.floor(r() * 8)
      const out = dateReasoner(`בעוד ${n} שבועות`, now)
      const t = addDays(now, 7 * n)
      if (!out.includes(HE_DAYS[t.getDay()]!) || !out.includes(String(t.getDate()))) bad.push(`now=${now.toDateString()} +${n}w → "${out}"`)
    }
    expect(bad).toEqual([])
  })

  it('relative day words (מחר/אתמול/מחרתיים/שלשום) resolve to now ±1/±2 (200 cases)', () => {
    const words: Array<[string, number]> = [['מחר', 1], ['אתמול', -1], ['מחרתיים', 2], ['שלשום', -2]]
    const bad: string[] = []
    for (let seed = 1200; seed < 1250; seed++) {
      const r = rng(seed)
      const now = randDate(r)
      for (const [w, off] of words) {
        const out = dateReasoner(`איזה יום ${w}`, now)
        const t = addDays(now, off)
        if (!out.includes(HE_DAYS[t.getDay()]!)) bad.push(`now=${now.toDateString()} ${w} → "${out}"`)
      }
    }
    expect(bad).toEqual([])
  })

  it('"מה השעה בעוד N שעות" = now + N hours (150 cases)', () => {
    const bad: string[] = []
    for (let seed = 1500; seed < 1650; seed++) {
      const r = rng(seed)
      const now = new Date(2026, Math.floor(r() * 12), 1 + Math.floor(r() * 27), Math.floor(r() * 24), Math.floor(r() * 60))
      const n = 3 + Math.floor(r() * 9)
      const out = dateReasoner(`מה השעה בעוד ${n} שעות`, now)
      const t = new Date(now); t.setHours(t.getHours() + n)
      const hh = String(t.getHours()).padStart(2, '0'); const mm = String(t.getMinutes()).padStart(2, '0')
      if (!out.includes(`${hh}:${mm}`)) bad.push(`now=${now.toTimeString().slice(0, 5)} +${n}h → "${out}" (want ${hh}:${mm})`)
    }
    expect(bad).toEqual([])
  })

  it('"יום <weekday> הבא" is the NEXT occurrence strictly after now (all weekdays × 60 anchors)', () => {
    const bad: string[] = []
    for (let seed = 2000; seed < 2060; seed++) {
      const r = rng(seed)
      const now = randDate(r)
      for (const [name, idx] of Object.entries(HE_WEEKDAY_IDX)) {
        const out = dateReasoner(`מתי יום ${name} הבא`, now)
        let add = (idx - now.getDay() + 7) % 7; if (add === 0) add = 7
        const t = addDays(now, add)
        if (!out.includes(String(t.getDate()))) bad.push(`now=${now.toDateString()} ${name} → "${out}" want day ${t.getDate()}`)
      }
    }
    expect(bad).toEqual([])
  })
})
