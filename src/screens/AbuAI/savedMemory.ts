/*
 * Saved Memory — durable, user-COMMANDED facts (ChatGPT-style "remember that…").
 * ═══════════════════════════════════════════════════════════════════════════
 * Distinct from the passive rolling ConversationSummary (service.ts): these are
 * facts Martita EXPLICITLY asked AbuAI to keep ("תזכרי שהכלב שלי קוראים לו טוטסי"),
 * persisted in the PWA via the durable store, loaded every session, listable
 * ("מה את זוכרת עליי?") and forgettable ("תשכחי ש…"). Only what she actually said
 * is stored, and NEVER sensitive data (phone / medical / financial / street) —
 * the privacy rules are enforced here, at the write boundary.
 *
 * Persistence is `durable` (IndexedDB + localStorage mirror), so a fact stored in
 * one session is present in the next — it does NOT live in RuntimeState.
 */
import { durable } from '../../services/durableStore'

const KEY = 'abuai-saved-memories'

export interface SavedMemory { id: string; text: string; at: number }

// ── Privacy boundary (see .claude/rules/privacy*.md): never persist these. ──
const PHONE_RE = /(?:\d[\d\s-]{6,}\d)|\b0\d{1,2}[-\s]?\d{7}\b/u
const MEDICAL_RE = /תרופ|כדור(?:ים)?(?![א-ת])|מחל[הת]|סוכרת|אינסולין|לחץ\s*דם|רופא|מרשם|ניתוח|medic|pastill|remedio/iu
const FINANCIAL_RE = /סיסמ|כרטיס\s*אשראי|חשבון\s*בנק|מספר\s*חשבון|קוד\s*סודי|contraseñ|tarjeta\s*de\s*cr[eé]dito|\bpin\b/iu
const STREET_RE = /רחוב\s+\S+|רח['׳]\s*\S+|כתובת\s+\S+\s*\d|calle\s+\S+\s*\d/iu

/** True when a fact must NOT be persisted (phone / medical / financial / street). */
export function isSensitive(text: string): boolean {
  return PHONE_RE.test(text) || MEDICAL_RE.test(text) || FINANCIAL_RE.test(text) || STREET_RE.test(text)
}

// ── Store (durable-backed) ──
export function loadMemories(): SavedMemory[] {
  const list = durable.getJSON<SavedMemory[]>(KEY, [])
  return Array.isArray(list) ? list : []
}
function persist(list: SavedMemory[]): void { durable.setJSON(KEY, list) }

export type SaveResult = { ok: true; memory: SavedMemory } | { ok: false; reason: 'empty' | 'sensitive' | 'duplicate' }

export function saveMemory(text: string, now: number = Date.now()): SaveResult {
  const t = text.trim().replace(/[.。!,]+$/u, '').trim()
  if (t.length < 2) return { ok: false, reason: 'empty' }
  if (isSensitive(t)) return { ok: false, reason: 'sensitive' }
  const list = loadMemories()
  if (list.some((m) => m.text === t)) return { ok: false, reason: 'duplicate' }
  const memory: SavedMemory = { id: `m${now}_${list.length}`, text: t, at: now }
  persist([...list, memory])
  return { ok: true, memory }
}

/** Remove memories matching a free-text query (substring, either direction). */
export function forgetMemories(query: string): SavedMemory[] {
  const q = query.trim().replace(/[.。!,]+$/u, '').trim().toLowerCase()
  if (!q) return []
  const list = loadMemories()
  const removed = list.filter((m) => {
    const mt = m.text.toLowerCase()
    return mt.includes(q) || q.includes(mt)
  })
  if (removed.length) persist(list.filter((m) => !removed.some((r) => r.id === m.id)))
  return removed
}

export function clearMemories(): void { persist([]) }

// ── Command detection (deterministic; runs before the LLM) ──
export type MemoryCommand = 'save' | 'recall' | 'forget'

// "תזכרי ש…" / "תרשמי לך ש…" / Spanish "recordá que…". The "ש"/"que" complementizer
// is required, so a reminder ("תזכירי לי לקנות חלב") is NOT captured here.
const SAVE_HE_RE = /^(?:תזכרי|תזכור|זכרי|תרשמי)\s+(?:לך\s+|לי\s+)?ש(.+)/u
const SAVE_ES_RE = /^(?:record[aá]|acord[aá]te|anot[aá])\s+(?:de\s+)?que\s+(.+)/iu
// "מה את זוכרת/יודעת עליי" / "qué te acordás de mí" — requires an ABOUT-ME marker so a
// within-session "מה אמרתי קודם" is not captured.
const RECALL_HE_RE = /(?:מה|אילו\s+דברים)\s+את\s+(?:זוכרת|יודעת)\s+(?:עלי+|על\s+עצמי|ממני)|מה\s+שמור\s+לך\s+עלי+/u
const RECALL_ES_RE = /qu[eé]\s+(?:te\s+acord[aá]s|record[aá]s|sab[eé]s)\s+de\s+m[ií]/iu
// "תשכחי ש… / את … / מ…" / "olvidate de …".
const FORGET_HE_RE = /^(?:תשכחי|שכחי)\s+(?:ש|את\s+|מ)?(.+)/u
const FORGET_ES_RE = /^olvid[aá](?:te)?\s+(?:de\s+)?(?:que\s+)?(.+)/iu

export function memoryCommandType(text: string): MemoryCommand | null {
  const t = text.trim()
  if (SAVE_HE_RE.test(t) || SAVE_ES_RE.test(t)) return 'save'
  if (FORGET_HE_RE.test(t) || FORGET_ES_RE.test(t)) return 'forget'
  if (RECALL_HE_RE.test(t) || RECALL_ES_RE.test(t)) return 'recall'
  return null
}

export function parseRememberFact(text: string): string | null {
  const t = text.trim()
  const m = t.match(SAVE_HE_RE) ?? t.match(SAVE_ES_RE)
  return m?.[1]?.trim() ?? null
}
export function parseForgetQuery(text: string): string | null {
  const t = text.trim()
  const m = t.match(FORGET_HE_RE) ?? t.match(FORGET_ES_RE)
  return m?.[1]?.trim() ?? null
}
