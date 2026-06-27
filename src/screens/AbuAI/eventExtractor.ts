// ─── Dedicated Event Extraction Pass ────────────────────────────────────────
//
// Runs BEFORE event creation. The old pipeline only captured title + date +
// time, so "מחר בשבע פגישה עם אלכסנדרה בקפה גרג רעננה על הטיול לאיטליה" lost the
// WHERE (location) and the SUBJECT — exactly the production gap Leo reported.
//
// This pass scans the WHOLE utterance (not just the start) for the four entity
// kinds that date/time parsing doesn't cover:
//   • person   (WHO)     — "עם X" / "אצל X"
//   • location (WHERE)    — "בקפה …", "במסעדה …", a known city
//   • subject  (WHAT for) — "על X", "בנושא X", "לגבי X"
//   • notes    (WHY)      — "כי …", "בגלל …", "כדי …"
// Date + time stay with parseCreateDate / parseHebrewTimeDetailed.
//
// Deterministic by design — no LLM. It returns null for a field it cannot find
// (never guesses), in line with the calendar no-hallucination rule. It also
// returns `residualText`: the utterance with the location/subject/notes phrases
// removed, so the existing title extractor produces a clean "פגישה עם אלכסנדרה"
// instead of swallowing the venue and topic.

export interface ExtractedEvent {
  person: string | null
  location: string | null
  subject: string | null
  notes: string | null
  /** Text with location/subject/notes phrases stripped — feed to extractTitle. */
  residualText: string
}

// Venue head-words. "בקפה" = ב + קפה, so the ב prefix sits in the pattern and
// the head-word follows. Ordered so multi-word heads ("בית קפה") win first.
const VENUE_HEAD =
  'בית\\s+קפה|בית\\s+חולים|בית\\s+מרקחת|קפה|מסעד[הת]|מסעדת|מרפא[הת]|מרפאת|קליניק[הא]|מכון|משרד|ביה"ח|מרכז|קניון|מלון|פארק|בריכ[הת]|ספרי[יה]ה?|תיאטרון|קולנוע|אולם|מועדון|רחוב|שדרות|דירה|כתובת|תחנ[הת]|נמל|גינ[הת]|מספר[הת]|חנות'

// Known cities (Hebrew). A bare "ברעננה" with no venue still yields a location.
const CITY =
  'הוד\\s+השרון|כפר\\s+סבא|תל\\s+אביב|רמת\\s+גן|פתח\\s+תקווה|רעננה|הרצליה|נתניה|ירושלים|חיפה|באר\\s+שבע|אשדוד|ראשון\\s+לציון|חולון|בת\\s+ים|מודיעין|רחובות|כפר\\s+יונה'

// Phrases that END a captured segment (start of the NEXT field, or time/date,
// or punctuation). Used so a location/subject capture stops at the right place.
const NEXT_FIELD =
  'על\\s|על-|בנושא|בקשר|לגבי|בעניין|בשעה|בסביבות|בערך|בבוקר|בערב|בצהריים|בלילה|הערב|הלילה|הבוקר|הצהריים|אחהצ|אחה"צ|אחה״צ|' +
  // bare "ב + hour-word" so a time never leaks into a venue ("…ברעננה בשבע").
  'ב(?:אחת עשרה|שתים עשרה|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|אחת|שתיים)(?![א-ת])|' +
  'מחר|מחרתיים|היום|ביום|בעוד|כי\\s|בגלל|כדי\\s|לדבר|לדון|לשוחח|לסדר|לתאם|לבדוק|לחגוג|לאכול|לשתות|לראות'

// Purpose-verb that may precede the subject lead ("…לדבר על הטיול"). Captured as
// part of the subject span so it is stripped from the location AND the title —
// otherwise "בקפה גרג רעננה לדבר" leaked "לדבר" into the location.
const PURPOSE_VERB = '(?:לדבר|לדון|לשוחח|לסדר|לתאם|לבדוק|לחגוג|לאכול|לשתות|לראות)\\s+'

const SUBJECT_LEAD = new RegExp(`(?:^|\\s)(?:${PURPOSE_VERB})?(?:על|בנושא|בקשר\\s+ל|לגבי|בעניין)\\s+`)

// Words that must NOT be taken as a person name after עם/אצל (they belong to
// another field). Keeps "עם אלכסנדרה בקפה" → person = אלכסנדרה only.
const PERSON_STOP =
  /^(?:ב|ל|על|בנושא|לגבי|בעניין|בשעה|בבוקר|בערב|בצהריים|בלילה|מחר|מחרתיים|היום|ביום|בעוד|כי|בגלל|כדי|אחהצ)|^(?:הערב|הלילה|הבוקר|הצהריים|השבוע|השבת)$/

