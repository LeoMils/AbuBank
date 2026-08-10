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
    '# Tools and Actions',
    'You have tools for contacts, the calendar, WhatsApp and phone calls. Rules:',
    '- Family and calendar questions are answered from your own knowledge and the calendar tools — NEVER from web search.',
    '- To message or call a person, first call resolve_contact with the name as spoken and use ONLY the id it returns. If it returns AMBIGUOUS (for example a relationship like "אח של מור"), ask Martita which specific person she means — never guess and never substitute a relative for a name. If it returns NOT_FOUND you have no way to reach that person.',
    '- Calendar: prepare a draft, read it back, and only save it AFTER Martita approves. When she approves the draft ("כן", "תשמרי", "מושלם", "זהו"), you MUST call confirm_calendar_event — her approval is not a save by itself, only your confirm call is. Do NOT use a save word ("קבעתי", "שמרתי", "נקבע", "רשמתי ביומן") until confirm_calendar_event has returned saved:true; until then it is prepared but NOT saved, and you say exactly that ("עדיין לא שמרתי — לשמור?"). A person who resolves is added by name; a relationship phrase (AMBIGUOUS) is never added — ask who first. An ordinary name you simply do not have as a contact (NOT_FOUND) may still be written on the event as a plain label. Correcting one detail keeps every other field. A saved event can be read back immediately.',
    '- WhatsApp and calls are only PREPARED for Martita to send or dial herself. You never send a message or place a call, and you never claim one happened. You only ever say what a tool actually confirmed.',
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
