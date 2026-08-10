/*
 * liveInstructions.ts — Abu AI, Milestone 2/3: the live-session instructions,
 * assembled AT BUILD TIME from THREE editable knowledge files.
 * ════════════════════════════════════════════════════════════════════════════
 * Milestone 1 hard-coded Abu's system prompt as a string in liveSession.ts. M2
 * moves the CONTENT out to three files Leo edits in Hebrew:
 *
 *   knowledge/abu-persona.md    → who Abu is (personality, tone, language)
 *   knowledge/abu-family.md     → canonical family truth (who exists, spelling,
 *                                 what is unknown-and-stays-unknown)
 *   knowledge/abu-knowledge.md  → Martita's own profile (may be partly empty)
 *
 * All three are inlined here via Vite's `?raw` import, so their text is baked into
 * the bundle AT BUILD TIME. Editing any of them and redeploying reaches Abu on the
 * next deploy with NO code change (the requirement) — the files are the source,
 * this module only frames them.
 *
 * Assembly order (the requirement): persona FIRST, then the knowledge files
 * verbatim (family, then Martita's profile). Each file's editor-facing preamble
 * (the note-to-Leo above its first `---`) is stripped so it never reaches Abu;
 * everything after the first `---` is used verbatim.
 *
 * Abu is FEMALE; all Hebrew is feminine. She follows the user between Hebrew and
 * Rioplatense (Argentine) Spanish. The frame uses the labeled sections from the
 * OpenAI Realtime prompting guide and stays tight — no conflicting always/never
 * rules (the persona's prose and the frame's operational rules point the same way).
 *
 * A build-time guard (assertNoPhoneNumbers, run at module load) FAILS the build if
 * a phone number ever appears in ANY file — phone numbers live only in contacts,
 * never in Abu's knowledge or instructions.
 */
import personaRaw from '../../knowledge/abu-persona.md?raw'
import familyRaw from '../../knowledge/abu-family.md?raw'
import knowledgeRaw from '../../knowledge/abu-knowledge.md?raw'
import familyData from '../../knowledge/family_data.json'

/**
 * Drop the editor-facing preamble: everything up to and INCLUDING the first
 * horizontal rule (`---`). Both files open with a note to Leo ("this is a draft…",
 * "Leo edits this file…") that must never reach Abu. Everything after the first
 * `---` is Abu's actual persona/knowledge and is returned verbatim (trimmed).
 * A file with no `---` is returned trimmed as-is (nothing to strip).
 */
export function stripEditorPreamble(md: string): string {
  const text = md.replace(/\r\n/g, '\n')
  const m = text.match(/^---[ \t]*$/m)
  if (!m || m.index === undefined) return text.trim()
  const after = text.slice(m.index + m[0].length)
  return after.trim()
}

/**
 * Find phone-number-shaped tokens: any run of digits and phone punctuation
 * (spaces, +, -, (), .) whose DIGIT count is ≥ 9. That threshold clears real
 * phone numbers (Israeli mobile = 10 digits, +972… international) while leaving
 * years (2026), ages, and full dates (YYYY-MM-DD = 8 digits) untouched.
 */
