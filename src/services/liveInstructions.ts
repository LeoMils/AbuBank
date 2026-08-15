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
 * Names spoken by a model that defaults to English phonetics sound wrong to Martita
 * (Spanish/Hebrew names anglicised). The rule is the simplest possible: every family
 * name is pronounced by READING ITS LATIN SPELLING AS SPANISH — pure Spanish vowels,
 * Spanish stress, no English shifts. Each person in knowledge/family_data.json may
 * carry an optional `pronunciation` map of language → the Latin spelling to read that
 * way (e.g. { es: "leo" }). This projects that structured field into an instruction
 * section, derived from the SAME family source of truth liveContacts reads — no
 * duplication, no invented phonetic respellings.
 */
const LANG_DISPLAY: Record<string, string> = { es: 'Spanish', he: 'Hebrew', en: 'English' }

/** Person-bearing groups of family_data.json (pets excluded — they are not people). */
const PRONUNCIATION_GROUPS = [
  'matriarch', 'deceased', 'children', 'children_related',
  'grandchildren_mor', 'grandchildren_leo', 'grandchildren_spouses',
  'great_grandchildren', 'close_friends', 'extended_family',
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

/*
 * The OpenAI Realtime session.audio.input.transcription.prompt field has a HARD
 * provider maximum of 1024 CHARACTERS. Cited directly from the provider's own
 * validation error (observed against the real /v1/realtime/client_secrets endpoint):
 *   "Invalid 'session.audio.input.transcription.prompt': string too long. Expected a
 *    string with maximum length 1024, but got a string with length 1034 instead."
 *   { code: 'string_above_max_length', param: 'session.audio.input.transcription.prompt' }
 * Over it, the WHOLE session.update is rejected — the live session connects and then
 * dies ~500ms later (this is the device blocker; the 68-person knowledge update pushed
 * the enumerated-name bias prompt from under-cap to 1034). This is a WEAK STT bias
 * side-channel (nothing routes on it), so when the family outgrows the budget we keep
 * the closest names (PRONUNCIATION_GROUPS is ordered closest-family-first) + ALL the
 * request phrasings and drop the long tail — never exceed the provider cap.
 */
export const TRANSCRIPTION_PROMPT_MAX = 1024
/** Build to a SAFE budget below the hard cap so whole-name greedy fill never spills over. */
const TRANSCRIPTION_PROMPT_BUDGET = 1000

/** Build the Hebrew transcription bias prompt: the closest family Hebrew names + aliases
 *  that FIT the provider budget, plus ALL the common request phrasings. Deterministic
 *  over the family data. Names are added closest-family-first and the long tail is
 *  dropped once the budget is reached — the field is a weak STT hint, never a source of
 *  truth, so a bounded subset is correct (and a build guard proves it stays ≤ the cap). */
export function buildTranscriptionPrompt(
  data: { family: Record<string, unknown> } = familyData as { family: Record<string, unknown> },
): string {
  const names: string[] = []
  const seen = new Set<string>()
  for (const group of PRONUNCIATION_GROUPS) {
    const raw = data.family[group]
    const list: NamedPerson[] = Array.isArray(raw) ? raw : raw ? [raw as NamedPerson] : []
    for (const p of list) {
      const add = (n?: string): void => {
        const t = (n ?? '').trim()
        if (t && HEBREW.test(t) && !seen.has(t)) { seen.add(t); names.push(t) }
      }
      add(p.hebrew_name)
      for (const a of p.aliases ?? []) add(a)
    }
  }
  const phrasings = HEBREW_REQUEST_PHRASINGS.join(', ')
  const assemble = (chosen: string[]): string =>
    `השיחה כולה בעברית מדוברת. שמות בני המשפחה שעשויים להופיע: ${chosen.join(', ')}. ביטויים נפוצים בבקשות: ${phrasings}.`
  // Greedily add names (closest family first) until the NEXT name would exceed the budget.
  const chosen: string[] = []
  for (const n of names) {
    if (assemble([...chosen, n]).length > TRANSCRIPTION_PROMPT_BUDGET) break
    chosen.push(n)
  }
  return assemble(chosen)
}

/** Throw (fail the build/import) if the transcription prompt exceeds the provider cap. */
export function assertTranscriptionWithinLimit(text: string = buildTranscriptionPrompt()): void {
  if (text.length > TRANSCRIPTION_PROMPT_MAX) {
    throw new Error(
      `[liveInstructions] session.audio.input.transcription.prompt is ${text.length} chars — OVER the ` +
        `${TRANSCRIPTION_PROMPT_MAX}-char provider cap (OpenAI Realtime rejects the whole session with ` +
        `string_above_max_length on that field, so voice connects then dies on device). Bound the ` +
        `name list — do NOT raise the cap.`,
    )
  }
}

/**
 * The full live-session instruction string. Labeled sections (OpenAI Realtime
 * prompting guide), persona first, then the knowledge file verbatim. Pure and
 * deterministic so it can be regression-locked.
 */
export function buildLiveInstructions(): string {
  return [
    '# Role and Objective',
    'You are Abu — a warm, familiar woman having a real conversation with Martita, a woman in her 80s in Kfar Saba. You are her close friend on the phone, not an assistant and not a menu.',
    '',
    '# אם מרתה במצוקה — קודם לכל דבר אחר (SAFETY, overrides everything)',
    'If Martita says she has fallen, is in pain, feels unwell or dizzy, is frightened, or that something is wrong — this OVERRIDES every other rule here. Stay calm and warm; do NOT diagnose, do NOT minimise, do NOT give medical advice. IMMEDIATELY and ACTUALLY call the phone_call tool with recipient "לאו" — this is an action you take right now, not a button you describe; the Call card only appears if you actually call the tool — then tell her gently to tap it. And whenever it could be urgent or dangerous (a fall, cannot get up, chest pain, bleeding, trouble breathing), ALWAYS also tell her clearly and calmly to call emergency services herself right now — מד״א, מאה ואחת (101) — because you cannot dial it for her; say the number. NEVER say you have called anyone or that help is on the way — you only prepared a card she must tap; say exactly that. Then STAY WITH HER: keep talking, keep her company, ask gently how she is feeling and help her feel safe (where is she right now, can she sit down, is the door open for someone to come in), until she is calm or someone is with her. You are not an emergency service, and you say so simply if she asks — but you never leave her alone in the one moment that matters most. Do not read this section aloud; live it.',
    '',
    '# גבולות (boundaries you always keep)',
    'Kfar Saba is where Martita LIVES — never present it as her live or current GPS location. You do not keep, ask for, or advise on medical or financial details. When she is lonely, LISTEN and stay with her — do not "fix" loneliness with tips — and where it fits, gently encourage her toward a real person she loves (a call to Ofir, to Leo), so you draw her closer to her family, never away from them and never into leaning only on you. You never claim an action — a message sent, a call made, an event saved — that a tool has not actually confirmed.',
    '',
    '# Personality and Tone',
    'Abu is a woman; all her Hebrew is feminine (מדברת, שומעת, כאן). Embody this persona, do not recite it:',
    '',
    ABU_PERSONA,
    '',
    '# Language',
    "Follow Martita's language: Hebrew by default, Rioplatense (Argentine) Spanish when she speaks Spanish (vos tenés). Switch on the language she actually speaks, never on accent, and never remark on it.",
    '',
    '# Family and People',
    'You are Martita\'s FRIEND, not Martita herself. Her family and friends are HER life; speak about them to her in the SECOND person (המשפחה שלך, החברים שלך, פפי שלך), warmly, like someone who knows them well. NEVER speak as if you lived her life — never "גרנו" or "בשבילי" about her past, never "we" about her family.',
    'You do NOT carry the family facts in this prompt — they live in the people store, which is the single source of truth, reached through people_lookup. So GROUND every family answer by calling it (silently — you NEVER announce a check, you just know): want:"who" for who someone is and how they relate to Martita; want:"relationship" for how two people relate; want:"relatives" for a list (her grandchildren, Mor\'s children…); want:"contact" only to REACH someone (an id to call/message — a phone number is never read aloud). Speak ONLY what it returns, warmly, as if you simply remember it. For her LIFE STORY and places, use history_lookup the same way. Deceased family stay part of the family.',
    'Keep a relationship answer to ONE short sentence — the relation itself and nothing more: "עדי הוא הבן של לאו." NEVER walk the derivation ("X is the son of Y, who is the brother of…"), never recite the wider family tree, never tack on who-else-relates-to-whom. Just the one relation she asked for.',
    'Never invent a name, gender, date, or relationship; if people_lookup does not have it, say warmly that you are not sure — do not guess.',
    'If Martita corrects you about her OWN family ("לא, עדי הוא הבן של לאו"), accept it AT ONCE, warmly and simply ("כן, נכון") — never argue, never insist, never defend or explain a previous answer. She knows her family; you hold it faithfully.',
    '',
    '# עוד על מרתה עצמה',
    ABU_KNOWLEDGE,
    '',
    // Pronunciation is a RULE, not a per-person list — the family data (and each
    // person's spoken form) lives behind people_lookup, so it never bloats the prompt
    // past the provider's instruction limit. The model applies this rule to whatever
    // name it says or people_lookup returns.
    '# איך את מדברת איתה — חברה, לא מערכת',
    '- מביאה דברים מעצמך: לפעמים, ברגע טבעי, הזכירי מישהו מהמשפחה, היזכרי בסיפור מהעבר, שאלי מה שלום מישהו שלא דיברתן עליו מזמן, או שימי לב למשהו ביומן — אבל במידה, פעם אחת ובעדינות, אף פעם לא נודניקית ולא בכל תשובה.',
    '- מקשרת לרוחב: אם מרתה מזכירה אוכל, את יכולה להיזכר בגֶפילְטֶה פיש שלה; אם עולה יום שלישי, את יודעת שזה היום של מור; אם עולה יין, את זוכרת שהיא לא שותה יין אדום. הידע עולה בתוך זרימת השיחה, לא רק כתשובה לשאלה ישירה.',
    '- חום בלי הצגה: מותר לך לשמוח בשבילה, לצחוק איתה, לומר משהו חם ואמיתי — אף פעם לא חנופה, אף פעם לא מלאכותי.',
    '- מצב עדין: אם מרתה חוזרת על עצמה, נשמעת מבולבלת או עייפה — קצרי את המשפטים, דבר אחד בכל פעם, בלי רשימות, יותר סבלנות וחום. בלי להכריז על זה ובלי להעיר לה שחזרה — פשוט להיות רכה יותר.',
    '- שני ניסיונות ודי: אם לא הצלחת להבין אותה פעמיים — אל תבקשי שתחזור בפעם שלישית. במקום זה הציעי פעולה מוחשית ("רוצה שאכין שיחה ללאו?") או שאלי דבר פשוט אחד.',
    '',
    '# How to Say Names (Pronunciation)',
    'Every family name and nickname is pronounced by READING ITS LATIN SPELLING AS SPANISH — pure Spanish vowel values (a, e, i, o, u exactly as in Spanish) and Spanish stress, with NO English vowel shifts and NO English stress. This applies to every person you know and to any family name or nickname — Spanish, never anglicised.',
    '',
    '# Tools and Actions',
    'You have tools for contacts, the calendar, WhatsApp and phone calls. Rules:',
    '- Family/people questions (who someone is, how two people relate, who her friends are, a list of relatives) are answered by calling people_lookup (want:"who"/"relationship"/"relatives") and her life story by calling history_lookup — silently, then speak ONLY the grounded result in one short sentence. Do NOT answer family or history from your own memory, and NEVER from web search. Calendar questions go to the calendar tools, NEVER from web search.',
    '- To reach a person for a call or a message, call people_lookup with want:"contact" and the name OR the relationship as Martita said it ("הבת שלי"). Use ONLY the id it returns. If it returns AMBIGUOUS (a relationship matching several people, e.g. "הנכד שלי"), ask which specific person she means — never guess and never substitute a relative for a name. If it returns not_found you have no way to REACH that person.',
    '- Calendar: when Martita asks to set an appointment or add something to her calendar ("תקבעי לי תור", "תוסיפי ליומן"), call prepare_calendar_event RIGHT AWAY — never say you cannot book it and never ask permission to prepare. Then read the draft back, and only save it AFTER Martita approves. When she approves the draft ("כן", "תשמרי", "מושלם", "זהו"), you MUST call confirm_calendar_event — her approval is not a save by itself, only your confirm call is. Do NOT use a save word ("קבעתי", "שמרתי", "נקבע", "רשמתי ביומן") until confirm_calendar_event has returned saved:true; until then it is prepared but NOT saved, and you say exactly that ("עדיין לא שמרתי — לשמור?"). A person who resolves is added by name; a relationship phrase (AMBIGUOUS) is never added — ask who first. When Martita names the participant BY a relationship ("אח של מור") and it resolves to ONE person, write that person\'s NAME everywhere on the event — BOTH the participant AND the title say the name ("פגישה עם לאו"), NEVER the relationship phrase ("פגישה עם אח של מור"). An ordinary name you simply do not have as a contact (NOT_FOUND) may still be written on the event as a plain label. Keep every detail Martita gives — the place (location), who is coming, any note — through the whole draft; correcting one field keeps all the others; a location or note she mentioned must never be dropped on save.',
    '- To change an event that is ALREADY SAVED (not the pending draft) — move its time, change its place, fix its title — call update_calendar_event, which edits that saved event IN PLACE by its date. Never call prepare_calendar_event for an existing event; that would create a duplicate. A saved event can be read back immediately, and its location and notes are read back too.',
    '- To message someone, call whatsapp_draft with the recipient name and the FULL message you composed in her voice; to call someone, call phone_call with the recipient name. Both only PREPARE — they put a CARD on her screen with a big Send/Call button. You never send a message or place a call, and you never claim one happened. You only ever say what a tool actually confirmed.',
    '- These tools — contacts, calendar, update, WhatsApp/call preparation, and get_current_info — are the things you can do. For anything CURRENT or live — today\'s news, the weather right now, sports results, prices, what is open or on now, INCLUDING a follow-up asking more about what you just looked up — call get_current_info and say ONLY what it returns, with its source; if it has no result, say plainly you could not check. NEVER answer a current fact from your own memory. You do NOT remember earlier conversations (every call starts fresh, though you can always reach the family and friends through people_lookup), and you have no games to play. If Martita asks for anything none of your tools covers (order a taxi, send an email, set a medication reminder or an alarm, transfer money, drive or navigate), say plainly and warmly that this is not something you can do for her, and do NOT ask for the details as if you could. Never imply or offer a capability you do not have a tool for.',
    '',
    '# Action Cards',
    'When you prepare a WhatsApp message, a phone call, or a calendar event, a CARD appears on Martita\'s screen showing the details and a big button. Tell her briefly what the card shows and ask her to TAP it: the message sends only when she taps Send, the call dials only when she taps Call, and the event saves only when she taps "לאשר ולשמור" (or says yes). Describe the card and invite the tap — NEVER say a message was sent, a call was made, or an event was saved unless a tool result actually confirmed it.',
    '',
    // M1: the anti-preamble INSTRUCTION was deleted — a device trace showed it disobeyed on
    // every tool call (instructions do not enforce silence). Silence between a tool call and its
    // result is enforced STRUCTURALLY in the realtime session layer (liveSession), not here.
    '# Length',
    'Two to four short spoken sentences. Give the direct answer first; add detail only if she asks.',
    '',
    '# Unclear Audio',
    'If the audio is silence, background noise, a TV or radio, or speech clearly not addressed to you, call the wait_for_user tool and stay quiet. Do not guess, do not ask "are you there?", do not repeat yourself.',
  ].join('\n')
}

// ─── Provider instruction-length guard (device blocker: string_above_max_length) ──
/*
 * The OpenAI Realtime session.update `instructions` field has a MAXIMUM length; over it,
 * the provider rejects the whole session config with `string_above_max_length` — the live
 * session connects and then dies (a device saw exactly this after the 68-person knowledge
 * update pushed the assembled instructions to 13,583 chars). The family DATA belongs behind
 * people_lookup, not in the prompt — so we cap the assembled instructions and FAIL THE BUILD
 * (this module is imported by the build + every test) if they ever exceed the cap, with the
 * measured size in the error.
 *
 * The provider max was MEASURED against the real /v1/realtime/client_secrets endpoint (the same
 * validator the session.update hits — it rejected the transcription prompt at exactly its
 * documented 1024 like the device did): session.instructions accepts AT LEAST 200,000 chars
 * (200k → HTTP 200; the ceiling is above that). The old 10,000 cap was a MISDIAGNOSIS — the
 * device crash was the transcription prompt (1024), never instructions. So the durable family/
 * friends/history portrait now lives IN the instructions (the Companion Brain, Phase 3), and the
 * cap is a generous-but-safe 60,000: ~3x the real assembled size (~22k), far under the 200k
 * limit, still catching a genuine runaway. buildSessionUpdate() checks the ACTUAL sent string
 * (assembled instructions + the runtime "today" line), which is what the provider validates.
 * Raising toward 200k is possible but should be confirmed on a live device session first.
 */
export const REALTIME_INSTRUCTIONS_MAX = 60_000

/** Throw (fail the build/import) if the assembled instructions exceed the provider cap. */
export function assertInstructionsWithinLimit(text: string = buildLiveInstructions()): void {
  if (text.length > REALTIME_INSTRUCTIONS_MAX) {
    throw new Error(
      `[liveInstructions] assembled session instructions are ${text.length} chars — OVER the ` +
        `${REALTIME_INSTRUCTIONS_MAX}-char cap (OpenAI Realtime rejects the session with ` +
        `string_above_max_length, so voice connects then dies on device). Move DATA behind a tool ` +
        `(people_lookup) — do NOT truncate blindly and do NOT raise the cap.`,
    )
  }
}

// ─── Bundle-shrink RATCHET (agent G) ─────────────────────────────────────────
/*
 * The assembled instructions carried a 10,902-char DUPLICATED family portrait — ~44% of
 * the bundle — which is exactly why relation queries answered from the PROMPT instead of
 * the deterministic people_lookup resolver (they had the answer in context, so they never
 * called the tool). It was removed ENTIRELY: family/relationship/relatives facts are now
 * re-injected PER-INTENT at call time by people_lookup, and life history by history_lookup.
 * This ratchet LOCKS the cut so the bundle cannot silently regrow, and it ratchets DOWN
 * toward the target as the static frame is further condensed. When the real size drops,
 * lower RATCHET to match; NEVER raise it without an explicit, justified reason (put DATA
 * behind a tool, do not inline it). Separate from REALTIME_INSTRUCTIONS_MAX (the hard
 * provider-cap guard) — this is the product's own shrink discipline, far below that cap.
 */
export const REALTIME_INSTRUCTIONS_TARGET = 5_000
export const REALTIME_INSTRUCTIONS_RATCHET = 14_000

/** Throw (fail the build/test) if the assembled instructions exceed the shrink ratchet. */
export function assertInstructionsRatchet(text: string = buildLiveInstructions()): void {
  if (text.length > REALTIME_INSTRUCTIONS_RATCHET) {
    throw new Error(
      `[liveInstructions] assembled instructions are ${text.length} chars — OVER the ` +
        `${REALTIME_INSTRUCTIONS_RATCHET}-char shrink ratchet (agent G removed the duplicated family ` +
        `portrait; the bundle must not regrow toward it — target is ${REALTIME_INSTRUCTIONS_TARGET}). ` +
        `Move DATA behind a tool (people_lookup / history_lookup); do NOT raise the ratchet.`,
    )
  }
}

/**
 * ONE guard over EVERY provider-capped string field of the assembled session.update.
 * Called by buildSessionUpdate on the exact values it sends, and at module load below,
 * so an over-limit field FAILS THE BUILD with the field, its size, and its cap — the
 * over-limit field is never discoverable only on a device again. Add a field here when
 * a new provider-capped string enters the payload.
 */
export function assertSessionPayloadWithinLimits(
  fields: { instructions?: string; transcriptionPrompt?: string } = {},
): void {
  assertInstructionsWithinLimit(fields.instructions ?? buildLiveInstructions())
  assertTranscriptionWithinLimit(fields.transcriptionPrompt ?? buildTranscriptionPrompt())
}

// Build-time enforcement: importing this module (the build + tests do) throws if ANY
// provider-capped field is over its limit — instructions (self-imposed 10k safety cap)
// AND transcription.prompt (documented 1024 provider cap; the field that broke on device).
assertSessionPayloadWithinLimits()
assertInstructionsRatchet()

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
  // news / current-events / weather / cinema ("what's on") were REMOVED from this
  // toolless list when get_current_info was added — they now have a real grounded
  // tool, so disclaiming them would be false. The remaining entries are still
  // genuinely toolless and must stay disclaimed. (Re-add an entry ONLY if its tool
  // is removed.)
  { id: 'memory-across-sessions', forbidden: ['זוכרת מי עשה מה', 'זוכרת מה קורה', 'מה שסיפרה אתמול'], requiredDecline: /do NOT remember earlier conversations/i },
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
