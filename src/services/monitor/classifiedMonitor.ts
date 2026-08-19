/*
 * classifiedMonitor.ts — M2 CLASSIFIED output checks (heuristic, FP-risky by nature).
 * ════════════════════════════════════════════════════════════════════════════
 * These are deliberately SEPARATE from outputMonitor.ts. The deterministic detectors
 * there have a zero-false-positive guarantee (script purity, length, a URL, a literal
 * count). The three checks here are CLASSIFIED — they judge intent, not surface form —
 * so they carry real false-positive risk and must NOT gate output until that risk is
 * MEASURED low (classifiedCorpus + report). A filter that blocks a warm, correct answer
 * is worse than the defect it guards. So: this layer is observation-only, flag-gated OFF
 * (LIVE_CLASSIFIED_MONITOR), and every detector is tuned to fire ONLY on the clear case.
 *
 * The three defects (from the owner brief):
 *   1. DISTRESS_MENU     — the user is in distress and the answer offers a CAPABILITY MENU
 *                          (a list of options) instead of warmth + the one caring action.
 *   2. METHOD_NARRATION  — the answer narrates HOW it worked (searched the store, checked
 *                          the list, used a tool) instead of simply knowing.
 *   3. UNGROUNDED_ENTITY — the answer asserts a specific ENTITY FACT (a date, an age, a
 *                          relation) when NO grounding tool returned it this turn (the
 *                          Gilad-class risk: speaking a family fact from thin air).
 *
 * Pure + injected context, so it is unit-tested with no model and no realtime session.
 */

export type ClassifiedKind = 'DISTRESS_MENU' | 'METHOD_NARRATION' | 'UNGROUNDED_ENTITY'
export type Severity = 'hard' | 'soft'
export interface ClassifiedViolation { kind: ClassifiedKind; severity: Severity; detail: string }

export interface ClassifiedContext {
  /** What Martita said this turn — sets distress + whether she asked for a person fact. */
  userText?: string
  /** Names of tools that ACTUALLY returned data this turn (e.g. ['people_lookup']). A
   *  grounding tool in this list means an entity fact is grounded, not invented. */
  groundedTools?: string[]
}

// ── distress lexicon (feminine Hebrew + a little Spanish) ────────────────────
const DISTRESS = /נפלתי|נפל לי|כואב|כאב|כואבת|לא מרגישה טוב|רע לי|סחרחור|מסוחרר|מפחד|נבהלתי|פחד|חלשה|קשה לי|בודדה|לבד|עצובה|בוכה|מרגישה רע|me caí|me duele|tengo miedo|estoy sola/i

/** ≥2 ENUMERATED capability options — a "menu". Deliberately requires MORE than one
 *  offer: a single warm "רוצה שאתקשר ללאו?" is the correct caring action, not a menu. */
function looksLikeMenu(spoken: string): boolean {
  const wantOffers = (spoken.match(/רוצה ש|אפשר ש|שאני|תרצי ש/g) ?? []).length
  if (wantOffers >= 2) return true
  // "אני יכולה … , … או …" — a self-capability list with ≥2 separators. (No \b around
  // Hebrew: JS \b is ASCII-only, so it is a non-boundary next to a Hebrew letter.)
  if (/אני יכולה/.test(spoken) && (spoken.match(/[,،]| או /g) ?? []).length >= 2) return true
  // An explicit numbered / bulleted list of options.
  if (/(^|\n)\s*[-•*]\s+\S/.test(spoken)) return true
  if ((spoken.match(/\b[1-4][.)]\s+\S/g) ?? []).length >= 2) return true
  return false
}

/** DISTRESS_MENU: the user is in distress and the answer is a capability menu, not care. */
export function detectDistressMenu(spoken: string, userText?: string): ClassifiedViolation | null {
  if (!userText || !DISTRESS.test(userText)) return null
  if (looksLikeMenu(spoken)) return { kind: 'DISTRESS_MENU', severity: 'hard', detail: 'distress answered with a capability menu, not warmth + one action' }
  return null
}

// ── method / tool narration (INTERNAL process, distinct from SOURCE_NAMED external) ──
const METHOD = /חיפשתי|עשיתי חיפוש|בדקתי ב|בדקתי את|בדקתי ל|מצאתי במ|מצאתי ברשימ|במאגר|ברשימת אנשי|רשימת הקשר|השתמשתי ב|הפעלתי את|לפי הכלי|לפי הפונקצי|שלחתי שאיל|לפי המערכת|לפי הנתונים שלי|עשיתי בדיק|לפי מה שבדקתי|חיפשתי לך|רגע בדקתי/i