function clean(s: string): string {
  return s.trim().replace(/^[\s]+/u, '').replace(/[.,!?;:"'״׳]+$/u, '').trim()
}

// Strip a leading definite article from a subject: "הטיול לאיטליה" → "טיול לאיטליה".
function stripArticle(s: string): string {
  return s.replace(/^ה(?=[א-ת])/u, '').trim()
}

// Cut a captured tail at the first boundary phrase so we don't over-capture.
function sliceAtBoundary(tail: string): string {
  const re = new RegExp(`\\s+(?:${NEXT_FIELD})`, 'u')
  const m = re.exec(tail)
  return (m ? tail.slice(0, m.index) : tail)
}

/** Last index match of a global regex (the event details come after the story). */
function lastMatch(re: RegExp, text: string): RegExpExecArray | null {
  let last: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  re.lastIndex = 0
  while ((m = re.exec(text)) !== null) {
    last = m
    if (m.index === re.lastIndex) re.lastIndex++ // avoid zero-width loop
  }
  return last
}

/** Extract person from the LAST "עם X" / "אצל X", taking up to 3 name words. */
function extractPerson(text: string): string | null {
  // LAST occurrence: a 60-second story ("דיברתי עם השכנה …") must not steal the
  // person from the actual event ("… פגישה עם רותי").
  const lead = lastMatch(/(?<![֐-׿])(?:עם|אצל)\s+/gu, text)
  if (!lead) return null
  const words = text.slice(lead.index + lead[0].length).trim().split(/\s+/)
  const name: string[] = []
  for (const w of words) {
    if (name.length >= 3) break
    if (PERSON_STOP.test(w)) break
    const cw = w.replace(/[.,!?;:"'״׳]+$/u, '')
    if (!cw || cw.length < 2) break
    name.push(cw)
  }
  const joined = name.join(' ').trim()
  return joined.length >= 2 ? joined : null
}

/** Extract location: a venue phrase ("בקפה גרג רעננה") or a bare city. */
function extractLocation(text: string): { value: string; span: string } | null {
  // Venue: ב + head-word + following proper-noun words up to a boundary.
  const venueRe = new RegExp(`(?<![֐-׿])ב(${VENUE_HEAD})((?:\\s+[^\\s]+)*)`, 'u')
  const vm = venueRe.exec(text)
  if (vm) {
    const head = vm[1]!
    const restTail = sliceAtBoundary(vm[2] ?? '')
    const value = clean(`${head}${restTail}`)
    const span = `ב${head}${restTail}`
    if (value.length >= 2) return { value, span }
  }
  // Bare city: "ברעננה", "בכפר סבא".
  const cityRe = new RegExp(`(?<![֐-׿])ב(${CITY})(?![֐-׿])`, 'u')
  const cm = cityRe.exec(text)
  if (cm) {
    const value = clean(cm[1]!)
    return { value, span: `ב${cm[1]}` }
  }
  // Trailing-head venue: ONE proper-noun word FOLLOWED by a place head —
  // "בלונה פארק", "בירקון פארק". One word only, so a preceding time/period word
  // ("…בשמונה בלונה פארק") is never swallowed (the match lands on the ב nearest
  // the head). The name must not be an hour-word.
  const trailRe = /(?<![֐-׿])ב((?!(?:שמונה|שלוש|ארבע|חמש|שש|שבע|תשע|עשר|אחת|שתיים)\s)[א-ת]{2,}\s+(?:פארק|גן|מרכז|מגדל|קניון|מתחם|אצטדיון|כיכר|טיילת))(?![א-ת])/u
  const tm = trailRe.exec(text)
  if (tm) {
    const value = clean(tm[1]!)
    if (value.length >= 2) return { value, span: `ב${tm[1]}` }
  }
  return null
}

// Clean a topic noun-phrase into a tidy subject: drop a leading definite
// article ("השכירות" → "שכירות") and the "של" connector ("שכירות של הבית" →
// "שכירות הבית"). Preserves meaning; never invents.
function cleanSubject(s: string): string {
  let v = stripArticle(clean(s))
  v = v.replace(/\s+של\s+/u, ' ')
  return v.trim()
}

// ─── Purpose clause: "(אנחנו צריכים) לדבר על X" ─────────────────────────────
// A talk/discuss clause carries BOTH the subject (the topic noun) and the
// notes (the clean action phrase). The optional filler lead-in ("אנחנו
// צריכים", "אני רוצה", "כדי") is dropped from notes AND stripped from the
// residual so it never pollutes the title ("פגישה עם אלכסנדרה אנחנו צריכים").
const TALK_VERB = 'לדבר|לדון|לשוחח|לסגור|לתאם|לבדוק|להתייעץ|לסדר|להחליט|לקבוע'
const TALK_FILLER = '(?:אנחנו\\s+(?:צריכים|רוצים|חייבים)|אני\\s+(?:צריכ[הא]?|רוצ[הא]?|חייב[הת]?)|צריכים|צריכ[הא]?|רוצ[הא]?|כדי)\\s+'
const TALK_LEAD = '(?:על|בנושא|בקשר\\s+ל|לגבי|בעניין)'

function extractPurpose(text: string): { notes: string; subject: string; span: string } | null {
  const re = new RegExp(
    `(?:^|\\s)((?:${TALK_FILLER})?(${TALK_VERB})\\s+(${TALK_LEAD})\\s+(.+?))\\s*$`,
    'u',
  )
  const m = re.exec(text)
  if (!m) return null
  const fullClause = m[1]!.trim() // incl. filler — stripped from the residual
  const verb = m[2]!
  const lead = m[3]!
  const topicRaw = clean(m[4]!)
  // "על יד X" = next-to (a place), not a topic — reject.
  if (/^יד(?:\s|$)/.test(topicRaw)) return null
  const subject = cleanSubject(topicRaw)
  if (subject.length < 2) return null
  // Notes keep the verb + topic, but NOT the filler: "לדבר על השכירות של הבית".
  const notes = clean(`${verb} ${lead} ${topicRaw}`)
  return { notes, subject, span: fullClause }
}

/** Extract subject: text after the LAST "על" / "בנושא" / "לגבי" / "בעניין". */
function extractSubject(text: string): { value: string; span: string } | null {
  const m = lastMatch(new RegExp(SUBJECT_LEAD.source, 'gu'), text)
  if (!m) return null
  const after = text.slice(m.index + m[0].length)
  // "על יד X" = next to X (a location), not a subject — reject up front.
  if (/^יד(?:\s|$)/.test(after)) return null
  const tail = sliceAtBoundary(after)
  const value = stripArticle(clean(tail))
  // Reject empties and pure time/date leftovers.
  if (value.length < 2) return null
  if (/^(?:זה|זו)$/.test(value)) return null
  return { value, span: text.slice(m.index, m.index + m[0].length + tail.length) }
}

/** Extract notes: a reason clause ("כי …", "בגלל …", "כדי …"). */
function extractNotes(text: string): { value: string; span: string } | null {
  const m = /(?:^|\s)(כי|בגלל|כדי)\s+(.+)/u.exec(text)
  if (!m) return null
  const value = clean(m[2]!)
  if (value.length < 2) return null
  return { value, span: text.slice(m.index).trim() }
}

export function extractEventDetails(text: string): ExtractedEvent {
  let residual = ` ${text} `

  // Order matters: pull location, the purpose clause, and subject (with their
  // spans) out FIRST so the residual handed to the title extractor is just
  // "…פגישה עם אלכסנדרה…" — no venue, topic, or filler left to pollute it.
  const loc = extractLocation(residual)
  if (loc) residual = residual.replace(loc.span, ' ')

  let subject: string | null = null
  let notes: string | null = null

  // Reason clause ("כי/בגלל/כדי") FIRST — a self-contained marker that may itself
  // contain "לדבר על" ("…כי היא רוצה לדבר על הילדים"); capturing it whole keeps
  // the full reason in notes instead of splitting it.
  const reason = extractNotes(residual)
  if (reason) { notes = reason.value; residual = residual.replace(reason.span, ' ') }

  // Purpose clause: "(אנחנו צריכים) לדבר על X" → subject (topic) AND notes (clean
  // action phrase), whole clause (incl. filler) removed so it never reaches the
  // title. notes only set when a reason clause didn't already claim it.
  const purpose = extractPurpose(residual)
  if (purpose) {
    subject = purpose.subject
    if (!notes) notes = purpose.notes
    residual = residual.replace(purpose.span, ' ')
  }

  // Bare subject ("על X" / "בנושא X" with no talk-verb) — only if not already set.
  if (!subject) {
    const subj = extractSubject(residual)
    if (subj) { subject = subj.value; residual = residual.replace(subj.span, ' ') }
  }

  // Person is read from the residual (still contains "עם X") and is KEPT in the
  // residual so the title becomes "פגישה עם X".
  const person = extractPerson(residual)

  residual = residual.replace(/\s+/g, ' ').trim()

  return {
    person,
    location: loc?.value ?? null,
    subject,
    notes,
    residualText: residual,
  }
}