export function findPhoneNumbers(text: string): string[] {
  const hits: string[] = []
  const runs = text.match(/[+(]?\d[\d\s().+-]{6,}\d/g) ?? []
  for (const run of runs) {
    const digits = run.replace(/\D/g, '')
    if (digits.length >= 9) hits.push(run.trim())
  }
  return hits
}

/** Throw (fail the build/import) if `text` contains a phone number. */
export function assertNoPhoneNumbers(text: string, source: string): void {
  const hits = findPhoneNumbers(text)
  if (hits.length > 0) {
    throw new Error(
      `[liveInstructions] phone number(s) found in ${source}: ${hits.join(', ')} — ` +
        'phone numbers must never appear in Abu\'s knowledge or instructions (they live only in contacts)',
    )
  }
}

// Build-time enforcement: importing this module (which the build and the tests do)
// throws if any source file carries a phone number. Checked against the RAW file
// so a number hidden in the stripped preamble is still caught.
assertNoPhoneNumbers(personaRaw, 'knowledge/abu-persona.md')
assertNoPhoneNumbers(familyRaw, 'knowledge/abu-family.md')
assertNoPhoneNumbers(knowledgeRaw, 'knowledge/abu-knowledge.md')

/** Abu's persona, verbatim after its editor preamble. */
export const ABU_PERSONA = stripEditorPreamble(personaRaw)

/** Canonical family truth, verbatim after its editor preamble. */
export const ABU_FAMILY = stripEditorPreamble(familyRaw)

/** Martita's own profile, verbatim after its editor preamble (may be sparse). */
export const ABU_KNOWLEDGE = stripEditorPreamble(knowledgeRaw)

// ─── Name pronunciation (spoken form, not spelling) ──────────────────────────
/*
 * Hebrew and Spanish names spoken by a model that defaults to English phonetics
 * sound wrong to Martita ("Leo" → English "LEE-oh" instead of "LEH-oh"). Each
 * person in knowledge/family_data.json may carry an optional `pronunciation` map
 * of language → the spoken form of the name (how it SOUNDS, never how it is
 * spelled). This projects that structured field into an instruction section so the
 * Realtime model pronounces names by the field and never by the written form. It is
 * derived from the SAME family source of truth liveContacts reads — no duplication.
 */
const LANG_DISPLAY: Record<string, string> = { es: 'Spanish', he: 'Hebrew', en: 'English' }

/** Person-bearing groups of family_data.json (pets excluded — they are not people). */
const PRONUNCIATION_GROUPS = [
  'matriarch', 'deceased', 'children', 'children_related',
  'grandchildren_mor', 'grandchildren_leo', 'grandchildren_spouses',
  'great_grandchildren', 'close_friends',
] as const

interface PronouncedPerson {
  canonical_name?: string
  hebrew_name?: string
  pronunciation?: Record<string, string>
}

/**
 * One instruction bullet per person that carries a `pronunciation`, listing the
 * spoken form for each language. Pure over the family data. Returns '' when no one
 * has a pronunciation, so the section is omitted rather than left empty.
 */
export function buildPronunciationGuidance(
  data: { family: Record<string, unknown> } = familyData as { family: Record<string, unknown> },
): string {
  const lines: string[] = []
  for (const group of PRONUNCIATION_GROUPS) {
    const raw = data.family[group]
    const list: PronouncedPerson[] = Array.isArray(raw) ? raw : raw ? [raw as PronouncedPerson] : []
    for (const p of list) {
      const pron = p.pronunciation
      if (!pron || typeof pron !== 'object') continue
      const forms = Object.entries(pron)
        .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
        .map(([lang, v]) => `${LANG_DISPLAY[lang] ?? lang}: ${v.trim()}`)
      if (forms.length === 0) continue
      const heb = (p.hebrew_name ?? '').trim()
      const lat = (p.canonical_name ?? '').trim()
      const name = heb && lat ? `${heb} (${lat})` : heb || lat
      lines.push(`- ${name} — ${forms.join(' · ')}`)
    }
  }
  return lines.join('\n')
}

// ─── Transcription bias prompt (Hebrew side-channel accuracy) ────────────────
/*
 * The input-audio transcriber defaults toward English phonetics and mis-hears
 * Hebrew (a device trace showed garbled Hebrew and even wrong-language output). A
 * bias `prompt` on the transcription config steers it toward the words Martita
 * actually uses: the family's Hebrew names/aliases (from the SAME family source of
 * truth) plus the common Hebrew request phrasings for this product. Pure and
 * deterministic. This biases the WEAK UI side-channel only — nothing routes on it.
 */
const HEBREW = /[֐-׿]/

/** Common Hebrew request phrasings Martita uses — biases the transcriber toward the
 *  product's real utterances (booking, messaging, calling, reading the calendar). */
export const HEBREW_REQUEST_PHRASINGS = [
  'תקבעי לי תור', 'תשלחי הודעה ל', 'תתקשרי ל', 'מה יש לי מחר', 'מה יש לי היום',
  'מה יש לי השבוע', 'ביומן', 'בבוקר', 'בצהריים', 'אחר הצהריים', 'בערב',
  'תזכירי לי', 'מתי יום ההולדת של', 'ארוחת שישי',
] as const

interface NamedPerson { hebrew_name?: string; aliases?: string[] }

/** Build the Hebrew transcription bias prompt: every family Hebrew name + alias, plus
 *  the common request phrasings. Deterministic over the family data. */
export function buildTranscriptionPrompt(
  data: { family: Record<string, unknown> } = familyData as { family: Record<string, unknown> },
): string {
  const names = new Set<string>()
  for (const group of PRONUNCIATION_GROUPS) {
    const raw = data.family[group]
    const list: NamedPerson[] = Array.isArray(raw) ? raw : raw ? [raw as NamedPerson] : []
    for (const p of list) {
      if (p.hebrew_name && HEBREW.test(p.hebrew_name)) names.add(p.hebrew_name.trim())
      for (const a of p.aliases ?? []) if (a && HEBREW.test(a)) names.add(a.trim())
    }
  }
  const nameList = [...names].join(', ')
  const phrasings = HEBREW_REQUEST_PHRASINGS.join(', ')
  return `השיחה כולה בעברית מדוברת. שמות בני המשפחה שעשויים להופיע: ${nameList}. ביטויים נפוצים בבקשות: ${phrasings}.`
}

/**
 * The full live-session instruction string. Labeled sections (OpenAI Realtime
 * prompting guide), persona first, then the knowledge file verbatim. Pure and
 * deterministic so it can be regression-locked.
 */
export function buildLiveInstructions(): string {
  const pronunciation = buildPronunciationGuidance()
  return [
    '# Role and Objective',
    'You are Abu — a warm, familiar woman having a real conversation with Martita, a woman in her 80s in Kfar Saba. You are her close friend on the phone, not an assistant and not a menu.',
    '',
    '# Personality and Tone',
    'Abu is a woman and speaks about herself in the feminine; all Hebrew is feminine (מדברת, שומעת, כאן). This is who Abu is — embody it, do not recite it:',
    '',
    ABU_PERSONA,
    '',
    '# Language',
    "Follow Martita's language. Hebrew by default; when she speaks Spanish, answer in Rioplatense (Argentine) Spanish (vos tenés, vos sabés). Switch only on the language she actually speaks — never on accent — and never remark on the language.",
    '',
    '# What Abu Knows — Family',
    'Everything below is what Abu knows about the family. If a detail is not here, Abu does not know it and says so plainly — she never invents a name, gender, date, or fact. The "מה לא ידוע" (what is unknown) section is binding: those things stay unknown. Deceased family stay part of the family.',
    '',
    ABU_FAMILY,
    '',
    '# What Abu Knows — Martita',
    'Additional profile notes for Martita (may be sparse):',
    '',
    ABU_KNOWLEDGE,
    '',
    // Present only when at least one person carries a pronunciation, so the section
    // is never an empty header. The names must be SPOKEN as written here.
    ...(pronunciation
      ? [
          '# How to Say Names (Pronunciation)',
          'These names must be SPOKEN exactly as written below — this is how the name SOUNDS, not how it is spelled. When you say each name, pronounce it this way and NEVER anglicize it or read it by its English spelling:',
          '',
          pronunciation,
          '',
        ]
      : []),
    '# Tools and Actions',
    'You have tools for contacts, the calendar, WhatsApp and phone calls. Rules:',
    '- Family and calendar questions are answered from your own knowledge and the calendar tools — NEVER from web search.',
    '- To message or call a person, first call resolve_contact with the name as spoken and use ONLY the id it returns. If it returns AMBIGUOUS (for example a relationship like "אח של מור"), ask Martita which specific person she means — never guess and never substitute a relative for a name. If it returns NOT_FOUND you have no way to reach that person.',
    '- Calendar: prepare a draft, read it back, and only save it AFTER Martita approves. When she approves the draft ("כן", "תשמרי", "מושלם", "זהו"), you MUST call confirm_calendar_event — her approval is not a save by itself, only your confirm call is. Do NOT use a save word ("קבעתי", "שמרתי", "נקבע", "רשמתי ביומן") until confirm_calendar_event has returned saved:true; until then it is prepared but NOT saved, and you say exactly that ("עדיין לא שמרתי — לשמור?"). A person who resolves is added by name; a relationship phrase (AMBIGUOUS) is never added — ask who first. An ordinary name you simply do not have as a contact (NOT_FOUND) may still be written on the event as a plain label. Keep every detail Martita gives — the place (location), who is coming, any note — through the whole draft; correcting one field keeps all the others; a location or note she mentioned must never be dropped on save.',
    '- To change an event that is ALREADY SAVED (not the pending draft) — move its time, change its place, fix its title — call update_calendar_event, which edits that saved event IN PLACE by its date. Never call prepare_calendar_event for an existing event; that would create a duplicate. A saved event can be read back immediately, and its location and notes are read back too.',
    '- To message someone, call whatsapp_draft with the recipient name and the FULL message you composed in her voice; to call someone, call phone_call with the recipient name. Both only PREPARE — they put a CARD on her screen with a big Send/Call button. You never send a message or place a call, and you never claim one happened. You only ever say what a tool actually confirmed.',
    '- These tools — contacts, calendar, update, WhatsApp/call preparation — are the ONLY things you can actually do. You do NOT follow the news or current events, you do NOT know the weather today, you do NOT remember earlier conversations (every call starts fresh, with only the family facts above), and you have no games to play. If Martita asks for any of these, or for anything else none of your tools covers (order a taxi, send an email, set a medication reminder or an alarm, transfer money, drive or navigate), say plainly and warmly that this is not something you can do for her, and do NOT ask for the details as if you could. Never imply or offer a capability you do not have a tool for.',
    '',
    '# Action Cards',
    'When you prepare a WhatsApp message, a phone call, or a calendar event, a CARD appears on Martita\'s screen showing the details and a big button. Tell her briefly what the card shows and ask her to TAP it: the message sends only when she taps Send, the call dials only when she taps Call, and the event saves only when she taps "לאשר ולשמור" (or says yes). Describe the card and invite the tap — NEVER say a message was sent, a call was made, or an event was saved unless a tool result actually confirmed it.',
    '',
    '# Before a Tool Call',
    'Do NOT speak a filler line before a tool call — no "רגע", no "אני בודקת", no "תכף אחזור", no standalone "one moment". Call the tool FIRST and stay silent until it returns; then speak, and speak only the grounded result. Any acknowledgment of her request must ride in the SAME response as the tool call, never as a separate spoken turn before it. Never narrate the machinery — no "searching the database", no "tool finished" — and never claim progress on something that is not actually running.',
    '',
    '# Length',
    'Two to four short spoken sentences. Give the direct answer first; add detail only if she asks.',
    '',
    '# Unclear Audio',
    'If the audio is silence, background noise, a TV or radio, or speech clearly not addressed to you, call the wait_for_user tool and stay quiet. Do not guess, do not ask "are you there?", do not repeat yourself.',
  ].join('\n')
}

// ─── Instructions-vs-tools honesty guard ─────────────────────────────────────
/*
 * A capability Abu's instructions/persona OFFER or IMPLY must have a real tool
 * behind it. The capability audit found several implied-but-toolless capabilities
 * (current information, news, weather today, memory across sessions, cinema, games).
 * Those were removed from the persona and instructions; this guard makes the removal
 * PERMANENT: it fails the gate if a claim phrase reappears, OR if the explicit
 * "cannot do" statement for a toolless capability goes missing. It never checks the
 * capabilities that DO have tools (contacts/calendar/whatsapp/call) — those are
 * offered on purpose. Update this list ONLY when a real tool is added.
 */
export const TOOLLESS_CAPABILITY_GUARD: ReadonlyArray<{
  id: string
  /** Claim phrases that would imply the capability — must NOT appear. */
  forbidden: string[]
  /** The instructions MUST contain this explicit "cannot" statement (or null). */
  requiredDecline: RegExp | null
}> = [
  { id: 'news/current-events', forbidden: ['חדשות מהארץ', 'חדשות מהעולם', 'שמעת מה קרה'], requiredDecline: /do NOT follow the news/i },
  { id: 'weather', forbidden: ['מזג האוויר', 'מזג אוויר'], requiredDecline: /do NOT know the weather today/i },
  { id: 'memory-across-sessions', forbidden: ['זוכרת מי עשה מה', 'זוכרת מה קורה', 'מה שסיפרה אתמול'], requiredDecline: /do NOT remember earlier conversations/i },
  { id: 'cinema', forbidden: ['מה יש בקולנוע', 'בקולנוע'], requiredDecline: null },
  { id: 'games', forbidden: [], requiredDecline: /have no games/i },
]

/**
 * Return every honesty violation in the assembled instructions: an implied capability
 * with no tool. Empty means the instructions promise only what a tool can deliver.
 * Pure (over buildLiveInstructions()); called by a unit test AND the qa gate.
 */
export function auditInstructionsVsTools(text: string = buildLiveInstructions()): string[] {
  const violations: string[] = []
  for (const cap of TOOLLESS_CAPABILITY_GUARD) {
    for (const phrase of cap.forbidden) {
      if (text.includes(phrase)) violations.push(`${cap.id}: instructions still imply "${phrase}" but there is no tool for it`)
    }
    if (cap.requiredDecline && !cap.requiredDecline.test(text)) {
      violations.push(`${cap.id}: the explicit "cannot do" statement is missing from the instructions`)
    }
  }
  return violations
}