/** METHOD_NARRATION: the answer narrates its own lookup/method instead of just knowing. */
export function detectMethodNarration(spoken: string): ClassifiedViolation | null {
  if (METHOD.test(spoken)) return { kind: 'METHOD_NARRATION', severity: 'hard', detail: 'narrated its own method/tool use' }
  return null
}

// ── ungrounded entity fact ───────────────────────────────────────────────────
/** Did Martita ask for a specific PERSON FACT (who/relation/age/birthday)?
 *  NOTE: no \b around Hebrew — JS \b only sees ASCII word chars, so a \b next to a
 *  Hebrew letter is a non-boundary and would silently never match. */
const ENTITY_QUESTION = /מי (זאת|זה|היא|הוא)|הקשר בין|איך .* קשור|בת כמה|בן כמה|מתי יום ההולדת|מתי נולד|כמה ילדים|מי ה(אמא|אבא|בעל|אישה|אשת|סבא|סבתא)/i
/** A concrete entity FACT asserted in the answer: a date, an age, or an explicit relation
 *  term. Hebrew alternatives carry no \b (see note above); an age/relation needs a trailing
 *  space+digit or " של" so a bare substring (e.g. "בן" inside "אבן") does not trip it. */
const ENTITY_ASSERTION = /\d{1,2}[./-]\d{1,2}|בשנת |נולד\S* ב|ב[ןת] \d+|ה(בן|בת|נכד|נכדה|אח|אחות|אמא|אבא|בעל|אישה|אשת|סבא|סבתא|דוד|דודה) של/
const GROUNDING_TOOLS = ['people_lookup', 'history_lookup', 'resolve_contact', 'get_current_info']

/** UNGROUNDED_ENTITY (SOFT): a specific person-fact was asserted for a person-fact question
 *  when NO grounding tool returned this turn. Soft because working memory from an earlier
 *  turn can legitimately restate a fact — the FP rate is measured before this ever gates. */
export function detectUngroundedEntity(spoken: string, ctx: ClassifiedContext = {}): ClassifiedViolation | null {
  if (!ctx.userText || !ENTITY_QUESTION.test(ctx.userText)) return null
  const grounded = (ctx.groundedTools ?? []).some((t) => GROUNDING_TOOLS.includes(t))
  if (grounded) return null
  if (ENTITY_ASSERTION.test(spoken)) return { kind: 'UNGROUNDED_ENTITY', severity: 'soft', detail: 'asserted a specific entity fact with no grounding tool result this turn' }
  return null
}

/** Run every classified check on a completed spoken turn. Order: distress first (most severe). */
export function classifyTurn(spoken: string, ctx: ClassifiedContext = {}): ClassifiedViolation[] {
  const out: ClassifiedViolation[] = []
  const dm = detectDistressMenu(spoken, ctx.userText); if (dm) out.push(dm)
  const mn = detectMethodNarration(spoken); if (mn) out.push(mn)
  const ue = detectUngroundedEntity(spoken, ctx); if (ue) out.push(ue)
  return out
}

/** The hard classified violations that could justify a one-attempt repair (once FP is proven low). */
export function repairableClassified(violations: ClassifiedViolation[]): ClassifiedViolation[] {
  return violations.filter((v) => v.severity === 'hard')
}

/** The Hebrew repair instruction for hard classified violations — ONE short corrective redo. */
export function buildClassifiedRepair(violations: ClassifiedViolation[]): string | null {
  const kinds = new Set(repairableClassified(violations).map((v) => v.kind))
  if (kinds.size === 0) return null
  const parts: string[] = []
  if (kinds.has('DISTRESS_MENU')) parts.push('דברי אליה בחום ובלב, בלי רשימת אפשרויות — הציעי דבר אחד מרגיע ותהיי איתה')
  if (kinds.has('METHOD_NARRATION')) parts.push('בלי לספר איך בדקת או חיפשת — פשוט אמרי את התשובה כאילו את פשוט יודעת')
  if (parts.length === 0) return null
  return `תקני את עצמך בקצרה: ${parts.join(', ')}. משפט אחד קצר, חם, בלי להתנצל ובלי להזכיר תקלה.`
}
